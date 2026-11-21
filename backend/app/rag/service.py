"""Publiczny interfejs asystenta RAG.

    async def ask(question: str, mode: str, context: dict | None = None) -> dict

Zwraca::

    {"answer": str,
     "citations": [{"marker": int, "source": str, "path": str, "page": int | None, "excerpt": str}],
     "confidence": "high" | "partial" | "none"}

Przepływ: strażnik decyzji -> retrieval hybrydowy -> próg dowodów -> LLM (JSON) -> walidacja cytatów.
"""

from __future__ import annotations

import logging
import re
import time

from .chunking import chunk_body
from .config import RagSettings
from .guards import (DECISION_REFUSAL, NO_INFO_ANSWER, competency_names, context_terms,
                     is_decision_request, scrub_context)
from .llm import LLMError, build_llm
from .prompts import build_system_prompt, build_user_prompt
from .retrieval import Hit, Retriever, detect_process, evidence_strength
from .textutil import fold, split_sentences, tokenize

log = logging.getLogger("app.rag")

MAX_QUESTION_CHARS = 2000
MAX_CONTEXT_CHUNKS = 8
HIGH_COVERAGE = 0.6

_MARKER = re.compile(r"\[(\d+(?:\s*[,;]\s*\d+)*)\]")
_PAR_REF = re.compile(r"§\s*(\d+[a-z]?)")
# sformułowania, którymi model mógłby jednak przesądzić ocenę konkretnej osoby
_LEAK = re.compile(r"(powinien|powinna|powinno) (otrzymac|dostac)\b.{0,30}\b(ocen|poziom)|"
                   r"\b(proponuje|sugeruje|rekomenduje) (przyznac|ocene|poziom)\b|"
                   r"\bnalezy (mu|jej) przyznac\b")


def _response(answer: str, citations: list[dict] | None = None, confidence: str = "none") -> dict:
    return {"answer": answer, "citations": citations or [], "confidence": confidence}


def make_excerpt(chunk: dict, query: str, max_chars: int = 320) -> str:
    """Najbardziej pasujący do ``query`` fragment treści chunka (okno zdań)."""
    body = chunk_body(chunk).strip()
    if len(body) <= max_chars:
        return body
    sents = split_sentences(body.replace("\n", " "))
    q = set(tokenize(query))
    best, best_score = 0, -1.0
    for i, s in enumerate(sents):
        score = len(q & set(tokenize(s)))
        if score > best_score:
            best, best_score = i, score
    out = sents[best]
    j = best + 1
    while j < len(sents) and len(out) + len(sents[j]) + 1 <= max_chars:
        out += " " + sents[j]
        j += 1
    if len(out) > max_chars:
        out = out[: max_chars - 1].rsplit(" ", 1)[0] + "…"
    return out


def validate_citations(answer: str, chunks: list[dict], used_markers: list | None = None
                       ) -> tuple[str, list[tuple[int, dict]]]:
    """Zostawia w odpowiedzi tylko markery wskazujące na dostarczone fragmenty, numeruje je od 1
    w kolejności wystąpienia. Zwraca (nowy tekst, [(nowy_marker, chunk)])."""
    k = len(chunks)
    mapping: dict[int, int] = {}

    def repl(m: re.Match) -> str:
        nums = [int(x) for x in re.split(r"\s*[,;]\s*", m.group(1))]
        out = []
        for n in nums:
            if 1 <= n <= k:
                if n not in mapping:
                    mapping[n] = len(mapping) + 1
                out.append(f"[{mapping[n]}]")
        return "".join(out)

    text = _MARKER.sub(repl, answer)
    if not mapping and used_markers:
        # model podał źródła tylko w polu used_markers – dopisz je na końcu odpowiedzi
        extra = []
        for n in used_markers:
            if isinstance(n, int) and 1 <= n <= k and n not in mapping:
                mapping[n] = len(mapping) + 1
                extra.append(f"[{mapping[n]}]")
        if extra:
            text = text.rstrip() + " " + "".join(extra)
    text = re.sub(r"[ \t]+([.,;:])", r"\1", text)
    text = re.sub(r"[ \t]{2,}", " ", text).strip()
    cited = sorted(((new, chunks[old - 1]) for old, new in mapping.items()), key=lambda x: x[0])
    return text, cited


def _citation_dicts(cited: list[tuple[int, dict]], answer: str, question: str) -> list[dict]:
    out = []
    for marker, ch in cited:
        # do wyboru wycinka używamy zdań odpowiedzi, które powołują się na ten marker
        sents = [s for s in re.split(r"(?<=[.!?])\s+|\n", answer) if f"[{marker}]" in s]
        out.append({
            "marker": marker,
            "source": ch["source"],
            "path": ch["path"],
            "page": ch.get("page"),
            "excerpt": make_excerpt(ch, " ".join(sents) or question),
        })
    return out


class RagService:
    def __init__(self, retriever: Retriever, llm=None, embedder=None, settings: RagSettings | None = None):
        self.retriever = retriever
        self.llm = llm
        self.embedder = embedder
        self.s = settings or RagSettings.from_env()
        self._par_labels = {fold(c["path"].split(" ust.")[0]) for c in retriever.chunks
                            if c["doc_type"] == "rozporzadzenie" and c["path"].startswith("§")}

    # ------------------------------------------------------------------
    async def _query_vec(self, text: str):
        if not (self.embedder and self.retriever.has_dense):
            return None
        try:
            return (await self.embedder.embed([text], task="RETRIEVAL_QUERY"))[0]
        except Exception as e:  # noqa: BLE001 – brak embeddingu => sam BM25
            log.warning("Embedding zapytania nieudany: %s", type(e).__name__)
            return None

    def _missing_paragraphs(self, question: str) -> list[str]:
        refs = _PAR_REF.findall(question)
        return [r for r in refs if fold(f"§ {r}") not in self._par_labels]

    def _interview_extra(self, ctx: dict | None, have: set[str], query: str) -> list[dict]:
        """Dla kompetencji z kontekstu dołącza z modelu kompetencji listę wskaźników
        i najlepiej pasujący wskaźnik (opisy poziomów)."""
        extra: list[dict] = []
        q = set(tokenize(query + " " + context_terms(ctx)))
        for name in competency_names(ctx):
            key = fold(name)[:12]
            comp_chunks = self.retriever.find(lambda c: c["doc_type"] == "model" and fold(c["path"]).startswith(key))
            if not comp_chunks:
                continue
            overview = [c for c in comp_chunks if "lista wskaźników" in c["path"]]
            indicators = [c for c in comp_chunks if "wskaźnik " in c["path"]]
            best = max(indicators, key=lambda c: len(q & set(tokenize(c["text"]))), default=None)
            for c in (best, *overview):
                if c and c["id"] not in have:
                    extra.append(c)
                    have.add(c["id"])
        return extra

    def _decision_response(self, process: str | None) -> dict:
        hits = self.retriever.search("skala ocen cząstkowych punkty poziom oczekiwań przyznanie oceny",
                                     k=3, process=process, doc_types={"rozporzadzenie"})
        if not hits:
            return _response(DECISION_REFUSAL)
        ch = hits[0].chunk
        answer = DECISION_REFUSAL + " Zasady przyznawania ocen i skalę opisują przepisy [1]."
        return _response(answer, _citation_dicts([(1, ch)], answer, "skala ocen"), "none")

    def _extractive(self, chunks: list[dict], question: str, note: str) -> dict:
        top = chunks[:3]
        lines = [note]
        for i, c in enumerate(top, 1):
            lines.append(f"- {c['path']}: {make_excerpt(c, question, 240)} [{i}]")
        answer = "\n".join(lines)
        cited = [(i, c) for i, c in enumerate(top, 1)]
        return _response(answer, _citation_dicts(cited, answer, question), "partial")

    # ------------------------------------------------------------------
    async def ask(self, question: str, mode: str, context: dict | None = None) -> dict:
        t0 = time.perf_counter()
        question = (question or "").strip()[:MAX_QUESTION_CHARS]
        mode = "interview" if str(mode).lower().startswith("interview") else "formal"
        if not question:
            return _response("Proszę wpisać pytanie.")
        process = detect_process(question, context)
        ctx = scrub_context(context) if mode == "interview" else None

        if is_decision_request(question):
            res = self._decision_response(process)
            self._log(mode, "decision_refusal", 0, t0)
            return res

        missing = self._missing_paragraphs(question)
        if missing and mode == "formal":
            self._log(mode, "missing_paragraph", 0, t0)
            pars = ", ".join(f"§ {m}" for m in missing)
            return _response(f"{NO_INFO_ANSWER} Rozporządzenia w bazie wiedzy nie zawierają {pars}.")

        query = question
        if mode == "interview":
            query = f"{question} {context_terms(ctx)}".strip()
        qvec = await self._query_vec(query)
        hits: list[Hit] = self.retriever.search(query, k=self.s.top_k, process=process, query_vec=qvec)

        if mode == "formal":
            ok, cov, cos = evidence_strength(hits, self.s.min_coverage, self.s.min_cosine)
            if not ok:
                self._log(mode, "no_evidence", len(hits), t0)
                return _response(NO_INFO_ANSWER)
        else:
            ok, cov, cos = evidence_strength(hits, self.s.min_coverage, self.s.min_cosine)
            if not hits and not ctx:
                return _response(NO_INFO_ANSWER)

        chunks = [h.chunk for h in hits]
        if mode == "interview":
            have = {c["id"] for c in chunks}
            extra = self._interview_extra(ctx, have, question)
            chunks = (extra + chunks)[:MAX_CONTEXT_CHUNKS]

        if self.llm is None:
            self._log(mode, "extractive", len(chunks), t0)
            return self._extractive(chunks, question,
                                    "Model językowy jest niedostępny – poniżej najtrafniejsze fragmenty bazy wiedzy:")

        system = build_system_prompt(mode)
        user = build_user_prompt(question, chunks, ctx, mode)
        try:
            out = await self.llm.generate_json(system, user)
        except (LLMError, ValueError) as e:
            log.warning("Generacja nieudana: %s", type(e).__name__)
            self._log(mode, "llm_error", len(chunks), t0)
            return self._extractive(chunks, question,
                                    "Nie udało się wygenerować odpowiedzi – poniżej najtrafniejsze fragmenty bazy wiedzy:")

        status = str(out.get("status", "ok")).lower()
        answer = str(out.get("answer", "")).strip()
        if status == "refuse_decision" or (answer and _LEAK.search(fold(answer))):
            self._log(mode, "decision_refusal_llm", len(chunks), t0)
            return self._decision_response(process)
        if status == "no_info" or not answer or fold(answer).startswith(fold(NO_INFO_ANSWER)[:30]):
            self._log(mode, "no_info_llm", len(chunks), t0)
            return _response(NO_INFO_ANSWER)

        text, cited = validate_citations(answer, chunks, out.get("used_markers"))
        if not cited:
            if mode == "formal":
                # odpowiedź bez żadnego poprawnego odwołania do bazy wiedzy = nieuziemiona
                self._log(mode, "ungrounded", len(chunks), t0)
                return _response(NO_INFO_ANSWER)
            self._log(mode, "ok_context_only", len(chunks), t0)
            return _response(text, [], "partial")

        confidence = "high" if status == "ok" and (cov >= HIGH_COVERAGE or (cos or 0) >= self.s.min_cosine + 0.08) else "partial"
        if mode == "interview" and status == "ok":
            confidence = "high"
        self._log(mode, status, len(chunks), t0)
        return _response(text, _citation_dicts(cited, text, question), confidence)

    @staticmethod
    def _log(mode: str, outcome: str, n_chunks: int, t0: float) -> None:
        # celowo bez treści pytania i kontekstu (mogą zawierać dane osobowe)
        log.info("rag.ask mode=%s outcome=%s chunks=%d ms=%d", mode, outcome, n_chunks,
                 int((time.perf_counter() - t0) * 1000))


_default: RagService | None = None


def get_service() -> RagService:
    global _default
    if _default is None:
        settings = RagSettings.from_env()
        retriever = Retriever.from_dir(settings.corpus_dir)
        llm = build_llm(settings)
        embedder = None
        if settings.gemini_api_key and retriever.has_dense:
            from .llm import GeminiClient

            embedder = GeminiClient(settings)
        _default = RagService(retriever, llm, embedder, settings)
    return _default


def reset_service() -> None:
    global _default
    _default = None


async def ask(question: str, mode: str, context: dict | None = None) -> dict:
    return await get_service().ask(question, mode, context)

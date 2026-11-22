from __future__ import annotations

import logging
import re
import time

from .chunking import chunk_body
from .config import RagSettings
from .guards import (DECISION_REFUSAL, NO_INFO_ANSWER, competency_names, context_terms,
                     is_decision_request, scrub_context)
from .llm import GeminiClient, LLMError, build_llm
from .prompts import build_system_prompt, build_user_prompt
from .retrieval import Hit, Retriever, detect_process, evidence_strength
from .textutil import fold, split_sentences, tokenize

log = logging.getLogger("app.rag")

MAX_QUESTION_CHARS = 2000
MAX_CONTEXT_CHUNKS = 8
HIGH_COVERAGE = 0.6
SOFT_MIN_COVERAGE = 0.35
HIGH_COSINE_MARGIN = 0.08
LLM_UNAVAILABLE_NOTE = "Model językowy jest niedostępny – poniżej najtrafniejsze fragmenty bazy wiedzy:"
LLM_FAILED_NOTE = "Nie udało się wygenerować odpowiedzi – poniżej najtrafniejsze fragmenty bazy wiedzy:"

_MARKER = re.compile(r"\[(\d+(?:\s*[,;]\s*\d+)*)\]")
_PAR_REF = re.compile(r"§\s*(\d+[a-z]?)")
_LEAK = re.compile(r"(powinien|powinna|powinno) (otrzymac|dostac)\b.{0,30}\b(ocen|poziom)|"
                   r"\b(proponuje|sugeruje|rekomenduje) (przyznac|ocene|poziom)\b|"
                   r"\bnalezy (mu|jej) przyznac\b")


def _response(answer: str, citations: list[dict] | None = None, confidence: str = "none") -> dict:
    return {"answer": answer, "citations": citations or [], "confidence": confidence}


def make_excerpt(chunk: dict, query: str, max_chars: int = 320) -> str:
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
        self.settings = settings or RagSettings.from_env()
        self._par_labels = {fold(c["path"].split(" ust.")[0]) for c in retriever.chunks
                            if c["doc_type"] == "rozporzadzenie" and c["path"].startswith("§")}

    async def _query_vec(self, text: str):
        if not (self.embedder and self.retriever.has_dense):
            return None
        try:
            return (await self.embedder.embed([text], task="RETRIEVAL_QUERY"))[0]
        except Exception as exc:  # noqa: BLE001
            log.warning("Embedding zapytania nieudany: %s", type(exc).__name__)
            return None

    def _missing_paragraphs(self, question: str) -> list[str]:
        refs = _PAR_REF.findall(question)
        return [r for r in refs if fold(f"§ {r}") not in self._par_labels]

    def _interview_extra(self, ctx: dict | None, have: set[str], query: str) -> list[dict]:
        extra: list[dict] = []
        q = set(tokenize(query + " " + context_terms(ctx)))
        for name in competency_names(ctx):
            key = fold(name)[:12]
            comp_chunks = [
                c for c in self.retriever.chunks if c["doc_type"] == "model" and fold(c["path"]).startswith(key)
            ]
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

    def _plan_extra(self, ctx: dict | None, have: set[str]) -> list[dict]:
        """Model chunks for the weakest rated indicators of the lowest-rated competencies."""
        comps = [c for c in (ctx or {}).get("competencies", []) if isinstance(c, dict)]

        def weakest_first(comp: dict) -> tuple[bool, int]:
            level = comp.get("manager_level") or comp.get("suggested_level")
            return (level is None, level or 0)

        extra: list[dict] = []
        for comp in sorted(comps, key=weakest_first)[:3]:
            name_key = fold(str(comp.get("competency", "")))[:12]
            rated = [i for i in comp.get("indicators", []) if isinstance(i, dict) and i.get("level")]
            for ind in sorted(rated, key=lambda i: i["level"])[:2]:
                needle = fold(str(ind.get("indicator", "")))[:40]
                for c in self.retriever.chunks:
                    if (needle and c["doc_type"] == "model" and c["id"] not in have
                            and "wskaznik" in fold(c["path"]) and fold(c["path"]).startswith(name_key)
                            and needle in fold(c["text"])):
                        extra.append(c)
                        have.add(c["id"])
                        break
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

    async def ask(self, question: str, mode: str, context: dict | None = None) -> dict:
        t0 = time.perf_counter()
        question = (question or "").strip()[:MAX_QUESTION_CHARS]
        raw_mode = str(mode).lower()
        mode = "plan" if raw_mode.startswith("plan") else "interview" if raw_mode.startswith("interview") else "formal"
        with_data = mode in ("interview", "plan")
        if not question:
            return _response("Proszę wpisać pytanie.")
        process = detect_process(question, context)
        ctx = scrub_context(context) if with_data else None

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
        if with_data:
            query = f"{question} {context_terms(ctx)}".strip()
        qvec = await self._query_vec(query)
        hits: list[Hit] = self.retriever.search(query, k=self.settings.top_k, process=process, query_vec=qvec)

        enough, cov, cos = evidence_strength(hits, self.settings.min_coverage, self.settings.min_cosine)
        # Borderline coverage (natural phrasing, words absent from the sources) goes to the LLM, which is
        # instructed to answer only from the fragments and to return "no_info" otherwise. Without an LLM,
        # or with clearly unrelated questions, refuse right away as before.
        borderline = self.llm is not None and cov >= SOFT_MIN_COVERAGE
        if mode == "formal" and not enough and not borderline:
            self._log(mode, "no_evidence", len(hits), t0)
            return _response(NO_INFO_ANSWER)
        if with_data and not hits and not ctx:
            return _response(NO_INFO_ANSWER)

        chunks = [h.chunk for h in hits]
        if with_data:
            have = {c["id"] for c in chunks}
            extra = (self._plan_extra(ctx, have) if mode == "plan" else self._interview_extra(ctx, have, question))
            chunks = (extra + chunks)[:MAX_CONTEXT_CHUNKS]

        if self.llm is None:
            self._log(mode, "extractive", len(chunks), t0)
            return self._extractive(chunks, question, LLM_UNAVAILABLE_NOTE)

        system = build_system_prompt(mode)
        user = build_user_prompt(question, chunks, ctx, mode)
        try:
            out = await self.llm.generate_json(system, user)
        except (LLMError, ValueError) as exc:
            log.warning("Generacja nieudana: %s", type(exc).__name__)
            self._log(mode, "llm_error", len(chunks), t0)
            return self._extractive(chunks, question, LLM_FAILED_NOTE)

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
                self._log(mode, "ungrounded", len(chunks), t0)
                return _response(NO_INFO_ANSWER)
            self._log(mode, "ok_context_only", len(chunks), t0)
            return _response(text, [], "partial")

        self._log(mode, status, len(chunks), t0)
        return _response(text, _citation_dicts(cited, text, question), self._confidence(mode, status, cov, cos))

    def _confidence(self, mode: str, status: str, coverage: float, cosine: float | None) -> str:
        if status != "ok":
            return "partial"
        if mode in ("interview", "plan"):
            return "high"
        strong = coverage >= HIGH_COVERAGE or (cosine or 0) >= self.settings.min_cosine + HIGH_COSINE_MARGIN
        return "high" if strong else "partial"

    @staticmethod
    def _log(mode: str, outcome: str, n_chunks: int, t0: float) -> None:
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
            embedder = GeminiClient(settings)
        _default = RagService(retriever, llm, embedder, settings)
    return _default


def reset_service() -> None:
    global _default
    _default = None


async def ask(question: str, mode: str, context: dict | None = None) -> dict:
    return await get_service().ask(question, mode, context)

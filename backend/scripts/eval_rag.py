from __future__ import annotations

import argparse
import asyncio
import dataclasses
import json
import sys
import time
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from app.rag.config import RagSettings  # noqa: E402
from app.rag.guards import DECISION_REFUSAL, NO_INFO_ANSWER, context_terms, scrub_context  # noqa: E402
from app.rag.llm import GeminiClient, build_llm  # noqa: E402
from app.rag.retrieval import Retriever, detect_process  # noqa: E402
from app.rag.service import MAX_CONTEXT_CHUNKS, RagService  # noqa: E402
from app.rag.textutil import fold  # noqa: E402


def path_match(chunk_path: str, expected: str) -> bool:
    if not expected:
        return True
    a, b = fold(chunk_path), fold(expected)
    if not a.startswith(b):
        return False
    nxt = a[len(b):len(b) + 1]
    return not nxt.isdigit()


def matches(chunk: dict, exp: dict, strict: bool = True) -> bool:
    if chunk["source_id"] != exp["source_id"]:
        return False
    return path_match(chunk["path"], exp.get("path", "")) if strict else True


def load_eval_items(settings: RagSettings) -> list[dict]:
    lines = (settings.corpus_dir / "qa_eval.jsonl").read_text(encoding="utf-8").splitlines()
    return [json.loads(line) for line in lines if line.strip()]


def classify(res: dict) -> str:
    a = res["answer"]
    if a.startswith(DECISION_REFUSAL[:60]):
        return "decision_refusal"
    if a.startswith(NO_INFO_ANSWER):
        return "no_info"
    return "answer"


async def run(args) -> None:
    settings = RagSettings.from_env()
    if args.coverage is not None:
        settings = dataclasses.replace(settings, min_coverage=args.coverage)
    retriever = Retriever.from_dir(settings.corpus_dir)
    llm = None if args.no_llm else build_llm(settings)
    embedder = GeminiClient(settings) if (settings.gemini_api_key and retriever.has_dense and not args.no_llm) else None
    svc = RagService(retriever, llm, embedder, settings)
    by_title = {}
    for c in retriever.chunks:
        by_title.setdefault((c["source"], c["path"]), c)

    items = load_eval_items(settings)
    rows = []
    for it in items:
        t0 = time.perf_counter()
        ctx = it.get("context")
        q = it["question"]
        query = q if it["mode"] == "formal" else f"{q} {context_terms(scrub_context(ctx))}"
        qvec = await svc._query_vec(query)
        hits = retriever.search(query, k=settings.top_k, process=detect_process(q, ctx), query_vec=qvec)
        chunks = [h.chunk for h in hits]
        if it["mode"] == "interview":
            have = {c["id"] for c in chunks}
            chunks = (svc._interview_extra(scrub_context(ctx), have, q) + chunks)[:MAX_CONTEXT_CHUNKS]
        rank = None
        for i, c in enumerate(chunks, 1):
            if any(matches(c, e) for e in it["expected_sources"]):
                rank = i
                break
        res = await svc.ask(q, it["mode"], ctx)
        got = classify(res)
        cits = res["citations"]
        cit_chunks = [by_title.get((c["source"], c["path"])) for c in cits]
        cit_doc_ok = sum(1 for c in cit_chunks if c and any(matches(c, e, strict=False) for e in it["expected_sources"]))
        cit_strict_ok = sum(1 for c in cit_chunks if c and any(matches(c, e) for e in it["expected_sources"]))
        markers_ok = all(f"[{c['marker']}]" in res["answer"] for c in cits)
        rows.append({
            "id": it["id"], "category": it["category"], "mode": it["mode"], "expected": it["expected"], "got": got,
            "rank": rank, "best_cov": round(max((h.coverage for h in hits), default=0), 2),
            "n_cit": len(cits), "cit_doc_ok": cit_doc_ok, "cit_strict_ok": cit_strict_ok, "markers_ok": markers_ok,
            "confidence": res["confidence"], "question": q, "answer": res["answer"],
            "ms": int((time.perf_counter() - t0) * 1000),
        })
        if llm is not None and args.delay:
            await asyncio.sleep(args.delay)

    report = summarize(rows, settings, llm, embedder, args)
    print(report["text"])
    if args.write:
        out = BACKEND / "app" / "rag" / "EVAL.md"
        out.write_text(report["md"], encoding="utf-8", newline="\n")
        print(f"\nZapisano {out}")


def pct(a: int, b: int) -> str:
    return f"{(100 * a / b):.0f}% ({a}/{b})" if b else "–"


def summarize(rows, settings, llm, embedder, args) -> dict:
    ans = [r for r in rows if r["expected"] == "answer"]
    noinf = [r for r in rows if r["expected"] == "no_info"]
    dec = [r for r in rows if r["expected"] == "decision_refusal"]
    hit = sum(1 for r in ans if r["rank"])
    mrr = sum(1 / r["rank"] for r in ans if r["rank"]) / len(ans) if ans else 0
    hit1 = sum(1 for r in ans if r["rank"] == 1)
    hit3 = sum(1 for r in ans if r["rank"] and r["rank"] <= 3)
    ok_noinf = sum(1 for r in noinf if r["got"] == "no_info")
    ok_dec = sum(1 for r in dec if r["got"] == "decision_refusal")
    false_ref = sum(1 for r in ans if r["got"] != "answer")
    n_cit = sum(r["n_cit"] for r in ans)
    cit_doc = sum(r["cit_doc_ok"] for r in ans)
    cit_strict = sum(r["cit_strict_ok"] for r in ans)
    markers_ok = sum(1 for r in rows if r["markers_ok"])
    mode = ("LLM: " + llm.name) if llm else "bez LLM (odpowiedź ekstrakcyjna)"
    dense = "BM25 + embeddingi (RRF)" if embedder else "tylko BM25"

    lines = [
        f"Tryb: {mode}; retrieval: {dense}; top_k={settings.top_k}; min_coverage={settings.min_coverage}",
        f"Pytań: {len(rows)} (z odpowiedzią: {len(ans)}, poza bazą/nieistniejące: {len(noinf)}, prośby o decyzję: {len(dec)})",
        f"Retrieval hit@k (właściwy fragment w kontekście): {pct(hit, len(ans))}; hit@1: {pct(hit1, len(ans))}; hit@3: {pct(hit3, len(ans))}; MRR: {mrr:.2f}",
        f"Poprawne odmowy (brak informacji): {pct(ok_noinf, len(noinf))}",
        f"Poprawne odmowy (prośba o decyzję): {pct(ok_dec, len(dec))}",
        f"Fałszywe odmowy (pytania z odpowiedzią): {pct(false_ref, len(ans))}",
        f"Cytaty z właściwego dokumentu: {pct(cit_doc, n_cit)}; z właściwej jednostki (§/rozdział/wskaźnik): {pct(cit_strict, n_cit)}",
        f"Spójność markerów [n] z listą cytatów: {pct(markers_ok, len(rows))}",
    ]
    text = "\n".join(lines)

    md = ["# Ewaluacja asystenta RAG", "",
          f"Wygenerowano skryptem `python scripts/eval_rag.py{' --no-llm' if args.no_llm else ''} --write` "
          f"({time.strftime('%Y-%m-%d %H:%M')}). Zestaw: `data/corpus/qa_eval.jsonl`.", "",
          "## Wyniki", ""] + [f"- {x}" for x in lines]
    md += ["", "## Jak czytać wyniki", "",
           "- *hit@k* liczy pytania, dla których co najmniej jedno z oczekiwanych źródeł (dokument + jednostka: "
           "§, rozdział poradnika, wskaźnik modelu) trafiło do fragmentów przekazanych modelowi.",
           "- *Cytaty z właściwej jednostki* to metryka ostra: cytat z innego, też trafnego miejsca (np. poradnik "
           "zamiast §) liczy się tylko w metryce „z właściwego dokumentu”.",
           "- Bez LLM odmowy wynikają wyłącznie z progu pokrycia, strażnika decyzji i kontroli nieistniejących §. "
           "Pytania spoza bazy ze słownictwem z dziedziny (np. „urlop wypoczynkowy”) przechodzą próg i są "
           "odrzucane dopiero przez LLM (status `no_info`), który widzi, że fragmenty nie zawierają odpowiedzi.",
           "- Historia tuningu: prefiks 6 znaków + stop-słowa → hit@k 88%, hit@3 79%; dodanie stop-słów pytających "
           "(kogo, zrobić…) i naprawa scalonych komórek arkusza głównego → hit@k 97%; drugi rdzeń (prefiks 4) → "
           "hit@3 94%. Próg pokrycia podniesiony z 0,45 do 0,55 (lepsze odmowy przy 1 fałszywej odmowie). "
           "Próg dobrany na tym samym zbiorze, więc wynik jest optymistyczny – zbiór warto rozbudować."]
    if args.sweep_rows:
        md += ["", "## Przegląd progu odmowy (`RAG_MIN_COVERAGE`, bez LLM)", "",
               "| próg | poprawne odmowy (brak info) | fałszywe odmowy |", "|---|---|---|"]
        md += [f"| {t} | {a} | {b} |" for t, a, b in args.sweep_rows]
    md += ["", "## Szczegóły", "",
           "| id | kategoria | oczekiwane | wynik | ranga źródła | pokrycie | cytaty (dok./jedn.) | pewność |",
           "|---|---|---|---|---|---|---|---|"]
    for r in rows:
        md.append(f"| {r['id']} | {r['category']} | {r['expected']} | {r['got']} | {r['rank'] or '–'} | "
                  f"{r['best_cov']} | {r['cit_doc_ok']}/{r['cit_strict_ok']} z {r['n_cit']} | {r['confidence']} |")
    if llm:
        md += ["", "## Przykładowe odpowiedzi", ""]
        for r in rows[:: max(1, len(rows) // 8)]:
            md += [f"**{r['id']}: {r['question']}**", "", "> " + r["answer"].replace("\n", "\n> "), ""]
    return {"text": text, "md": "\n".join(md) + "\n"}


async def sweep(args) -> list[tuple]:
    out = []
    settings = RagSettings.from_env()
    retriever = Retriever.from_dir(settings.corpus_dir)
    items = load_eval_items(settings)
    for t in [0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6]:
        svc = RagService(retriever, None, None, dataclasses.replace(settings, min_coverage=t))
        ok = fr = n_no = n_ans = 0
        for it in items:
            if it["expected"] == "decision_refusal" or it["mode"] != "formal":
                continue
            got = classify(await svc.ask(it["question"], it["mode"], it.get("context")))
            if it["expected"] == "no_info":
                n_no += 1
                ok += got == "no_info"
            else:
                n_ans += 1
                fr += got != "answer"
        out.append((t, pct(ok, n_no), pct(fr, n_ans)))
        print(f"min_coverage={t}: poprawne odmowy {pct(ok, n_no)}, fałszywe odmowy {pct(fr, n_ans)}")
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-llm", action="store_true")
    ap.add_argument("--sweep", action="store_true")
    ap.add_argument("--write", action="store_true", help="zapisz app/rag/EVAL.md")
    ap.add_argument("--coverage", type=float, default=None)
    ap.add_argument("--delay", type=float, default=4.0, help="odstęp [s] między pytaniami do LLM (limity free tier)")
    args = ap.parse_args()
    args.sweep_rows = asyncio.run(sweep(args)) if args.sweep else None
    asyncio.run(run(args))


if __name__ == "__main__":
    main()

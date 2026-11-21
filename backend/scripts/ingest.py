"""Budowa indeksu RAG: ekstrakcja + chunkowanie korpusu, opcjonalnie embeddingi Gemini.

Użycie (z katalogu backend/):
    python scripts/ingest.py [--docs ŚCIEŻKA_DO_docs/HackNation] [--no-embed]

Wynik:
    data/corpus/chunks.jsonl         – chunki z metadanymi
    data/corpus/embeddings.npy       – macierz embeddingów (gdy ustawiony GEMINI_API_KEY)
    data/corpus/embeddings.meta.json – model, wymiar i kolejność id chunków
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from app.rag.config import RagSettings  # noqa: E402
from app.rag.extract import build_chunks  # noqa: E402


def find_docs_root() -> Path | None:
    for parent in [BACKEND, *BACKEND.parents]:
        cand = parent / "docs" / "HackNation"
        if cand.is_dir():
            return cand
    return None


async def embed_all(chunks: list[dict], settings: RagSettings, out_dir: Path) -> None:
    import numpy as np

    from app.rag.llm import GeminiClient

    client = GeminiClient(settings)
    texts = [c["text"] for c in chunks]
    vecs = await client.embed(texts, task="RETRIEVAL_DOCUMENT")
    arr = np.asarray(vecs, dtype="float32")
    np.save(out_dir / "embeddings.npy", arr)
    meta = {"model": settings.gemini_embed_model, "dim": int(arr.shape[1]), "ids": [c["id"] for c in chunks]}
    (out_dir / "embeddings.meta.json").write_text(json.dumps(meta, ensure_ascii=False), encoding="utf-8")
    print(f"Zapisano embeddingi: {arr.shape}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--docs", type=Path, default=None, help="katalog docs/HackNation")
    ap.add_argument("--out", type=Path, default=None)
    ap.add_argument("--no-embed", action="store_true")
    args = ap.parse_args()

    settings = RagSettings.from_env()
    docs = args.docs or find_docs_root()
    if not docs or not docs.is_dir():
        sys.exit("Nie znaleziono katalogu docs/HackNation – podaj --docs")
    out_dir = args.out or settings.corpus_dir
    out_dir.mkdir(parents=True, exist_ok=True)

    report: list[str] = []
    chunks = build_chunks(docs, report)
    for line in report:
        print(line)
    with (out_dir / "chunks.jsonl").open("w", encoding="utf-8", newline="\n") as f:
        for c in chunks:
            f.write(json.dumps(c, ensure_ascii=False) + "\n")
    print(f"Zapisano {len(chunks)} chunków -> {out_dir / 'chunks.jsonl'}")

    if args.no_embed:
        return
    if not settings.gemini_api_key:
        print("Brak GEMINI_API_KEY – pomijam embeddingi (retrieval będzie działał tylko na BM25).")
        return
    asyncio.run(embed_all(chunks, settings, out_dir))


if __name__ == "__main__":
    main()

from __future__ import annotations

import json
import math
import re
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from rank_bm25 import BM25Okapi

from .textutil import fold, tokenize

RRF_K = 60
OTHER_PROCESS_PENALTY = 0.55


@dataclass
class Hit:
    chunk: dict
    score: float
    bm25_rank: int | None
    dense_rank: int | None
    cosine: float | None
    coverage: float


def detect_process(question: str, context: dict | None = None) -> str | None:
    if context:
        p = str(context.get("process") or context.get("process_type") or context.get("typ") or "").lower()
        if p.startswith("pierw") or p in {"first", "initial"}:
            return "pierwsza"
        if p.startswith("okres") or p == "periodic":
            return "okresowa"
    q = fold(question)
    first = bool(re.search(r"pierwsz\w* ocen|ocen\w* pierwsz|sprawozdan|sluzb\w* przygotow|rozmow\w* wstepn", q))
    periodic = bool(re.search(r"okresow|arkusz\w* [abc]\b|kryteri\w* dodatkow|stopni\w* sluzbow|sprzeciw", q))
    if first and not periodic:
        return "pierwsza"
    if periodic and not first:
        return "okresowa"
    return None


class Retriever:
    def __init__(self, chunks: list[dict], embeddings=None, embed_ids: list[str] | None = None):
        self.chunks = chunks
        self.tokens = [tokenize(c["text"]) for c in chunks]
        self.bm25 = BM25Okapi(self.tokens, k1=1.3, b=0.6)
        n = len(chunks)
        df: dict[str, int] = {}
        for toks in self.tokens:
            for t in set(toks):
                df[t] = df.get(t, 0) + 1
        self.idf = {t: math.log(1 + (n - d + 0.5) / (d + 0.5)) for t, d in df.items()}
        self.max_idf = math.log(1 + (n + 0.5) / 0.5)
        self.token_sets = [set(t) for t in self.tokens]
        self.emb = None
        if embeddings is not None and embed_ids is not None:
            pos = {cid: i for i, cid in enumerate(embed_ids)}
            if all(c["id"] in pos for c in chunks):
                m = np.asarray([embeddings[pos[c["id"]]] for c in chunks], dtype="float32")
                m /= np.linalg.norm(m, axis=1, keepdims=True) + 1e-9
                self.emb = m

    @classmethod
    def from_dir(cls, corpus_dir: Path) -> Retriever:
        chunks = [json.loads(line) for line in (corpus_dir / "chunks.jsonl").read_text(encoding="utf-8").splitlines()
                  if line.strip()]
        emb, ids = None, None
        npy, meta = corpus_dir / "embeddings.npy", corpus_dir / "embeddings.meta.json"
        if npy.exists() and meta.exists():
            emb = np.load(npy)
            ids = json.loads(meta.read_text(encoding="utf-8"))["ids"]
        return cls(chunks, emb, ids)

    @property
    def has_dense(self) -> bool:
        return self.emb is not None

    def coverage(self, q_tokens: list[str], idx: int) -> float:
        uniq = set(q_tokens)
        if not uniq:
            return 0.0
        total = sum(self.idf.get(t, self.max_idf) for t in uniq)
        hit = sum(self.idf[t] for t in uniq if t in self.token_sets[idx])
        return hit / total if total else 0.0

    def search(self, query: str, k: int = 6, process: str | None = None, query_vec=None,
               doc_types: set[str] | None = None, candidates: int = 40) -> list[Hit]:
        q_tokens = tokenize(query)
        n = len(self.chunks)
        allowed = [i for i in range(n) if not doc_types or self.chunks[i]["doc_type"] in doc_types]

        bm_scores = self.bm25.get_scores(q_tokens) if q_tokens else [0.0] * n
        bm_order = sorted((i for i in allowed if bm_scores[i] > 0), key=lambda i: -bm_scores[i])[:candidates]
        bm_rank = {i: r for r, i in enumerate(bm_order)}

        dense_rank: dict[int, int] = {}
        cos: dict[int, float] = {}
        if self.emb is not None and query_vec is not None:
            v = np.asarray(query_vec, dtype="float32")
            v /= np.linalg.norm(v) + 1e-9
            sims = self.emb @ v
            d_order = sorted(allowed, key=lambda i: -sims[i])[:candidates]
            dense_rank = {i: r for r, i in enumerate(d_order)}
            cos = {i: float(sims[i]) for i in allowed}

        fused: dict[int, float] = {}
        for ranking in (bm_rank, dense_rank):
            for i, r in ranking.items():
                fused[i] = fused.get(i, 0.0) + 1.0 / (RRF_K + r + 1)

        if process:
            for i in fused:
                if self.chunks[i]["applies_to"] not in ("oba", process):
                    fused[i] *= OTHER_PROCESS_PENALTY

        order = sorted(fused, key=lambda i: -fused[i])[:k]
        return [Hit(self.chunks[i], fused[i], bm_rank.get(i), dense_rank.get(i), cos.get(i),
                    self.coverage(q_tokens, i)) for i in order]


def evidence_strength(hits: list[Hit], min_coverage: float, min_cosine: float) -> tuple[bool, float, float | None]:
    if not hits:
        return False, 0.0, None
    best_cov = max(h.coverage for h in hits)
    cosines = [h.cosine for h in hits if h.cosine is not None]
    best_cos = max(cosines) if cosines else None
    ok = best_cov >= min_coverage or (best_cos is not None and best_cos >= min_cosine and best_cov >= min_coverage * 0.6)
    return ok, best_cov, best_cos

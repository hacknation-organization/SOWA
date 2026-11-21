from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parents[2]

load_dotenv(BACKEND_DIR / ".env", override=False)
DEFAULT_CORPUS_DIR = BACKEND_DIR / "data" / "corpus"


def _env(name: str, default: str = "") -> str:
    return os.environ.get(name, default).strip()


@dataclass(frozen=True)
class RagSettings:
    corpus_dir: Path
    gemini_api_key: str
    gemini_model: str
    gemini_embed_model: str
    embed_dim: int
    groq_api_key: str
    groq_model: str
    llm_chain: str
    anthropic_api_key: str
    anthropic_effort: str
    openai_api_key: str
    openai_base_url: str
    openrouter_api_key: str
    ollama_base_url: str
    top_k: int
    min_coverage: float
    min_cosine: float
    llm_timeout_s: float

    @classmethod
    def from_env(cls) -> RagSettings:
        return cls(
            corpus_dir=Path(_env("RAG_CORPUS_DIR") or DEFAULT_CORPUS_DIR),
            gemini_api_key=_env("GEMINI_API_KEY") or _env("GOOGLE_API_KEY"),
            gemini_model=_env("RAG_GEMINI_MODEL", "gemini-3.5-flash"),
            gemini_embed_model=_env("RAG_GEMINI_EMBED_MODEL", "gemini-embedding-001"),
            embed_dim=int(_env("RAG_EMBED_DIM", "768")),
            groq_api_key=_env("GROQ_API_KEY"),
            groq_model=_env("RAG_GROQ_MODEL", "llama-3.3-70b-versatile"),
            llm_chain=_env("RAG_LLM"),
            anthropic_api_key=_env("ANTHROPIC_API_KEY"),
            anthropic_effort=_env("RAG_ANTHROPIC_EFFORT"),
            openai_api_key=_env("OPENAI_API_KEY"),
            openai_base_url=_env("OPENAI_BASE_URL", "https://api.openai.com/v1"),
            openrouter_api_key=_env("OPENROUTER_API_KEY"),
            ollama_base_url=_env("OLLAMA_BASE_URL", "http://localhost:11434/v1"),
            top_k=int(_env("RAG_TOP_K", "6")),
            min_coverage=float(_env("RAG_MIN_COVERAGE", "0.55")),
            min_cosine=float(_env("RAG_MIN_COSINE", "0.62")),
            llm_timeout_s=float(_env("RAG_LLM_TIMEOUT", "40")),
        )

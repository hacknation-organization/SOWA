"""Sprawdza, czy modele z RAG_LLM (albo domyślnie Gemini/Groq) odpowiadają: python scripts/check_llm.py"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.rag.config import RagSettings  # noqa: E402
from app.rag.llm import LLMError, make_client, parse_chain  # noqa: E402

SYSTEM = 'Odpowiadasz wyłącznie JSON: {"status": "ok", "answer": "...", "used_markers": []}'


async def main() -> int:
    settings = RagSettings.from_env()
    chain = parse_chain(settings.llm_chain) if settings.llm_chain else [("gemini", ""), ("groq", "")]
    print(f"RAG_LLM = {settings.llm_chain or '(nieustawione – domyślnie gemini, groq)'}")
    ok = False
    for provider, model in chain:
        try:
            client = make_client(settings, provider, model)
        except LLMError as exc:
            print(f"{provider}: pominięty ({exc})")
            continue
        label = f"{provider}:{getattr(client, 'model', model)}"
        try:
            out = await client.generate_json(SYSTEM, "Napisz jedno zdanie powitania.")
            print(f"{label}: OK -> {out.get('answer')!r}")
            ok = True
        except Exception as exc:  # noqa: BLE001
            print(f"{label}: BŁĄD -> {exc}")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))

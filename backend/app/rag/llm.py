"""Klienci LLM: Gemini (generacja + embeddingi, REST przez httpx) i Groq (zapasowo, API zgodne z OpenAI).

Interfejs używany przez serwis: ``await llm.generate_json(system, user) -> dict``.
W testach podstawia się dowolny obiekt z tą metodą (mock, bez sieci).
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
from typing import Protocol

import httpx

from .config import RagSettings
from .prompts import RESPONSE_SCHEMA

log = logging.getLogger("app.rag.llm")

GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta"
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"


class LLMError(RuntimeError):
    pass


class JsonLLM(Protocol):
    name: str

    async def generate_json(self, system: str, user: str) -> dict: ...


def parse_json_loose(text: str) -> dict:
    """Parsuje JSON z odpowiedzi modelu (toleruje otoczkę ```json ... ```)."""
    text = text.strip()
    m = re.search(r"\{.*\}", text, re.S)
    if not m:
        raise LLMError("Odpowiedź modelu nie zawiera JSON")
    return json.loads(m.group(0))


class GeminiClient:
    name = "gemini"

    def __init__(self, settings: RagSettings):
        self.s = settings
        if not settings.gemini_api_key:
            raise LLMError("Brak GEMINI_API_KEY")

    def _headers(self) -> dict:
        # klucz w nagłówku, nie w URL (nie trafia do logów proxy)
        return {"x-goog-api-key": self.s.gemini_api_key, "Content-Type": "application/json"}

    async def generate_json(self, system: str, user: str) -> dict:
        url = f"{GEMINI_BASE}/models/{self.s.gemini_model}:generateContent"
        body = {
            "systemInstruction": {"parts": [{"text": system}]},
            "contents": [{"role": "user", "parts": [{"text": user}]}],
            "generationConfig": {
                "temperature": 0.1,
                "maxOutputTokens": 2048,
                "responseMimeType": "application/json",
                "responseSchema": RESPONSE_SCHEMA,
            },
        }
        async with httpx.AsyncClient(timeout=self.s.llm_timeout_s) as client:
            r = await client.post(url, headers=self._headers(), json=body)
        if r.status_code != 200:
            raise LLMError(f"Gemini HTTP {r.status_code}: {r.text[:300]}")
        data = r.json()
        try:
            parts = data["candidates"][0]["content"]["parts"]
            text = "".join(p.get("text", "") for p in parts)
        except (KeyError, IndexError) as e:
            raise LLMError(f"Nieoczekiwana odpowiedź Gemini: {str(data)[:300]}") from e
        return parse_json_loose(text)

    async def embed(self, texts: list[str], task: str = "RETRIEVAL_DOCUMENT", batch: int = 50) -> list[list[float]]:
        url = f"{GEMINI_BASE}/models/{self.s.gemini_embed_model}:batchEmbedContents"
        out: list[list[float]] = []
        async with httpx.AsyncClient(timeout=60) as client:
            for i in range(0, len(texts), batch):
                reqs = [{"model": f"models/{self.s.gemini_embed_model}",
                         "content": {"parts": [{"text": t[:8000]}]},
                         "taskType": task,
                         "outputDimensionality": self.s.embed_dim} for t in texts[i:i + batch]]
                for attempt in range(5):
                    r = await client.post(url, headers=self._headers(), json={"requests": reqs})
                    if r.status_code == 429:  # limit free tier – odczekaj i ponów
                        await asyncio.sleep(10 * (attempt + 1))
                        continue
                    break
                if r.status_code != 200:
                    raise LLMError(f"Gemini embed HTTP {r.status_code}: {r.text[:300]}")
                out.extend(e["values"] for e in r.json()["embeddings"])
        return out


class GroqClient:
    name = "groq"

    def __init__(self, settings: RagSettings):
        self.s = settings
        if not settings.groq_api_key:
            raise LLMError("Brak GROQ_API_KEY")

    async def generate_json(self, system: str, user: str) -> dict:
        body = {
            "model": self.s.groq_model,
            "temperature": 0.1,
            "max_tokens": 2048,
            "response_format": {"type": "json_object"},
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
        }
        headers = {"Authorization": f"Bearer {self.s.groq_api_key}"}
        async with httpx.AsyncClient(timeout=self.s.llm_timeout_s) as client:
            r = await client.post(GROQ_URL, headers=headers, json=body)
        if r.status_code != 200:
            raise LLMError(f"Groq HTTP {r.status_code}: {r.text[:300]}")
        return parse_json_loose(r.json()["choices"][0]["message"]["content"])


class FallbackLLM:
    """Próbuje kolejnych dostawców (Gemini -> Groq)."""

    def __init__(self, clients: list[JsonLLM]):
        self.clients = clients
        self.name = "+".join(c.name for c in clients)
        self.last_used: str | None = None

    async def generate_json(self, system: str, user: str) -> dict:
        errors = []
        for c in self.clients:
            try:
                res = await c.generate_json(system, user)
                self.last_used = c.name
                return res
            except Exception as e:  # noqa: BLE001 – każdy błąd dostawcy => kolejny dostawca
                log.warning("LLM %s niedostępny: %s", c.name, type(e).__name__)
                errors.append(f"{c.name}: {e}")
        raise LLMError("; ".join(errors))


def build_llm(settings: RagSettings) -> FallbackLLM | None:
    clients: list[JsonLLM] = []
    for cls in (GeminiClient, GroqClient):
        try:
            clients.append(cls(settings))
        except LLMError:
            pass
    return FallbackLLM(clients) if clients else None

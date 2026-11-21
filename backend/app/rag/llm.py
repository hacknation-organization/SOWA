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
TEMPERATURE = 0.1
MAX_OUTPUT_TOKENS = 2048
EMBED_TIMEOUT_S = 60
EMBED_MAX_CHARS = 8000
EMBED_RATE_LIMIT_RETRIES = 5


class LLMError(RuntimeError):
    pass


class JsonLLM(Protocol):
    name: str

    async def generate_json(self, system: str, user: str) -> dict: ...


def parse_json_loose(text: str) -> dict:
    text = text.strip()
    m = re.search(r"\{.*\}", text, re.S)
    if not m:
        raise LLMError("Odpowiedź modelu nie zawiera JSON")
    return json.loads(m.group(0))


class GeminiClient:
    name = "gemini"

    def __init__(self, settings: RagSettings):
        self.settings = settings
        if not settings.gemini_api_key:
            raise LLMError("Brak GEMINI_API_KEY")

    def _headers(self) -> dict:
        return {"x-goog-api-key": self.settings.gemini_api_key, "Content-Type": "application/json"}

    async def generate_json(self, system: str, user: str) -> dict:
        url = f"{GEMINI_BASE}/models/{self.settings.gemini_model}:generateContent"
        body = {
            "systemInstruction": {"parts": [{"text": system}]},
            "contents": [{"role": "user", "parts": [{"text": user}]}],
            "generationConfig": {
                "temperature": TEMPERATURE,
                "maxOutputTokens": MAX_OUTPUT_TOKENS,
                "responseMimeType": "application/json",
                "responseSchema": RESPONSE_SCHEMA,
            },
        }
        async with httpx.AsyncClient(timeout=self.settings.llm_timeout_s) as client:
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
        url = f"{GEMINI_BASE}/models/{self.settings.gemini_embed_model}:batchEmbedContents"
        out: list[list[float]] = []
        async with httpx.AsyncClient(timeout=EMBED_TIMEOUT_S) as client:
            for i in range(0, len(texts), batch):
                reqs = [{"model": f"models/{self.settings.gemini_embed_model}",
                         "content": {"parts": [{"text": t[:EMBED_MAX_CHARS]}]},
                         "taskType": task,
                         "outputDimensionality": self.settings.embed_dim} for t in texts[i:i + batch]]
                for attempt in range(EMBED_RATE_LIMIT_RETRIES):
                    r = await client.post(url, headers=self._headers(), json={"requests": reqs})
                    if r.status_code == 429:
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
        self.settings = settings
        if not settings.groq_api_key:
            raise LLMError("Brak GROQ_API_KEY")

    async def generate_json(self, system: str, user: str) -> dict:
        body = {
            "model": self.settings.groq_model,
            "temperature": TEMPERATURE,
            "max_tokens": MAX_OUTPUT_TOKENS,
            "response_format": {"type": "json_object"},
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
        }
        headers = {"Authorization": f"Bearer {self.settings.groq_api_key}"}
        async with httpx.AsyncClient(timeout=self.settings.llm_timeout_s) as client:
            r = await client.post(GROQ_URL, headers=headers, json=body)
        if r.status_code != 200:
            raise LLMError(f"Groq HTTP {r.status_code}: {r.text[:300]}")
        return parse_json_loose(r.json()["choices"][0]["message"]["content"])


class FallbackLLM:

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
            except Exception as exc:  # noqa: BLE001
                log.warning("LLM %s niedostępny: %s", c.name, type(exc).__name__)
                errors.append(f"{c.name}: {exc}")
        raise LLMError("; ".join(errors))


def build_llm(settings: RagSettings) -> FallbackLLM | None:
    clients: list[JsonLLM] = []
    for cls in (GeminiClient, GroqClient):
        try:
            clients.append(cls(settings))
        except LLMError:
            pass
    return FallbackLLM(clients) if clients else None

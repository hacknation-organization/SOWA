from __future__ import annotations

import asyncio
import json
import logging
import re
from typing import Protocol

import anthropic
import httpx

from .config import RagSettings
from .prompts import RESPONSE_SCHEMA

log = logging.getLogger("app.rag.llm")

GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta"
GROQ_BASE = "https://api.groq.com/openai/v1"
OPENROUTER_BASE = "https://openrouter.ai/api/v1"
TEMPERATURE = 0.1
MAX_OUTPUT_TOKENS = 2048
EMBED_TIMEOUT_S = 60
EMBED_MAX_CHARS = 8000
EMBED_RATE_LIMIT_RETRIES = 5
ANTHROPIC_MAX_TOKENS = 16000  # obejmuje też tokeny myślenia
ANTHROPIC_MIN_TIMEOUT_S = 120
# modele z serwerowym przełączeniem po odmowie (fallbacks: "default")
ANTHROPIC_FALLBACK_MODELS = {"claude-fable-5-1", "claude-opus-5-5", "claude-opus-5", "claude-sonnet-5-5"}
ANTHROPIC_FALLBACK_BETA = "server-side-fallback-2026-07-01"

PROVIDERS = ("gemini", "anthropic", "groq", "openai", "openrouter", "ollama")
DEFAULT_ANTHROPIC_MODEL = "claude-opus-5-5"


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

    def __init__(self, settings: RagSettings, model: str | None = None):
        self.settings = settings
        self.model = model or settings.gemini_model
        if not settings.gemini_api_key:
            raise LLMError("Brak GEMINI_API_KEY")

    def _headers(self) -> dict:
        return {"x-goog-api-key": self.settings.gemini_api_key, "Content-Type": "application/json"}

    async def generate_json(self, system: str, user: str) -> dict:
        url = f"{GEMINI_BASE}/models/{self.model}:generateContent"
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


class OpenAICompatClient:
    """Dostawcy z API zgodnym z OpenAI Chat Completions: Groq, OpenAI, OpenRouter, Ollama."""

    def __init__(self, name: str, base_url: str, api_key: str, model: str, timeout_s: float):
        self.name = name
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.model = model
        self.timeout_s = timeout_s

    async def generate_json(self, system: str, user: str) -> dict:
        body = {
            "model": self.model,
            "temperature": TEMPERATURE,
            "max_tokens": MAX_OUTPUT_TOKENS,
            "response_format": {"type": "json_object"},
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
        }
        headers = {"Authorization": f"Bearer {self.api_key}"} if self.api_key else {}
        async with httpx.AsyncClient(timeout=self.timeout_s) as client:
            r = await client.post(f"{self.base_url}/chat/completions", headers=headers, json=body)
        if r.status_code != 200:
            raise LLMError(f"{self.name} HTTP {r.status_code}: {r.text[:300]}")
        return parse_json_loose(r.json()["choices"][0]["message"]["content"])


class AnthropicClient:
    name = "anthropic"

    def __init__(self, settings: RagSettings, model: str):
        if not settings.anthropic_api_key:
            raise LLMError("Brak ANTHROPIC_API_KEY")
        self.model = model
        self.effort = settings.anthropic_effort or None
        self.client = anthropic.AsyncAnthropic(
            api_key=settings.anthropic_api_key,
            timeout=max(settings.llm_timeout_s, ANTHROPIC_MIN_TIMEOUT_S),
        )

    async def generate_json(self, system: str, user: str) -> dict:
        schema = {**RESPONSE_SCHEMA, "additionalProperties": False}
        output_config: dict = {"format": {"type": "json_schema", "schema": schema}}
        if self.effort:
            output_config["effort"] = self.effort
        extra: dict = {}
        if self.model in ANTHROPIC_FALLBACK_MODELS:
            extra = {"betas": [ANTHROPIC_FALLBACK_BETA], "fallbacks": "default"}
        try:
            response = await self.client.beta.messages.create(
                model=self.model,
                max_tokens=ANTHROPIC_MAX_TOKENS,
                system=system,
                messages=[{"role": "user", "content": user}],
                output_config=output_config,
                **extra,
            )
        except anthropic.APIStatusError as exc:
            raise LLMError(f"Anthropic HTTP {exc.status_code}: {exc.message[:300]}") from exc
        except anthropic.APIConnectionError as exc:
            raise LLMError(f"Anthropic: brak połączenia ({exc})") from exc
        if response.stop_reason == "refusal":
            category = response.stop_details.category if response.stop_details else None
            raise LLMError(f"Anthropic odmówił odpowiedzi (kategoria: {category})")
        if response.stop_reason == "max_tokens":
            raise LLMError("Anthropic: odpowiedź ucięta (max_tokens)")
        text = next((b.text for b in response.content if b.type == "text"), "")
        return parse_json_loose(text)


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
                log.warning("LLM %s niedostępny: %s: %s", c.name, type(exc).__name__, exc)
                errors.append(f"{c.name}: {exc}")
        raise LLMError("; ".join(errors))


def parse_chain(spec: str) -> list[tuple[str, str]]:
    """'anthropic:claude-opus-5-5, groq:llama-3.3-70b-versatile' -> [(dostawca, model), ...]"""
    chain = []
    for item in filter(None, (x.strip() for x in spec.split(","))):
        provider, _, model = item.partition(":")
        provider = provider.strip().lower()
        if provider not in PROVIDERS:
            raise LLMError(f"Nieznany dostawca LLM '{provider}' (dostępni: {', '.join(PROVIDERS)})")
        chain.append((provider, model.strip()))
    return chain


def make_client(settings: RagSettings, provider: str, model: str = "") -> JsonLLM:
    timeout = settings.llm_timeout_s
    if provider == "gemini":
        return GeminiClient(settings, model or None)
    if provider == "anthropic":
        return AnthropicClient(settings, model or DEFAULT_ANTHROPIC_MODEL)
    if provider == "groq":
        if not settings.groq_api_key:
            raise LLMError("Brak GROQ_API_KEY")
        return OpenAICompatClient("groq", GROQ_BASE, settings.groq_api_key, model or settings.groq_model, timeout)
    if not model:
        raise LLMError(f"Dla dostawcy {provider} podaj model, np. {provider}:<nazwa-modelu>")
    if provider == "openai":
        if not settings.openai_api_key:
            raise LLMError("Brak OPENAI_API_KEY")
        return OpenAICompatClient("openai", settings.openai_base_url, settings.openai_api_key, model, timeout)
    if provider == "openrouter":
        if not settings.openrouter_api_key:
            raise LLMError("Brak OPENROUTER_API_KEY")
        return OpenAICompatClient("openrouter", OPENROUTER_BASE, settings.openrouter_api_key, model, timeout)
    return OpenAICompatClient("ollama", settings.ollama_base_url, "", model, timeout)


def build_llm(settings: RagSettings) -> FallbackLLM | None:
    """RAG_LLM ustala dostawców i ich kolejność; bez niej: Gemini, zapasowo Groq (jeśli są klucze)."""
    chain = parse_chain(settings.llm_chain) if settings.llm_chain else [("gemini", ""), ("groq", "")]
    clients: list[JsonLLM] = []
    for provider, model in chain:
        try:
            clients.append(make_client(settings, provider, model))
        except LLMError as exc:
            if settings.llm_chain:
                log.warning("LLM %s pominięty: %s", provider, exc)
    if clients:
        log.info("Łańcuch LLM: %s", " -> ".join(f"{c.name}:{getattr(c, 'model', '')}" for c in clients))
    return FallbackLLM(clients) if clients else None

import asyncio
import dataclasses
from types import SimpleNamespace

import pytest

from app.rag.config import RagSettings
from app.rag.llm import AnthropicClient, GeminiClient, LLMError, OpenAICompatClient, build_llm, parse_chain

KEYS = ("gemini_api_key", "groq_api_key", "anthropic_api_key", "openai_api_key", "openrouter_api_key")


def settings(**overrides) -> RagSettings:
    """Ustawienia niezależne od lokalnego .env: bez kluczy i bez RAG_LLM, chyba że test je poda."""
    return dataclasses.replace(RagSettings.from_env(), **{**dict.fromkeys(KEYS, ""), "llm_chain": "", **overrides})


def test_parse_chain():
    assert parse_chain("anthropic:claude-opus-5-5, groq , ollama:bielik") == [
        ("anthropic", "claude-opus-5-5"), ("groq", ""), ("ollama", "bielik")]
    with pytest.raises(LLMError):
        parse_chain("nieznany:model")


def test_build_llm_from_chain_skips_providers_without_keys():
    s = settings(llm_chain="anthropic:claude-opus-5-5,groq:llama-3.3-70b-versatile,ollama:bielik",
                 anthropic_api_key="sk-test", groq_api_key="")
    llm = build_llm(s)
    assert [type(c) for c in llm.clients] == [AnthropicClient, OpenAICompatClient]
    assert llm.clients[0].model == "claude-opus-5-5"
    assert llm.clients[1].name == "ollama" and llm.clients[1].model == "bielik"


def test_default_chain_is_gemini_then_groq():
    llm = build_llm(settings(gemini_api_key="g", groq_api_key="q"))
    assert [type(c) for c in llm.clients] == [GeminiClient, OpenAICompatClient]
    assert build_llm(settings()) is None


def test_openai_compatible_requires_model():
    s = settings(llm_chain="openrouter", openrouter_api_key="k")
    assert build_llm(s) is None


class FakeMessages:
    def __init__(self, response):
        self.response, self.kwargs = response, None

    async def create(self, **kwargs):
        self.kwargs = kwargs
        return self.response


def anthropic_with(response, model="claude-opus-5-5"):
    client = AnthropicClient(settings(anthropic_api_key="sk-test"), model)
    fake = FakeMessages(response)
    client.client = SimpleNamespace(beta=SimpleNamespace(messages=fake))
    return client, fake


def test_anthropic_request_and_json_parsing():
    resp = SimpleNamespace(stop_reason="end_turn", stop_details=None,
                           content=[SimpleNamespace(type="text", text='{"status":"ok","answer":"A [1]"}')])
    client, fake = anthropic_with(resp)
    out = asyncio.run(client.generate_json("sys", "pytanie"))
    assert out == {"status": "ok", "answer": "A [1]"}
    assert fake.kwargs["model"] == "claude-opus-5-5"
    assert fake.kwargs["fallbacks"] == "default"
    assert fake.kwargs["output_config"]["format"]["schema"]["additionalProperties"] is False
    assert "temperature" not in fake.kwargs and "thinking" not in fake.kwargs


def test_anthropic_refusal_raises_so_chain_falls_back():
    resp = SimpleNamespace(stop_reason="refusal", stop_details=SimpleNamespace(category="cyber"), content=[])
    client, _ = anthropic_with(resp, model="claude-haiku-5-5")
    with pytest.raises(LLMError):
        asyncio.run(client.generate_json("sys", "pytanie"))

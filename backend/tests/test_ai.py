import os
from types import SimpleNamespace

import pytest
from pydantic import BaseModel

import ai


def test_client_targets_openrouter_with_the_env_key(monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    c = ai.client()
    assert str(c.base_url).startswith("https://openrouter.ai/api/v1")
    assert c.api_key == "test-key"


def test_client_requires_the_key(monkeypatch):
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    with pytest.raises(KeyError):
        ai.client()


def test_ask_sends_model_and_messages_and_returns_the_reply(monkeypatch):
    calls = []

    def create(**kwargs):
        calls.append(kwargs)
        return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content="4"))])

    fake = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create)))
    monkeypatch.setattr(ai, "client", lambda: fake)
    messages = [{"role": "user", "content": "What is 2+2?"}]
    assert ai.ask(messages) == "4"
    assert calls == [{"model": "nvidia/nemotron-3.5-super-vl:free", "messages": messages}]


def test_ask_with_a_schema_requests_strict_structured_output(monkeypatch):
    calls = []

    def create(**kwargs):
        calls.append(kwargs)
        return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content="{}"))])

    fake = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create)))
    monkeypatch.setattr(ai, "client", lambda: fake)
    class Reply(BaseModel):
        message: str

    ai.ask([], Reply)
    format_ = calls[0]["response_format"]
    assert format_["type"] == "json_schema"
    assert format_["json_schema"]["strict"] is True
    assert format_["json_schema"]["name"] == "Reply"
    assert format_["json_schema"]["schema"]["required"] == ["message"]


@pytest.mark.skipif(not os.environ.get("OPENROUTER_API_KEY"), reason="OPENROUTER_API_KEY not set")
def test_live_openrouter_answers_2_plus_2():
    reply = ai.ask([{"role": "user", "content": "What is 2+2? Answer with just the number."}])
    assert "4" in reply

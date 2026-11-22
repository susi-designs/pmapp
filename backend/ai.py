import os

from openai import OpenAI
from pydantic import BaseModel

MODEL = "nvidia/nemotron-3.5-super-vl:free"


def client() -> OpenAI:
    return OpenAI(base_url="https://openrouter.ai/api/v1", api_key=os.environ["OPENROUTER_API_KEY"])


def ask(messages: list[dict], schema: type[BaseModel] | None = None) -> str:
    """Return the model's reply. With a schema, the reply is JSON matching it (Structured Outputs)."""
    extra = {}
    if schema:
        extra["response_format"] = {
            "type": "json_schema",
            "json_schema": {"name": schema.__name__, "strict": True, "schema": schema.model_json_schema()},
        }
    response = client().chat.completions.create(model=MODEL, messages=messages, **extra)
    return response.choices[0].message.content

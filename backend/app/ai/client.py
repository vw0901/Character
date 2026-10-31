from collections.abc import AsyncIterator, Sequence

import httpx
from openai import AsyncOpenAI

from app.ai.resolve import ResolvedAiConfig
from app.ai.url import models_url
from app.schemas import ChatMessage


_USER_AGENT = "novel-ai/1.0"


def _create_client(config: ResolvedAiConfig) -> AsyncOpenAI:
    return AsyncOpenAI(
        base_url=config.base_url,
        api_key=config.api_key or "sk-local",
        timeout=config.timeout,
        default_headers={"User-Agent": _USER_AGENT},
    )


def _message_dicts(messages: Sequence[ChatMessage]) -> list[dict[str, str]]:
    return [{"role": message.role, "content": message.content} for message in messages]


def _completion_text(response: object) -> str:
    choices = getattr(response, "choices", None) or []
    if not choices:
        return ""
    message = getattr(choices[0], "message", None)
    content = getattr(message, "content", None)
    return content if isinstance(content, str) else ""


async def stream_chat(
    config: ResolvedAiConfig,
    messages: Sequence[ChatMessage],
    *,
    temperature: float = 0.7,
) -> AsyncIterator[str]:
    client = _create_client(config)
    emitted = False
    try:
        try:
            stream = await client.chat.completions.create(
                model=config.model,
                messages=_message_dicts(messages),
                temperature=temperature,
                stream=True,
            )
            async for chunk in stream:
                if not chunk.choices:
                    continue
                content = getattr(chunk.choices[0].delta, "content", None)
                if content:
                    emitted = True
                    yield content
        except Exception:
            if emitted:
                raise
            response = await client.chat.completions.create(
                model=config.model,
                messages=_message_dicts(messages),
                temperature=temperature,
                stream=False,
            )
            text = _completion_text(response)
            if text:
                yield text
    finally:
        await client.close()


async def chat_once(
    config: ResolvedAiConfig,
    messages: Sequence[ChatMessage],
    *,
    temperature: float = 0.3,
    max_tokens: int | None = None,
) -> str:
    client = _create_client(config)
    try:
        response = await client.chat.completions.create(
            model=config.model,
            messages=_message_dicts(messages),
            temperature=temperature,
            max_tokens=max_tokens,
            stream=False,
        )
        return _completion_text(response)
    finally:
        await client.close()


async def list_models(config: ResolvedAiConfig) -> list[str]:
    headers = {
        "Authorization": f"Bearer {config.api_key or 'sk-local'}",
        "User-Agent": _USER_AGENT,
    }
    async with httpx.AsyncClient(timeout=min(config.timeout, 60.0)) as client:
        response = await client.get(models_url(config.base_url), headers=headers)
        response.raise_for_status()
        payload = response.json()

    raw_models = payload.get("data", payload.get("models", [])) if isinstance(payload, dict) else []
    if not isinstance(raw_models, list):
        raise ValueError("AI 服务返回的模型列表格式无效")

    models: list[str] = []
    for item in raw_models:
        if isinstance(item, str):
            models.append(item)
        elif isinstance(item, dict) and isinstance(item.get("id"), str):
            models.append(item["id"])
    return models

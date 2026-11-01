from collections.abc import AsyncIterator, Sequence
from typing import Any

import httpx
from openai import (
    AsyncOpenAI,
    AuthenticationError,
    BadRequestError,
    PermissionDeniedError,
    RateLimitError,
)

from app.ai.resolve import ResolvedAiConfig
from app.ai.url import models_url
from app.schemas import ChatMessage


_USER_AGENT = "novel-ai/1.0"

# SDK 自带指数退避重试，这里显式写出来，避免默认值随版本变化。
MAX_RETRIES = 2
# 连接阶段不应该等满整个读超时：地址写错时要尽快报错。
CONNECT_TIMEOUT = 10.0

# 这些错误重试或回退都没有意义，直接抛给上层转成可读文案。
_NO_FALLBACK = (AuthenticationError, PermissionDeniedError, RateLimitError)


def _timeout(config: ResolvedAiConfig) -> httpx.Timeout:
    return httpx.Timeout(
        config.timeout,
        connect=min(CONNECT_TIMEOUT, config.timeout),
    )


def _create_client(config: ResolvedAiConfig) -> AsyncOpenAI:
    return AsyncOpenAI(
        base_url=config.base_url,
        api_key=config.api_key or "sk-local",
        timeout=_timeout(config),
        max_retries=MAX_RETRIES,
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


def _request_options(
    model: str,
    messages: Sequence[ChatMessage],
    temperature: float,
    max_tokens: int | None,
    stream: bool,
) -> dict[str, Any]:
    options: dict[str, Any] = {
        "model": model,
        "messages": _message_dicts(messages),
        "temperature": temperature,
        "stream": stream,
    }
    if max_tokens and max_tokens > 0:
        options["max_tokens"] = max_tokens
    return options


async def _create_completion(client: AsyncOpenAI, options: dict[str, Any]) -> Any:
    """个别模型（如 o 系列）不接受 max_tokens，退回不带该参数的请求。"""
    try:
        return await client.chat.completions.create(**options)
    except BadRequestError as exc:
        if "max_tokens" not in options or "max_tokens" not in str(exc).lower():
            raise
        retry_options = {key: value for key, value in options.items() if key != "max_tokens"}
        return await client.chat.completions.create(**retry_options)


async def stream_chat(
    config: ResolvedAiConfig,
    messages: Sequence[ChatMessage],
    *,
    temperature: float = 0.7,
    max_tokens: int | None = None,
) -> AsyncIterator[str]:
    client = _create_client(config)
    emitted = False
    try:
        try:
            stream = await _create_completion(
                client,
                _request_options(config.model, messages, temperature, max_tokens, True),
            )
            async for chunk in stream:
                if not chunk.choices:
                    continue
                content = getattr(chunk.choices[0].delta, "content", None)
                if content:
                    emitted = True
                    yield content
        except Exception as exc:
            # 鉴权/额度类错误重试同样的请求只会再失败一次，直接上报。
            if emitted or isinstance(exc, _NO_FALLBACK):
                raise
            # 部分兼容接口不支持流式：退回一次性请求，别让整轮冒险失败。
            response = await _create_completion(
                client,
                _request_options(config.model, messages, temperature, max_tokens, False),
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
        response = await _create_completion(
            client,
            _request_options(config.model, messages, temperature, max_tokens, False),
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

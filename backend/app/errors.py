import httpx
from openai import (
    APIConnectionError,
    APIStatusError,
    APITimeoutError,
    AuthenticationError,
    BadRequestError,
    NotFoundError,
    PermissionDeniedError,
    RateLimitError,
)


NOT_CONFIGURED_MESSAGE = "尚未配置 AI 服务，请先在「AI 设置」中添加 API 与模型"


class AIConfigurationError(Exception):
    pass


def get_ai_error_message(exc: Exception, fallback: str) -> str:
    if isinstance(exc, AIConfigurationError):
        return str(exc)
    if isinstance(exc, APITimeoutError):
        return "AI 服务响应超时，请稍后重试"
    if isinstance(exc, AuthenticationError):
        return "AI 服务鉴权失败，请检查 API Key"
    if isinstance(exc, PermissionDeniedError):
        return "AI 服务拒绝访问，请检查 API Key 的权限或额度"
    if isinstance(exc, NotFoundError):
        return "AI 服务地址或模型不存在，请检查 Base URL 与模型名称"
    if isinstance(exc, RateLimitError):
        return "AI 服务请求过于频繁或额度不足，请稍后再试"
    if isinstance(exc, BadRequestError):
        return "AI 服务拒绝了请求，请检查 Base URL、模型名称与参数"
    if isinstance(exc, APIConnectionError):
        return "无法连接到 AI 服务，请检查 Base URL 或网络设置"
    if isinstance(exc, httpx.ConnectError):
        return "无法连接到 AI 服务，请检查 Base URL 或网络设置"
    if isinstance(exc, httpx.TimeoutException):
        return "AI 服务响应超时，请稍后重试"
    if isinstance(exc, httpx.HTTPStatusError):
        status = exc.response.status_code
        if status in (401, 403):
            return "AI 服务鉴权失败，请检查 API Key"
        if status == 404:
            return "AI 服务地址或模型不存在，请检查 Base URL 与模型名称"
        if status == 429:
            return "AI 服务请求过于频繁或额度不足，请稍后再试"
        return f"{fallback}（AI 服务返回 {status}）"
    if isinstance(exc, APIStatusError):
        status = exc.status_code
        if status in (401, 403):
            return "AI 服务鉴权失败，请检查 API Key"
        if status == 404:
            return "AI 服务地址或模型不存在，请检查 Base URL 与模型名称"
        if status == 429:
            return "AI 服务请求过于频繁或额度不足，请稍后再试"
        return f"{fallback}（AI 服务返回 {status}）"
    if isinstance(exc, ValueError):
        return str(exc)
    # 未知异常一律只返回通用文案：底层异常信息可能包含请求地址、响应片段
    # 甚至被服务端回显的凭据，不应透传给前端。
    return fallback

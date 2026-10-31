from dataclasses import dataclass

from app.ai.url import normalize_base_url
from app.config import get_env
from app.errors import AIConfigurationError, NOT_CONFIGURED_MESSAGE
from app.schemas import AiConfig


DEFAULT_TIMEOUT = 300.0


@dataclass(frozen=True)
class ResolvedAiConfig:
    base_url: str
    api_key: str
    model: str
    timeout: float
    search_provider: str
    tavily_api_key: str


def _clean(value: str | None) -> str:
    return value.strip() if value and value.strip() else ""


def _timeout(value: float | None) -> float:
    if value is not None and value > 0:
        return float(value)
    raw = get_env("AI_TIMEOUT")
    if raw:
        try:
            parsed = float(raw)
            if parsed > 0:
                return parsed
        except ValueError:
            pass
    return DEFAULT_TIMEOUT


def resolve_ai_config(
    config: AiConfig | dict | None,
    *,
    require_model: bool = True,
) -> ResolvedAiConfig:
    cfg = config if isinstance(config, AiConfig) else AiConfig.model_validate(config or {})

    base_url = _clean(cfg.base_url) or get_env("OPENAI_BASE_URL", "AI_BASE_URL")
    model = _clean(cfg.model) or get_env("OPENAI_MODEL", "AI_MODEL")
    api_key = _clean(cfg.api_key) or get_env("OPENAI_API_KEY", "AI_API_KEY")
    search_provider = (_clean(cfg.search_provider) or get_env("AI_SEARCH_PROVIDER", default="none")).lower()
    tavily_api_key = _clean(cfg.tavily_api_key) or get_env("TAVILY_API_KEY")

    if not base_url or (require_model and not model):
        raise AIConfigurationError(NOT_CONFIGURED_MESSAGE)

    try:
        normalized_base_url = normalize_base_url(base_url)
    except ValueError as exc:
        raise AIConfigurationError(str(exc)) from exc

    return ResolvedAiConfig(
        base_url=normalized_base_url,
        api_key=api_key,
        model=model,
        timeout=_timeout(cfg.timeout),
        search_provider=search_provider,
        tavily_api_key=tavily_api_key,
    )

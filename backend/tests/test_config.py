import pytest

from app.ai.resolve import resolve_ai_config
from app.ai.url import completions_url, models_url, normalize_base_url
from app.errors import AIConfigurationError, NOT_CONFIGURED_MESSAGE
from app.schemas import AiConfig


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("https://api.openai.com", "https://api.openai.com/v1"),
        ("https://api.openai.com/", "https://api.openai.com/v1"),
        ("https://api.openai.com/v1/", "https://api.openai.com/v1"),
        (
            "https://api.openai.com/v1/chat/completions",
            "https://api.openai.com/v1",
        ),
        (
            "https://ark.cn-beijing.volces.com/api/v3",
            "https://ark.cn-beijing.volces.com/api/v3",
        ),
        (
            "https://open.bigmodel.cn/api/paas/v4/",
            "https://open.bigmodel.cn/api/paas/v4",
        ),
        ("http://localhost:11434", "http://localhost:11434/v1"),
        ("http://localhost:11434/v1/models", "http://localhost:11434/v1"),
        (
            "https://dashscope.aliyuncs.com/compatible-mode/v1",
            "https://dashscope.aliyuncs.com/compatible-mode/v1",
        ),
    ],
)
def test_normalize_base_url(raw: str, expected: str) -> None:
    assert normalize_base_url(raw) == expected


def test_url_helpers() -> None:
    assert completions_url("http://localhost:11434") == (
        "http://localhost:11434/v1/chat/completions"
    )
    assert models_url("http://localhost:11434") == "http://localhost:11434/v1/models"


@pytest.mark.parametrize("raw", ["", "   ", "localhost:11434/v1", "ftp://example.com"])
def test_invalid_base_url(raw: str) -> None:
    with pytest.raises(ValueError):
        normalize_base_url(raw)


def test_body_config_overrides_environment() -> None:
    resolved = resolve_ai_config(
        AiConfig(
            baseUrl="https://example.com",
            apiKey="body-key",
            model="body-model",
            timeout=12,
            searchProvider="tavily",
            tavilyApiKey="tvly-test",
        )
    )
    assert resolved.base_url == "https://example.com/v1"
    assert resolved.api_key == "body-key"
    assert resolved.model == "body-model"
    assert resolved.timeout == 12
    assert resolved.search_provider == "tavily"
    assert resolved.tavily_api_key == "tvly-test"


def test_environment_fallback(mock_server: str) -> None:
    resolved = resolve_ai_config(None)
    assert resolved.base_url == mock_server
    assert resolved.api_key == "mock-key"
    assert resolved.model == "mock-chat"


def test_missing_config(monkeypatch: pytest.MonkeyPatch) -> None:
    for name in (
        "OPENAI_BASE_URL",
        "AI_BASE_URL",
        "OPENAI_MODEL",
        "AI_MODEL",
        "OPENAI_API_KEY",
        "AI_API_KEY",
    ):
        monkeypatch.setenv(name, "")
    with pytest.raises(AIConfigurationError) as exc_info:
        resolve_ai_config(None)
    assert str(exc_info.value) == NOT_CONFIGURED_MESSAGE


def test_models_config_does_not_require_model(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("OPENAI_MODEL", "")
    resolved = resolve_ai_config(None, require_model=False)
    assert resolved.model == ""

import re
from urllib.parse import urlsplit, urlunsplit


_VERSION_SEGMENT = re.compile(r"(?i)(?:^|/)v\d+(?:beta|alpha)?(?:/|$)")
_ENDPOINT_SUFFIXES = ("/chat/completions", "/completions", "/models")


def normalize_base_url(raw: str) -> str:
    value = (raw or "").strip().rstrip("/")
    if not value:
        raise ValueError("Base URL 不能为空")

    parsed = urlsplit(value)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        raise ValueError("Base URL 必须是以 http:// 或 https:// 开头的完整地址")
    if parsed.query or parsed.fragment:
        raise ValueError("Base URL 不能包含查询参数或片段")

    path = parsed.path.rstrip("/")
    for suffix in _ENDPOINT_SUFFIXES:
        if path.lower().endswith(suffix):
            path = path[: -len(suffix)].rstrip("/")
            break

    if not path:
        path = "/v1"
    elif not _VERSION_SEGMENT.search(path):
        path = f"{path}/v1"

    return urlunsplit((parsed.scheme, parsed.netloc, path, "", ""))


def completions_url(base_url: str) -> str:
    return f"{normalize_base_url(base_url)}/chat/completions"


def models_url(base_url: str) -> str:
    return f"{normalize_base_url(base_url)}/models"

import json

from app.ai.json_utils import extract_json_object, strip_code_fences
from app.ai.sse import SSE_HEADERS, sse_data, sse_error


def test_sse_data_format() -> None:
    payload = sse_data("你好\n世界")
    assert payload.startswith("data: ")
    assert payload.endswith("\n\n")
    parsed = json.loads(payload.removeprefix("data: ").strip())
    assert parsed == {"text": "你好\n世界"}
    assert payload.count("\n") == 2


def test_sse_error_format() -> None:
    payload = sse_error("服务不可用")
    parsed = json.loads(payload.removeprefix("data: ").strip())
    assert parsed == {"error": "服务不可用"}


def test_sse_headers() -> None:
    assert SSE_HEADERS["Cache-Control"] == "no-cache, no-transform"
    assert SSE_HEADERS["X-Accel-Buffering"] == "no"
    assert SSE_HEADERS["Connection"] == "keep-alive"


def test_json_utils_removes_fences() -> None:
    assert strip_code_fences('```json\n{"a": 1}\n```') == '{"a": 1}'
    assert extract_json_object('前言\n```json\n{"summary": "内容"}\n```\n后记') == {
        "summary": "内容"
    }
    assert extract_json_object("not json") is None

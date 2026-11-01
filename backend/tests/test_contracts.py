import json
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.errors import NOT_CONFIGURED_MESSAGE


BIBLE = {
    "novelName": "测试小说",
    "worldview": {"summary": "测试世界观"},
    "characters": [{"name": "林澈", "abilities": "剑术"}],
}
CHARACTER = {
    "mode": "existing",
    "name": "林澈",
    "background": "游侠",
    "abilities": "剑术",
    "personality": "谨慎",
}
GAME_STATE = {
    "currentScene": {
        "id": "scene_1",
        "location": "古桥",
        "description": "雨幕中断桥横陈。",
        "choices": [{"id": "choice_1", "text": "过桥"}],
    },
    "stats": {"health": 95, "power": 50, "reputation": 45},
}


def sse_payloads(response: Any) -> list[dict[str, Any]]:
    payloads: list[dict[str, Any]] = []
    for line in response.text.splitlines():
        if not line.startswith("data: "):
            continue
        raw = line[6:]
        if raw == "[DONE]":
            continue
        payloads.append(json.loads(raw))
    return payloads


def sse_text(response: Any) -> str:
    return "".join(
        payload["text"] for payload in sse_payloads(response) if "text" in payload
    )


def clear_ai_env(monkeypatch: pytest.MonkeyPatch) -> None:
    for name in (
        "OPENAI_BASE_URL",
        "AI_BASE_URL",
        "OPENAI_MODEL",
        "AI_MODEL",
        "OPENAI_API_KEY",
        "AI_API_KEY",
    ):
        monkeypatch.setenv(name, "")


def test_health(client: TestClient) -> None:
    response = client.get("/healthz")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_models_from_environment(client: TestClient) -> None:
    response = client.post("/api/models", json={})
    assert response.status_code == 200
    assert response.json()["models"] == ["mock-chat", "mock-reasoner"]


def test_models_missing_base_url(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    clear_ai_env(monkeypatch)
    response = client.post("/api/models", json={})
    assert response.status_code == 400
    assert response.json()["error"] == NOT_CONFIGURED_MESSAGE


def test_models_auth_error(client: TestClient, mock_server: str) -> None:
    response = client.post(
        "/api/models",
        json={
            "aiConfig": {
                "baseUrl": mock_server,
                "apiKey": "bad",
            }
        },
    )
    assert response.status_code == 502
    assert response.json()["error"] == "AI 服务鉴权失败，请检查 API Key"


def test_ai_test_success(client: TestClient) -> None:
    response = client.post("/api/ai/test", json={})
    assert response.status_code == 200
    payload = response.json()
    assert payload["ok"] is True
    assert payload["reply"] == "连接成功"
    assert payload["model"] == "mock-chat"


def test_ai_test_auth_error(client: TestClient, mock_server: str) -> None:
    response = client.post(
        "/api/ai/test",
        json={
            "aiConfig": {
                "baseUrl": mock_server,
                "apiKey": "bad",
                "model": "mock-chat",
            }
        },
    )
    assert response.status_code == 502
    payload = response.json()
    assert payload["ok"] is False
    assert payload["error"] == "AI 服务鉴权失败，请检查 API Key"


def test_search_validates_name(client: TestClient) -> None:
    response = client.post("/api/search", json={"novelName": "   "})
    assert response.status_code == 400
    assert response.json()["error"] == "请提供小说名称"

    missing = client.post("/api/search", json={})
    assert missing.status_code == 400


def test_search_uses_model_fallback(client: TestClient) -> None:
    response = client.post("/api/search", json={"novelName": "测试小说"})
    assert response.status_code == 200
    payload = response.json()
    assert payload["novelName"] == "测试小说"
    assert "测试作者" in payload["summary"]
    assert payload["results"] == []


def test_search_unconfigured(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    clear_ai_env(monkeypatch)
    response = client.post("/api/search", json={"novelName": "测试小说"})
    assert response.status_code == 502
    assert response.json()["error"] == NOT_CONFIGURED_MESSAGE


def test_bible_sse_contract(client: TestClient) -> None:
    response = client.post(
        "/api/bible",
        json={
            "novelName": "测试小说",
            "searchResults": [
                {"title": "条目", "url": "https://example.com", "snippet": "摘要"}
            ],
            "searchSummary": "检索摘要",
        },
    )
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    assert response.headers["cache-control"] == "no-cache, no-transform"
    assert response.text.rstrip().endswith("data: [DONE]")
    payload = json.loads(sse_text(response))
    assert payload["novelName"] == "测试小说"


def test_check_sse_contract(client: TestClient) -> None:
    response = client.post("/api/check", json={"bible": BIBLE})
    assert response.status_code == 200
    assert response.text.rstrip().endswith("data: [DONE]")
    payload = json.loads(sse_text(response))
    assert payload["overallScore"] == 82


def test_game_sse_contract(client: TestClient) -> None:
    response = client.post(
        "/api/game",
        json={"bible": BIBLE, "characterChoice": CHARACTER},
    )
    assert response.status_code == 200
    assert response.text.rstrip().endswith("data: [DONE]")
    payload = json.loads(sse_text(response))
    assert payload["title"] == "测试冒险"
    assert payload["currentScene"]["choices"]
    assert payload["finalGoal"]["title"] == "在血月前找到失踪的妹妹"
    assert payload["timeline"]["totalDays"] == 20
    assert payload["timeline"]["currentDay"] == 1


def test_game_action_sse_contract(client: TestClient) -> None:
    response = client.post(
        "/api/game/action",
        json={
            "bible": BIBLE,
            "gameState": GAME_STATE,
            "choiceId": "choice_1",
            "choiceText": "过桥",
            "history": [{"type": "narration", "text": "雨夜里你来到桥边。"}],
            "characterChoice": CHARACTER,
        },
    )
    assert response.status_code == 200
    assert response.text.rstrip().endswith("data: [DONE]")
    payload = json.loads(sse_text(response))
    assert payload["currentScene"]["id"] == "scene_2"
    assert payload["isEnding"] is False
    assert payload["daysPassed"] == 1
    assert payload["goalAchieved"] is False


def test_game_goal_check_contract(client: TestClient) -> None:
    response = client.post(
        "/api/game/goal-check",
        json={
            "goal": {"title": "找到妹妹", "description": "在血月前带她离开古桥"},
            "narration": "你踏上湿滑的石桥，桥心站着一个戴斗笠的人。",
            "scene": {"location": "桥心", "description": "河风卷起水雾。"},
            "history": [{"type": "choice", "text": "过桥"}],
        },
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["ok"] is True
    assert payload["achieved"] is False
    assert payload["confidence"] in {"high", "medium", "low"}


def test_game_goal_check_detects_success(client: TestClient) -> None:
    response = client.post(
        "/api/game/goal-check",
        json={
            "goal": {"title": "找到妹妹", "description": "在血月前带她离开古桥"},
            "narration": "你成功在血月升起前找到妹妹，并带着她离开了古桥。",
        },
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["ok"] is True
    assert payload["achieved"] is True


def test_game_goal_check_requires_content(client: TestClient) -> None:
    response = client.post(
        "/api/game/goal-check",
        json={"goal": {"title": "找到妹妹"}, "narration": "   "},
    )
    assert response.status_code == 400
    assert response.json()["error"]


def test_game_epilogue_sse_contract(client: TestClient) -> None:
    response = client.post(
        "/api/game/epilogue",
        json={
            "bible": BIBLE,
            "characterChoice": CHARACTER,
            "goal": {"title": "找到妹妹", "description": "在血月前带她离开古桥"},
            "timeline": {"label": "血月降临前", "totalDays": 20, "currentDay": 18},
            "outcome": "success",
            "outcomeReason": "达成最终目标：找到妹妹",
            "endingText": "你们在血月升起前离开了古桥。",
            "history": [
                {"type": "choice", "text": "过桥"},
                {"type": "narration", "text": "你终于在桥下找到了妹妹。"},
            ],
        },
    )
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    assert response.headers["cache-control"] == "no-cache, no-transform"
    assert response.text.rstrip().endswith("data: [DONE]")
    text = sse_text(response)
    assert "雨停之后" in text
    assert "妹妹" in text


def test_game_epilogue_writes_failure_ending(client: TestClient) -> None:
    response = client.post(
        "/api/game/epilogue",
        json={
            "bible": BIBLE,
            "goal": {"title": "找到妹妹"},
            "outcome": "failure",
            "outcomeReason": "时间线耗尽（第 21 天 / 共 20 天），未能达成最终目标",
        },
    )
    assert response.status_code == 200
    assert sse_text(response).strip()


def test_game_epilogue_requires_finished_story(client: TestClient) -> None:
    not_finished = client.post(
        "/api/game/epilogue",
        json={"goal": {"title": "找到妹妹"}, "outcome": "playing"},
    )
    assert not_finished.status_code == 400
    assert not_finished.json()["error"]

    no_goal = client.post("/api/game/epilogue", json={"outcome": "success"})
    assert no_goal.status_code == 400


def test_stream_falls_back_to_non_streaming(
    client: TestClient, mock_server: str
) -> None:
    response = client.post(
        "/api/check",
        json={
            "bible": BIBLE,
            "aiConfig": {
                "baseUrl": mock_server,
                "apiKey": "mock-key",
                "model": "nonstream-only",
            },
        },
    )
    assert response.status_code == 200
    payload = json.loads(sse_text(response))
    assert payload["overallScore"] == 82


def test_sse_unconfigured_error(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    clear_ai_env(monkeypatch)
    response = client.post(
        "/api/bible",
        json={"novelName": "测试小说", "searchResults": [], "searchSummary": ""},
    )
    assert response.status_code == 200
    payloads = sse_payloads(response)
    assert payloads[-1]["error"] == NOT_CONFIGURED_MESSAGE
    assert response.text.rstrip().endswith("data: [DONE]")


def test_missing_request_fields(client: TestClient) -> None:
    assert client.post("/api/check", json={}).status_code == 400
    assert client.post("/api/game", json={}).status_code == 400
    assert (
        client.post(
            "/api/game/action",
            json={"bible": BIBLE, "gameState": GAME_STATE},
        ).status_code
        == 400
    )

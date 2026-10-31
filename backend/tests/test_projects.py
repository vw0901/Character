import json
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.store import ProjectStoreError, sanitize_project_id
from app.version import APP_VERSION, PROJECT_FORMAT, PROJECT_FORMAT_VERSION


BIBLE = {
    "novelName": "测试小说",
    "worldview": {"summary": "测试世界观"},
    "characters": [{"name": "林澈", "abilities": "剑术"}],
}

PROJECT = {
    "format": PROJECT_FORMAT,
    "formatVersion": PROJECT_FORMAT_VERSION,
    "appVersion": APP_VERSION,
    "novelName": "测试小说",
    "search": {
        "novelName": "测试小说",
        "summary": "检索摘要",
        "results": [{"title": "条目", "url": "", "snippet": "", "siteName": ""}],
    },
    "bible": BIBLE,
    "check": {
        "overallScore": 82,
        "summary": "整体稳定",
        "issues": [],
        "strengths": [],
    },
    "repair": {"summary": "已修补", "appliedFixes": [], "bible": BIBLE},
    "adventure": None,
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
    return "".join(item["text"] for item in sse_payloads(response) if "text" in item)


def test_meta_exposes_versions(client: TestClient) -> None:
    response = client.get("/api/meta")
    assert response.status_code == 200
    payload = response.json()
    assert payload["version"] == APP_VERSION
    assert payload["projectFormat"] == PROJECT_FORMAT
    assert payload["projectFormatVersion"] == PROJECT_FORMAT_VERSION


def test_save_and_load_project_roundtrip(client: TestClient) -> None:
    saved = client.put("/api/projects/测试小说", json=PROJECT)
    assert saved.status_code == 200
    document = saved.json()
    assert document["id"] == "测试小说"
    assert document["novelName"] == "测试小说"
    assert document["formatVersion"] == PROJECT_FORMAT_VERSION
    assert document["createdAt"]
    assert document["updatedAt"]

    loaded = client.get("/api/projects/测试小说")
    assert loaded.status_code == 200
    assert loaded.json()["bible"] == BIBLE
    assert loaded.json()["repair"]["summary"] == "已修补"


def test_project_file_is_utf8_json(client: TestClient, project_data_dir: Path) -> None:
    client.put("/api/projects/三体", json={**PROJECT, "novelName": "三体"})
    path = project_data_dir / "三体.json"
    assert path.is_file()

    raw = path.read_text(encoding="utf-8")
    assert "三体" in raw
    assert json.loads(raw)["format"] == PROJECT_FORMAT


def test_list_projects_is_sorted(client: TestClient) -> None:
    client.put("/api/projects/甲", json={**PROJECT, "novelName": "甲"})
    client.put("/api/projects/乙", json={**PROJECT, "novelName": "乙"})
    response = client.get("/api/projects")
    assert response.status_code == 200

    projects = response.json()["projects"]
    assert {item["id"] for item in projects} == {"甲", "乙"}
    assert all(item["hasBible"] for item in projects)
    assert all(item["hasAdventure"] is False for item in projects)


def test_missing_project_returns_404(client: TestClient) -> None:
    assert client.get("/api/projects/not-exist").status_code == 404
    assert client.delete("/api/projects/not-exist").status_code == 404


def test_delete_project(client: TestClient, project_data_dir: Path) -> None:
    client.put("/api/projects/临时", json={**PROJECT, "novelName": "临时"})
    response = client.delete("/api/projects/临时")
    assert response.status_code == 200
    assert response.json()["deleted"] is True
    assert not (project_data_dir / "临时.json").exists()


def test_rejects_unsafe_project_id(client: TestClient) -> None:
    for raw in ("a/b", "a.b", "con", " ", "x" * 65):
        with pytest.raises(ProjectStoreError):
            sanitize_project_id(raw)

    response = client.put("/api/projects/a.b", json=PROJECT)
    assert response.status_code == 400
    assert "项目 ID" in response.json()["error"]


def test_rejects_invalid_document(client: TestClient) -> None:
    missing_name = client.put("/api/projects/无名", json={"bible": BIBLE})
    assert missing_name.status_code == 400
    assert "小说名称" in missing_name.json()["error"]

    wrong_format = client.put(
        "/api/projects/格式错误", json={**PROJECT, "format": "other/app"}
    )
    assert wrong_format.status_code == 400


def test_full_workflow_persists_single_file(
    client: TestClient, project_data_dir: Path
) -> None:
    search = client.post("/api/search", json={"novelName": "测试小说"}).json()
    assert search["summary"]

    bible_response = client.post(
        "/api/bible",
        json={
            "novelName": "测试小说",
            "searchResults": search["results"],
            "searchSummary": search["summary"],
        },
    )
    bible = json.loads(sse_text(bible_response))

    check_response = client.post("/api/check", json={"bible": bible})
    check = json.loads(sse_text(check_response))

    repair_response = client.post("/api/repair", json={"bible": bible, "check": check})
    repair = json.loads(sse_text(repair_response))
    assert repair["appliedFixes"]

    document = {
        "format": PROJECT_FORMAT,
        "formatVersion": PROJECT_FORMAT_VERSION,
        "appVersion": APP_VERSION,
        "novelName": "测试小说",
        "search": search,
        "bible": bible,
        "check": check,
        "repair": repair,
        "adventure": None,
    }
    assert client.put("/api/projects/测试小说", json=document).status_code == 200

    saved_path = project_data_dir / "测试小说.json"
    saved = json.loads(saved_path.read_text(encoding="utf-8"))
    assert saved["search"]["summary"] == search["summary"]
    assert saved["bible"]["novelName"] == "测试小说"
    assert saved["check"]["overallScore"] == 82
    assert saved["repair"]["bible"]["novelName"] == "测试小说"


def test_adventure_progress_roundtrip(client: TestClient) -> None:
    adventure = {
        "character": {"mode": "existing", "name": "林澈", "background": "游侠"},
        "gameState": {
            "title": "测试冒险",
            "intro": "开场",
            "playerCharacter": {
                "name": "林澈",
                "background": "游侠",
                "initialStats": {"health": 100, "power": 50, "reputation": 50},
            },
            "currentScene": {
                "id": "scene_2",
                "location": "桥心",
                "description": "雨未停",
                "choices": [{"id": "choice_2_1", "text": "询问"}],
            },
        },
        "stats": {"health": 95, "power": 52, "reputation": 51},
        "history": [
            {"type": "narration", "text": "开场"},
            {"type": "choice", "text": "过桥"},
            {"type": "narration", "text": "你走上桥。"},
        ],
        "isEnding": False,
        "endingText": "",
        "turn": 1,
        "snapshots": [
            {
                "gameState": {
                    "title": "测试冒险",
                    "intro": "开场",
                    "playerCharacter": {
                        "name": "林澈",
                        "background": "游侠",
                        "initialStats": {"health": 100, "power": 50, "reputation": 50},
                    },
                    "currentScene": {
                        "id": "scene_1",
                        "location": "古桥",
                        "description": "雨幕中断桥横陈。",
                        "choices": [{"id": "choice_1", "text": "过桥"}],
                    },
                },
                "stats": {"health": 100, "power": 50, "reputation": 50},
                "history": [{"type": "narration", "text": "开场"}],
                "isEnding": False,
                "endingText": "",
                "turn": 0,
            }
        ],
        "startedAt": "2026-01-01T00:00:00.000Z",
    }

    saved = client.put("/api/projects/冒险存档", json={**PROJECT, "novelName": "冒险存档", "adventure": adventure})
    assert saved.status_code == 200

    loaded = client.get("/api/projects/冒险存档").json()
    assert loaded["adventure"]["turn"] == 1
    assert loaded["adventure"]["snapshots"][0]["gameState"]["currentScene"]["id"] == "scene_1"
    assert loaded["adventure"]["history"][1] == {"type": "choice", "text": "过桥"}


def test_repair_sse_contract(client: TestClient) -> None:
    response = client.post(
        "/api/repair",
        json={"bible": BIBLE, "check": {"issues": [{"title": "测试漏洞"}]}},
    )
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    assert response.text.rstrip().endswith("data: [DONE]")

    payload = json.loads(sse_text(response))
    assert payload["bible"]["novelName"] == "测试小说"
    assert payload["appliedFixes"][0]["issue"] == "测试漏洞"


def test_repair_requires_bible(client: TestClient) -> None:
    assert client.post("/api/repair", json={}).status_code == 400


def test_repair_unconfigured_error(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    for name in ("OPENAI_BASE_URL", "AI_BASE_URL", "OPENAI_MODEL", "AI_MODEL"):
        monkeypatch.setenv(name, "")

    response = client.post("/api/repair", json={"bible": BIBLE})
    assert response.status_code == 200
    assert sse_payloads(response)[-1]["error"]

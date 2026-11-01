"""项目存档的本地文件持久化。

每个项目保存为 `backend/data/projects/<id>.json` 一个文件，包含：
检索结果、设定圣经、体检报告、修补结果与冒险进度。写入是原子的，
并限制 id 只能是安全字符，避免路径穿越。
"""

from __future__ import annotations

import json
import os
import re
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.config import BACKEND_DIR
from app.version import PROJECT_FORMAT, PROJECT_FORMAT_VERSION

MAX_PROJECT_BYTES = 4 * 1024 * 1024
MAX_NOVEL_NAME_LENGTH = 200

_PROJECT_ID_PATTERN = re.compile(r"^[\w\u4e00-\u9fff-]{1,64}$", re.UNICODE)
_WINDOWS_RESERVED = {
    "con",
    "prn",
    "aux",
    "nul",
    *(f"com{index}" for index in range(1, 10)),
    *(f"lpt{index}" for index in range(1, 10)),
}

_write_lock = threading.Lock()


class ProjectStoreError(ValueError):
    """项目存档的校验错误（面向用户的中文信息）。"""


def projects_dir() -> Path:
    """存档目录，可用 PROJECT_DATA_DIR 覆盖（测试用）。"""
    override = os.getenv("PROJECT_DATA_DIR", "").strip()
    if override:
        return Path(override).expanduser().resolve()
    return (BACKEND_DIR / "data" / "projects").resolve()


def _now() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


def sanitize_project_id(raw: str) -> str:
    value = (raw or "").strip()
    if not value:
        raise ProjectStoreError("缺少项目 ID")
    if not _PROJECT_ID_PATTERN.fullmatch(value):
        raise ProjectStoreError("项目 ID 只能包含文字、数字、下划线和短横线（1-64 位）")
    if value.lower() in _WINDOWS_RESERVED:
        raise ProjectStoreError("项目 ID 是系统保留名称，请换一个")
    return value


def project_path(project_id: str) -> Path:
    safe_id = sanitize_project_id(project_id)
    directory = projects_dir()
    path = (directory / f"{safe_id}.json").resolve()
    if path.parent != directory:
        raise ProjectStoreError("项目 ID 非法")
    return path


def _normalize_document(project_id: str, document: Any) -> dict[str, Any]:
    if not isinstance(document, dict):
        raise ProjectStoreError("项目存档必须是一个 JSON 对象")

    raw_format = document.get("format")
    if raw_format not in (None, "", PROJECT_FORMAT):
        raise ProjectStoreError("无法识别的存档格式")

    novel_name = document.get("novelName")
    if not isinstance(novel_name, str) or not novel_name.strip():
        raise ProjectStoreError("项目存档缺少小说名称")
    novel_name = novel_name.strip()
    if len(novel_name) > MAX_NOVEL_NAME_LENGTH:
        raise ProjectStoreError("小说名称过长")

    doc = dict(document)
    doc["format"] = PROJECT_FORMAT
    doc["formatVersion"] = PROJECT_FORMAT_VERSION
    doc["id"] = sanitize_project_id(project_id)
    doc["novelName"] = novel_name
    doc.setdefault("createdAt", _now())
    doc["updatedAt"] = _now()
    for key in ("search", "bible", "check", "repair", "adventure"):
        doc.setdefault(key, None)
    # 每个角色一本故事书；旧存档的单个 adventure 仍然保留兼容。
    doc.setdefault("adventures", {})
    doc.setdefault("activeAdventureKey", None)

    try:
        encoded = json.dumps(doc, ensure_ascii=False, indent=2)
    except (TypeError, ValueError) as exc:
        raise ProjectStoreError("项目存档包含无法序列化的数据") from exc
    if len(encoded.encode("utf-8")) > MAX_PROJECT_BYTES:
        raise ProjectStoreError("项目存档过大（上限 4 MB）")

    return doc


def _atomic_write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(f".{path.name}.tmp")
    with _write_lock:
        try:
            tmp.write_text(text, encoding="utf-8", newline="\n")
            os.replace(tmp, path)
        finally:
            if tmp.exists():
                tmp.unlink(missing_ok=True)


def _has_adventure(document: dict[str, Any]) -> bool:
    adventures = document.get("adventures")
    if isinstance(adventures, dict):
        for book in adventures.values():
            if isinstance(book, dict) and book.get("gameState"):
                return True
    legacy = document.get("adventure")
    return isinstance(legacy, dict) and bool(legacy.get("gameState"))


def list_projects() -> list[dict[str, Any]]:
    directory = projects_dir()
    if not directory.is_dir():
        return []

    summaries: list[dict[str, Any]] = []
    for path in directory.glob("*.json"):
        try:
            if path.stat().st_size > MAX_PROJECT_BYTES:
                continue
            doc = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            continue
        if not isinstance(doc, dict):
            continue
        novel_name = doc.get("novelName")
        summaries.append(
            {
                "id": path.stem,
                "novelName": novel_name if isinstance(novel_name, str) else path.stem,
                "updatedAt": doc.get("updatedAt") or "",
                "appVersion": doc.get("appVersion") or "",
                "hasSearch": bool(doc.get("search")),
                "hasBible": bool(doc.get("bible")),
                "hasCheck": bool(doc.get("check")),
                "hasRepair": bool(doc.get("repair")),
                "hasAdventure": _has_adventure(doc),
            }
        )

    summaries.sort(key=lambda item: str(item.get("updatedAt") or ""), reverse=True)
    return summaries


def read_project(project_id: str) -> dict[str, Any] | None:
    path = project_path(project_id)
    if not path.is_file():
        return None
    try:
        if path.stat().st_size > MAX_PROJECT_BYTES:
            return None
        doc = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    return doc if isinstance(doc, dict) else None


def write_project(project_id: str, document: Any) -> dict[str, Any]:
    doc = _normalize_document(project_id, document)
    encoded = json.dumps(doc, ensure_ascii=False, indent=2)
    _atomic_write(project_path(project_id), f"{encoded}\n")
    return doc


def delete_project(project_id: str) -> bool:
    path = project_path(project_id)
    if not path.is_file():
        return False
    path.unlink()
    return True

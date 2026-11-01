"""提示词共用的上下文整理。

设定圣经动辄数千字，整份塞进每一轮冒险既费 token，也会稀释当前场景的重点。
这里只保留模型真正需要的骨架：世界规则、力量体系、关键人物与势力、悬而未决的谜题。
"""

import json
from typing import Any


def clip(value: Any, limit: int) -> str:
    text = str(value or "").strip()
    return text if len(text) <= limit else f"{text[:limit]}…"


def _records(value: Any) -> list[dict[str, Any]]:
    return [item for item in value if isinstance(item, dict)] if isinstance(value, list) else []


def _text_items(value: Any, limit: int) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item).strip() for item in value if str(item).strip()][:limit]


def bible_digest(bible: dict[str, Any]) -> dict[str, Any]:
    """把设定圣经压缩成冒险每轮都要带的「设定摘要」。"""
    if not isinstance(bible, dict):
        return {}

    worldview = bible.get("worldview") if isinstance(bible.get("worldview"), dict) else {}
    power = bible.get("powerSystem") if isinstance(bible.get("powerSystem"), dict) else {}
    digest: dict[str, Any] = {
        "novelName": clip(bible.get("novelName"), 80),
        "genre": clip(bible.get("genre"), 40),
        "synopsis": clip(bible.get("synopsis"), 300),
        "worldview": clip(worldview.get("summary") or worldview.get("rules"), 400),
    }

    power_digest = {
        "name": clip(power.get("name"), 40),
        "levels": _text_items(power.get("levels"), 6),
        "limitations": clip(power.get("limitations"), 200),
    }
    if any(power_digest.values()):
        digest["powerSystem"] = power_digest

    factions = [
        {"name": clip(item.get("name"), 40), "goal": clip(item.get("goal"), 120)}
        for item in _records(bible.get("factions"))[:6]
    ]
    if factions:
        digest["factions"] = factions

    characters = [
        {
            "name": clip(item.get("name"), 40),
            "role": clip(item.get("role"), 60),
            "abilities": clip(item.get("abilities"), 100),
        }
        for item in _records(bible.get("characters"))[:8]
    ]
    if characters:
        digest["characters"] = characters

    mysteries = [
        clip(item.get("question"), 120)
        for item in _records(bible.get("mysteries"))[:5]
        if item.get("question")
    ]
    if mysteries:
        digest["mysteries"] = mysteries

    return digest


def format_history(
    history: list[dict[str, Any]] | None,
    *,
    limit: int = 8,
    text_limit: int = 300,
) -> str:
    """把最近几轮剧情排成列表，供提示词承接前文。"""
    rows: list[str] = []
    for item in (history or [])[-limit:]:
        if not isinstance(item, dict):
            continue
        content = clip(item.get("text") or item.get("content"), text_limit)
        if not content:
            continue
        kind = "玩家选择" if item.get("type") == "choice" else "剧情"
        rows.append(f"- {kind}：{content}")
    return "\n".join(rows)


def dumps(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))

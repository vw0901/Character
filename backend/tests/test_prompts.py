import json
from pathlib import Path
from typing import Any

from app.ai.prompts.bible import build_messages as build_bible_messages
from app.ai.prompts.check import build_messages as build_check_messages
from app.ai.prompts.epilogue import build_messages as build_epilogue_messages
from app.ai.prompts.game import build_messages as build_game_messages
from app.ai.prompts.game_action import build_messages as build_action_messages
from app.ai.prompts.goal_check import build_messages as build_goal_check_messages
from app.schemas import CharacterChoice, SearchResult


FIXTURES = json.loads(
    (Path(__file__).parent / "fixtures" / "expected_messages.json").read_text(
        encoding="utf-8"
    )
)


def message_dicts(messages: list[Any]) -> list[dict[str, str]]:
    return [message.model_dump() for message in messages]


def test_bible_prompt_matches_original() -> None:
    data = FIXTURES["bible"]["input"]
    messages = build_bible_messages(
        data["novelName"],
        [SearchResult(**item) for item in data["searchResults"]],
        data["searchSummary"],
    )
    assert message_dicts(messages) == FIXTURES["bible"]["messages"]


def test_check_prompt_matches_original() -> None:
    data = FIXTURES["check"]["input"]
    messages = build_check_messages(data["bible"])
    assert message_dicts(messages) == FIXTURES["check"]["messages"]


def test_game_prompt_matches_original() -> None:
    data = FIXTURES["game"]["input"]
    messages = build_game_messages(
        data["bible"],
        CharacterChoice.model_validate(data["characterChoice"]),
    )
    assert message_dicts(messages) == FIXTURES["game"]["messages"]


def test_game_action_prompt_matches_original() -> None:
    data = FIXTURES["game_action"]["input"]
    messages = build_action_messages(
        data["bible"],
        data["gameState"],
        data["choiceId"],
        data["choiceText"],
        CharacterChoice.model_validate(data["characterChoice"]),
        data.get("history"),
    )
    assert message_dicts(messages) == FIXTURES["game_action"]["messages"]


def test_game_action_prompt_carries_goal_and_timeline() -> None:
    messages = build_action_messages(
        {"novelName": "测试小说"},
        {
            "currentScene": {
                "id": "scene_1",
                "location": "古桥",
                "description": "",
                "choices": [{"id": "choice_1", "text": "过桥"}],
            },
            "stats": {"health": 90, "power": 50, "reputation": 50},
            "goal": {"title": "找到妹妹", "description": "在血月降临前找到妹妹"},
            "timeline": {"label": "血月降临前", "totalDays": 20, "currentDay": 3},
        },
        "choice_1",
        "过桥",
        None,
    )
    user_content = messages[1].content
    assert "最终目标: 找到妹妹" in user_content
    assert "剩余 17 天" in user_content


def test_game_action_prompt_uses_digest_and_recent_history() -> None:
    messages = build_action_messages(
        {
            "novelName": "测试小说",
            "synopsis": "一段测试梗概。",
            "worldview": {"summary": "古桥下的旧神"},
            "powerSystem": {"name": "剑道", "levels": ["一阶", "二阶"], "limitations": "忌水"},
            "factions": [{"name": "守桥人", "goal": "守住古桥"}],
            "characters": [
                {"name": "林澈", "role": "主角", "abilities": "剑术", "personality": "谨慎"}
            ],
            "mysteries": [{"question": "旧神是谁"}],
        },
        {
            "currentScene": {
                "id": "scene_1",
                "location": "古桥",
                "description": "",
                "choices": [{"id": "choice_1", "text": "过桥"}],
            },
            "stats": {"health": 90, "power": 50, "reputation": 50},
        },
        "choice_1",
        "过桥",
        None,
        [
            {"type": "choice", "text": "沿河查看"},
            {"type": "narration", "text": "你在河滩上捡到一枚铜环。"},
        ],
    )

    user_content = messages[1].content
    assert "设定摘要" in user_content
    assert "古桥下的旧神" in user_content
    assert "守桥人" in user_content
    assert "旧神是谁" in user_content
    # 摘要只带模型真正需要的字段，不再整份塞进设定圣经。
    assert "谨慎" not in user_content
    assert "最近剧情" in user_content
    assert "你在河滩上捡到一枚铜环。" in user_content


def test_goal_check_prompt_carries_goal_and_round() -> None:
    messages = build_goal_check_messages(
        {"title": "找到妹妹", "description": "在血月前带她离开古桥"},
        "你终于找到妹妹，并把她带出了古桥。",
        {"location": "古桥", "description": "血月刚刚升起。"},
        [
            {"type": "choice", "text": "过桥"},
            {"type": "narration", "text": "桥心站着戴斗笠的人。"},
        ],
    )

    assert "证据不明确时判 false" in messages[0].content
    user_content = messages[1].content
    assert "找到妹妹" in user_content
    assert "在血月前带她离开古桥" in user_content
    assert "你终于找到妹妹" in user_content
    assert "玩家选择：过桥" in user_content
    assert "血月刚刚升起" in user_content


def test_epilogue_prompt_carries_goal_and_ending() -> None:
    messages = build_epilogue_messages(
        {"novelName": "测试小说"},
        {"name": "林澈", "background": "游侠", "abilities": "剑术"},
        {"title": "找到妹妹", "description": "在血月前带她离开古桥"},
        {"label": "血月降临前", "totalDays": 20, "currentDay": 20},
        "failure",
        "时间线耗尽（第 21 天 / 共 20 天），未能达成最终目标",
        "血月升起来了。",
        [
            {"type": "choice", "text": "过桥"},
            {"type": "narration", "text": "桥心站着戴斗笠的人。"},
        ],
    )

    assert "后日谈" in messages[0].content
    user_content = messages[1].content
    assert "测试小说" in user_content
    assert "林澈" in user_content
    assert "找到妹妹" in user_content
    assert "在血月前带她离开古桥" in user_content
    assert "第 20 / 20 天" in user_content
    assert "失败" in user_content
    assert "血月升起来了" in user_content
    assert "玩家选择：过桥" in user_content

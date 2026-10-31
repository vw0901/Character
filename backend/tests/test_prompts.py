import json
from pathlib import Path
from typing import Any

from app.ai.prompts.bible import build_messages as build_bible_messages
from app.ai.prompts.check import build_messages as build_check_messages
from app.ai.prompts.game import build_messages as build_game_messages
from app.ai.prompts.game_action import build_messages as build_action_messages
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
    )
    assert message_dicts(messages) == FIXTURES["game_action"]["messages"]

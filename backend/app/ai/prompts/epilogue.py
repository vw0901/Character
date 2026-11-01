from typing import Any

from app.schemas import CharacterChoice, ChatMessage


SYSTEM_PROMPT = """你是一位擅长写「后日谈」的叙事作家。玩家的这段文字冒险已经结束，你要为它写一篇后日谈，作为整段故事的大结局。

后日谈写的是「结局之后」：
1. 用 3-5 段中文，总共 500-800 字：先回望这段路上真正改变了什么，再写此后人们怎样活下去。
2. 成功结局写目标达成后的余波：代价、失去的东西、被救下的人；失败结局写未竟之事怎样留在世界里，以及角色最后停在哪里。不要改写已经发生的结局，也不要给玩家一次翻盘的机会。
3. 沿用第二人称「你」，与正文保持同一种语气和世界观；不要引入设定之外的新角色、新势力或新能力。
4. 交代主要人物与关键线索的下落，让读者感到这个故事真的收尾了。
5. 可以留一点余韵，但不要抛出新的选择、任务或「下一章」式的悬念。
6. 直接输出后日谈正文：不要标题、不要 markdown 标记、不要解释你写了什么。"""


HISTORY_LIMIT = 12
TEXT_LIMIT = 500


def _clip(value: Any, limit: int = TEXT_LIMIT) -> str:
    text = str(value or "").strip()
    return text if len(text) <= limit else f"{text[:limit]}…"


def _format_history(history: list[dict[str, Any]]) -> str:
    rows: list[str] = []
    for item in history[-HISTORY_LIMIT:]:
        if not isinstance(item, dict):
            continue
        content = _clip(item.get("text") or item.get("content"))
        if not content:
            continue
        kind = "玩家选择" if item.get("type") == "choice" else "剧情"
        rows.append(f"- {kind}：{content}")
    return "\n".join(rows)


def _format_character(character: CharacterChoice | dict | None) -> str:
    choice = (
        character
        if isinstance(character, CharacterChoice)
        else CharacterChoice.model_validate(character)
        if character
        else None
    )
    if not choice:
        return ""

    lines = [f"玩家扮演的角色：{choice.name}"]
    if choice.background:
        lines.append(f"角色背景：{choice.background}")
    if choice.abilities:
        lines.append(f"角色能力：{choice.abilities}")
    if choice.personality:
        lines.append(f"角色性格：{choice.personality}")
    return "\n".join(lines)


def _format_goal(goal: dict[str, Any]) -> str:
    title = _clip(goal.get("title"), 120) or "（未命名目标）"
    description = _clip(goal.get("description"))
    lines = [f"最终目标：{title}"]
    if description:
        lines.append(f"达成条件：{description}")
    return "\n".join(lines)


def _format_timeline(timeline: dict[str, Any] | None) -> str:
    if not isinstance(timeline, dict):
        return ""
    total = timeline.get("totalDays", timeline.get("total_days"))
    current = timeline.get("currentDay", timeline.get("current_day"))
    label = _clip(timeline.get("label"), 40) or "主线"
    if not isinstance(total, (int, float)) or not isinstance(current, (int, float)):
        return f"时间线：{label}"
    return f"时间线：{label}，故事停在第 {int(current)} / {int(total)} 天"


def _format_outcome(outcome: str, reason: str, ending_text: str) -> str:
    label = "成功达成最终目标" if outcome == "success" else "失败"
    lines = [f"结局：{label}"]
    if reason:
        lines.append(f"结局原因：{_clip(reason, 200)}")
    if ending_text:
        lines.append(f"结局正文：{_clip(ending_text, 800)}")
    return "\n".join(lines)


def build_messages(
    bible: dict[str, Any],
    character: CharacterChoice | dict | None,
    goal: dict[str, Any],
    timeline: dict[str, Any] | None,
    outcome: str,
    outcome_reason: str = "",
    ending_text: str = "",
    history: list[dict[str, Any]] | None = None,
) -> list[ChatMessage]:
    novel = _clip(bible.get("novelName"), 120) if isinstance(bible, dict) else ""
    sections: list[str] = []
    if novel:
        sections.append(f"【作品】\n{novel}")

    story_context = "\n\n".join(
        part
        for part in (
            _format_character(character),
            _format_goal(goal),
            _format_timeline(timeline),
            _format_outcome(outcome, outcome_reason, ending_text),
        )
        if part
    )
    if story_context:
        sections.append(f"【这一局的关键信息】\n{story_context}")

    replay = _format_history(history or [])
    if replay:
        sections.append(f"【故事回顾（节选）】\n{replay}")

    sections.append(
        "请为这段故事写后日谈：交代结局之后的余波，给整段冒险一个真正的收尾。"
    )

    return [
        ChatMessage(role="system", content=SYSTEM_PROMPT),
        ChatMessage(role="user", content="\n\n".join(sections)),
    ]

"""玩家自填行动的润色提示词。

冒险里的选项由模型生成，玩家也可能想写一件选项里没有的事。
这一步不推进剧情，只把玩家的大白话变成一条能直接交给冒险大师的行动描述：
保留原意，补一点动作与画面，不替玩家决定成败。
"""

from typing import Any

from app.ai.prompts.context import clip, format_history
from app.schemas import CharacterChoice, ChatMessage


SYSTEM_PROMPT = """你是一位文字冒险游戏的动作润色师。玩家会自己写下一句想做的事，你把它润色成一条可以交给故事大师的行动描述。

要求：
1. 保留玩家的原意、对象和语气，不新增玩家没有表达过的动作、物品、地点或人物
2. 改写成第一人称「我」此刻正在做的动作，1-2 句，不超过 80 字
3. 可以补充动作的方式、姿态或感官细节，但不要写出结果，也不要替玩家决定成败
4. 不要出现「我选择」「玩家」「行动：」这类说明性文字，不要加引号、序号或 markdown
5. 只输出润色后的这一句：不解释、不反问、不提供选项

玩家的表达已经通顺时，在保持原意的前提下略作提炼即可，不要为了改而改。"""


HISTORY_LIMIT = 6
TEXT_LIMIT = 200


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

    lines = [f"角色：{choice.name}"]
    if choice.background:
        lines.append(f"背景：{clip(choice.background, 120)}")
    if choice.abilities:
        lines.append(f"能力：{clip(choice.abilities, 120)}")
    return "\n".join(lines)


def _format_scene(scene: dict[str, Any] | None) -> str:
    if not isinstance(scene, dict):
        return ""

    location = clip(scene.get("location"), 80)
    description = clip(scene.get("description"), TEXT_LIMIT)
    if not location and not description:
        return ""

    lines = [f"位置：{location}"] if location else []
    if description:
        lines.append(f"场景：{description}")
    return "\n".join(lines)


def build_messages(
    bible: dict[str, Any],
    character: CharacterChoice | dict | None,
    goal: dict[str, Any] | None,
    scene: dict[str, Any] | None,
    text: str,
    history: list[dict[str, Any]] | None = None,
) -> list[ChatMessage]:
    """拼装润色请求：只带润色真正需要的处境，不塞整份设定圣经。"""
    novel = clip(bible.get("novelName"), 120) if isinstance(bible, dict) else ""
    genre = clip(bible.get("genre"), 40) if isinstance(bible, dict) else ""

    sections: list[str] = []
    if novel:
        sections.append(f"【作品】\n{novel}" + (f"（{genre}）" if genre else ""))

    context = "\n\n".join(
        part
        for part in (
            _format_scene(scene),
            _format_character(character),
        )
        if part
    )
    if context:
        sections.append(f"【玩家的处境】\n{context}")

    title = clip((goal or {}).get("title"), 120) if isinstance(goal, dict) else ""
    if title:
        sections.append(f"【最终目标】\n{title}")

    recent = format_history(history, limit=HISTORY_LIMIT, text_limit=TEXT_LIMIT)
    if recent:
        sections.append(f"【最近剧情（从早到晚）】\n{recent}")

    sections.append(f"【玩家写下的行动】\n{clip(text, TEXT_LIMIT)}")
    sections.append("请把这条行动润色成可以直接写进故事的一句话。")

    return [
        ChatMessage(role="system", content=SYSTEM_PROMPT),
        ChatMessage(role="user", content="\n\n".join(sections)),
    ]

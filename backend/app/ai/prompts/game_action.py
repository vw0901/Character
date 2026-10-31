import json
from typing import Any

from app.schemas import CharacterChoice, ChatMessage


SYSTEM_PROMPT = """你是一位文字冒险游戏大师。玩家刚刚做出了一个选择，你需要生成下一个场景。

根据玩家的选择，生成新的场景和新的选项。

请严格按以下 JSON 格式输出（不要输出 markdown 代码块标记，直接输出 JSON）：
{
  "narration": "对玩家选择的结果叙述（100-200字）",
  "currentScene": {
    "id": "scene_N",
    "location": "新场景地点",
    "description": "新场景描述（150-300字）",
    "choices": [
      {
        "id": "choice_N_1",
        "text": "选项文字",
        "hint": "风险提示"
      },
      {
        "id": "choice_N_2",
        "text": "选项文字",
        "hint": "风险提示"
      },
      {
        "id": "choice_N_3",
        "text": "选项文字",
        "hint": "风险提示"
      }
    ]
  },
  "statsChange": {
    "health": 0,
    "power": 0,
    "reputation": 0
  },
  "isEnding": false,
  "endingText": "如果是结局，这里写结局文字（可选）"
}

要求：
1. 叙述要紧承玩家的选择，让玩家感受到选择的后果
2. 新场景要有新的发现和挑战
3. 选项要有意义，保持游戏的趣味性
4. 属性变化要合理，有选择应该有代价
5. 每次叙述都要与设定圣经中的世界观保持一致
6. 大约在第8-12个场景后可以触发结局
7. 直接输出 JSON，不要包含任何其他文字"""


def build_messages(
    bible: dict[str, Any],
    game_state: dict[str, Any],
    choice_id: str,
    choice_text: str,
    character_choice: CharacterChoice | dict | None,
) -> list[ChatMessage]:
    choice = (
        character_choice
        if isinstance(character_choice, CharacterChoice)
        else CharacterChoice.model_validate(character_choice)
        if character_choice
        else None
    )

    character_context = ""
    if choice:
        character_context = f"\n\n玩家扮演的角色: {choice.name}\n角色背景: {choice.background}\n"
        if choice.abilities:
            character_context += f"角色能力: {choice.abilities}\n"
        if choice.personality:
            character_context += f"角色性格: {choice.personality}\n"
        character_context += "请始终以这个角色的第一人称视角编写叙述，保持其身份与能力设定。"

    bible_json = json.dumps(bible, ensure_ascii=False, separators=(",", ":"))
    game_state_json = json.dumps(game_state, ensure_ascii=False, separators=(",", ":"))
    user_content = (
        f"设定圣经: {bible_json}\n\n"
        f"当前游戏状态: {game_state_json}\n\n"
        f"玩家选择了: {choice_text} (ID: {choice_id})\n"
        f"{character_context}\n\n请生成下一个场景。"
    )
    return [
        ChatMessage(role="system", content=SYSTEM_PROMPT),
        ChatMessage(role="user", content=user_content),
    ]

import json
from typing import Any

from app.schemas import CharacterChoice, ChatMessage


SYSTEM_PROMPT = """你是一位文字冒险游戏大师，擅长将小说设定转化为沉浸式的文字冒险游戏。

根据提供的设定圣经，生成游戏的初始场景。

请严格按以下 JSON 格式输出（不要输出 markdown 代码块标记，直接输出 JSON）：
{
  "title": "游戏标题",
  "intro": "开场旇子（100-200字，有氛围感）",
  "playerCharacter": {
    "name": "角色名",
    "background": "背景故事",
    "initialStats": {
      "health": 100,
      "power": 50,
      "reputation": 50
    }
  },
  "currentScene": {
    "id": "scene_1",
    "location": "场景地点",
    "description": "场景描述（150-300字，有画面感）",
    "choices": [
      {
        "id": "choice_1",
        "text": "选项文字",
        "hint": "风险提示（可选）"
      },
      {
        "id": "choice_2",
        "text": "选项文字",
        "hint": "风险提示"
      },
      {
        "id": "choice_3",
        "text": "选项文字",
        "hint": "风险提示"
      }
    ]
  }
}

要求：
1. 开场要有强烈的氛围感，让玩家立刻沉浸
2. 场景描述要生动具体，调动多种感官
3. 选项要有意义，不同选择应该引向不同的发展方向
4. 角色背景要与小说世界观贴合
5. 直接输出 JSON，不要包含任何其他文字"""


def build_messages(
    bible: dict[str, Any],
    character_choice: CharacterChoice | dict | None,
) -> list[ChatMessage]:
    choice = (
        character_choice
        if isinstance(character_choice, CharacterChoice)
        else CharacterChoice.model_validate(character_choice)
        if character_choice
        else None
    )

    if choice:
        lines = [
            "玩家选择扮演以下角色进入故事：",
            f"扮演角色: {choice.name}",
            f"角色背景: {choice.background}",
        ]
        if choice.abilities:
            lines.append(f"角色能力: {choice.abilities}")
        if choice.personality:
            lines.append(f"角色性格: {choice.personality}")
        lines.extend(
            [
                "",
                "请以这个角色的第一人称视角生成开场，把玩家就是这个角色本人。开场叙述和场景描述都要紧密结合这个角色的身份、能力与性格，令场景之间的进入脱离不会与角色设定冲突。",
            ]
        )
        character_context = "\n".join(lines)
    else:
        character_context = (
            "玩家将以原创观察者身份进入这个世界，你可以为玩家分配一个适合世界观的自由角色身份"
            "（playerCharacter.name 为玩家角色名）。"
        )

    bible_json = json.dumps(bible, ensure_ascii=False, separators=(",", ":"))
    user_content = (
        "请根据以下设定圣经生成文字冒险游戏的初始场景：\n\n"
        f"{bible_json}\n\n{character_context}"
    )
    return [
        ChatMessage(role="system", content=SYSTEM_PROMPT),
        ChatMessage(role="user", content=user_content),
    ]

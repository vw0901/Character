from typing import Any

from app.ai.prompts.context import bible_digest, dumps, format_history
from app.schemas import CharacterChoice, ChatMessage


SYSTEM_PROMPT = """你是一位文字冒险游戏大师。玩家刚刚做出了一个选择，你需要生成下一个场景，并推进故事的时间线。

根据玩家的选择，生成新的场景、新的选项，以及本次行动消耗的天数。

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
  "daysPassed": 1,
  "goalAchieved": false,
  "isEnding": false,
  "endingType": null,
  "endingText": "如果是结局，这里写结局文字（可选）"
}

要求：
1. 叙述要紧承「最近剧情」与玩家这次的选择，只写这次选择带来的结果与变化；不要复述已经发生过的事件，也不要把新场景的环境描写提前复述一遍
2. 新场景要有新的发现和挑战；选项不要与上一场景重复，也不要把玩家刚做过的选择原样再给一次
3. 每次给出 2-4 个玩家此刻立刻能执行的新选项，绝不能没有选项
4. statsChange 是本次行动对生命/战力/声望的加减，三项都写整数，没有变化写 0
5. 叙述与数值必须一致：轻微擦伤 -5~-10，重伤 -25~-40，休息治疗 +10~+20；不要「只是擦破皮」却扣掉 30 点生命
6. 非结局回合的单次变化不能超出：health -40~+25，power -30~+30，reputation -30~+30；结局回合可以按结局叙述给出更大的变化
7. daysPassed 表示这次行动消耗的天数，取 1-3 的整数；不要自己修改当前日期，前端会累加
8. 每轮生成前先对照「最终目标 / 达成条件」核对：只要本轮 narration、currentScene.description 或 endingText 里已经在事实上完成了目标（条件全部满足，哪怕没出现「成功」二字），就必须立刻收束——goalAchieved=true、isEnding=true、endingType="success"，并在 endingText 写出成功结局；不能因为想继续写新场景而把它设为 false，也不能把已经完成的目标留到下一轮
9. 如果本次 statsChange 会让生命值降到 0 或以下，isEnding=true、endingType="failure"，并写出失败结局；生命归零由前端最终裁定
10. 时间线耗尽也由前端裁定失败，你不要因为剩余天数少就提前结束故事；但当剩余天数 ≤ 3 时，选项必须提供一条能直接冲向最终目标的路径
11. 除第 8、9 条的情况外，isEnding 必须为 false；直接输出 JSON，不要包含任何其他文字"""


def build_messages(
    bible: dict[str, Any],
    game_state: dict[str, Any],
    choice_id: str,
    choice_text: str,
    character_choice: CharacterChoice | dict | None,
    history: list[dict[str, Any]] | None = None,
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

    goal_context = ""
    goal = game_state.get("goal") if isinstance(game_state, dict) else None
    if isinstance(goal, dict):
        title = str(goal.get("title") or "").strip()
        description = str(goal.get("description") or "").strip()
        if title:
            goal_context += f"\n\n最终目标: {title}"
            if description:
                goal_context += f"\n达成条件: {description}"

    timeline_context = ""
    timeline = game_state.get("timeline") if isinstance(game_state, dict) else None
    if isinstance(timeline, dict):
        total = timeline.get("totalDays") or timeline.get("total_days")
        current = timeline.get("currentDay") or timeline.get("current_day")
        label = str(timeline.get("label") or "主线")
        if isinstance(total, (int, float)) and isinstance(current, (int, float)) and total > 0:
            remaining = max(0, int(total) - int(current))
            timeline_context = (
                f"\n\n时间线：{label}，当前第 {int(current)} / {int(total)} 天，剩余 {remaining} 天。"
            )

    bible_json = dumps(bible_digest(bible))
    game_state_json = dumps(game_state)
    sections = [f"设定摘要: {bible_json}"]

    recent = format_history(history, limit=8, text_limit=300)
    if recent:
        sections.append(f"最近剧情（从早到晚）:\n{recent}")

    sections.append(f"当前游戏状态: {game_state_json}")
    sections.append(
        f"玩家选择了: {choice_text} (ID: {choice_id}){character_context}{goal_context}{timeline_context}"
    )

    user_content = "\n\n".join(sections) + "\n\n请生成下一个场景。"
    return [
        ChatMessage(role="system", content=SYSTEM_PROMPT),
        ChatMessage(role="user", content=user_content),
    ]

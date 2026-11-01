from typing import Any

from app.ai.prompts.context import clip, format_history
from app.schemas import ChatMessage


SYSTEM_PROMPT = """你是一位严格的文字冒险剧情审校员。你的唯一任务：判断「本轮剧情」是否已经在事实上完成了玩家的最终目标。

判定标准：
1. 只看剧情里发生的事实，不看叙述自称的「成功」「完成」；也不要求出现「成功」二字。
2. 最终目标的达成条件必须全部满足。只是接近目标、拿到关键线索、承诺接下来去做、推进了一步，都不算完成。
3. 如果之前的剧情已经完成了目标，而本轮只是继续叙述后续，则判为已完成。
4. 如果本轮叙述明确写出目标失败、放弃、错过时机，且达成条件没有满足，则判为未完成。
5. 判断要保守：证据不明确时判 false，宁可不结束，也不要误判成功。
6. 玩家的选择只是意图，不是已经发生的事实；只有本轮叙述里写成事实的进展才算数。
7. reason 用一句不超过 40 字的中文说明依据。

只输出 JSON，不要 markdown 代码块，不要输出任何其他文字：
{"achieved": true, "confidence": "high", "reason": "本轮叙述中玩家已经找到并救出妹妹"}

confidence 取 high / medium / low。"""


HISTORY_LIMIT = 8
TEXT_LIMIT = 600


def _format_scene(scene: dict[str, Any] | None) -> str:
    if not isinstance(scene, dict):
        return ""
    location = clip(scene.get("location"), 80)
    description = clip(scene.get("description"), TEXT_LIMIT)
    lines = [line for line in (location, description) if line]
    return "\n".join(lines)


def build_messages(
    goal: dict[str, Any],
    narration: str,
    scene: dict[str, Any] | None = None,
    history: list[dict[str, Any]] | None = None,
) -> list[ChatMessage]:
    title = clip(goal.get("title"), 120) or "（未命名目标）"
    description = clip(goal.get("description"), TEXT_LIMIT)

    lines = [
        "【最终目标】",
        title,
    ]
    if description:
        lines.extend(["", "【达成条件】", description])

    recent = format_history(history, limit=HISTORY_LIMIT, text_limit=TEXT_LIMIT)
    if recent:
        lines.extend(["", "【之前的剧情（仅作背景）】", recent])

    lines.extend(["", "【本轮行动结果叙述】", clip(narration, TEXT_LIMIT) or "（本轮没有叙述）"])

    scene_text = _format_scene(scene)
    if scene_text:
        lines.extend(["", "【本轮进入的新场景】", scene_text])

    lines.extend(
        [
            "",
            "请判断：本轮剧情是否已经在事实上完成了最终目标？只输出 JSON。",
        ]
    )

    return [
        ChatMessage(role="system", content=SYSTEM_PROMPT),
        ChatMessage(role="user", content="\n".join(lines)),
    ]

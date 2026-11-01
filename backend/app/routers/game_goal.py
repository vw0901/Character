from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.ai.client import chat_once
from app.ai.json_utils import extract_json_object
from app.ai.prompts.goal_check import build_messages
from app.ai.resolve import resolve_ai_config
from app.errors import get_ai_error_message
from app.schemas import GameGoalCheckRequest


router = APIRouter(tags=["game"])

_CONFIDENCES = {"high", "medium", "low"}


@router.post("/game/goal-check")
async def game_goal_check(body: GameGoalCheckRequest) -> JSONResponse:
    """判定本轮剧情是否已经完成最终目标。

    模型的 goalAchieved 字段并不可靠：它可能把目标写进了叙述却忘了打标记。
    这里用一次独立的、低温的判定请求复核，前端只在模型未标记成功时才调用。
    """
    title = str(body.goal.get("title") or "").strip()
    has_scene = bool(body.scene and str(body.scene.get("description") or "").strip())
    if not title or not (body.narration.strip() or has_scene):
        return JSONResponse(status_code=400, content={"error": "缺少最终目标或本轮剧情"})

    messages = build_messages(
        body.goal,
        body.narration,
        body.scene,
        body.history,
    )

    try:
        config = resolve_ai_config(body.ai_config)
        raw = await chat_once(config, messages, temperature=0, max_tokens=512)
    except Exception as exc:
        return JSONResponse(
            status_code=502,
            content={
                "ok": False,
                "error": get_ai_error_message(exc, "判定最终目标失败"),
            },
        )

    payload = extract_json_object(raw)
    if payload is None:
        # 判定失败时前端还有本地兜底，不要因此中断冒险。
        return JSONResponse(
            {
                "ok": False,
                "achieved": False,
                "confidence": "low",
                "reason": "AI 判定结果无法解析",
            }
        )

    confidence = payload.get("confidence")
    return JSONResponse(
        {
            "ok": True,
            "achieved": payload.get("achieved") is True,
            "confidence": confidence if confidence in _CONFIDENCES else "low",
            "reason": str(payload.get("reason") or "").strip()[:200],
        }
    )

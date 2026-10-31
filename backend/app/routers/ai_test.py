from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.ai.client import chat_once
from app.ai.resolve import resolve_ai_config
from app.errors import get_ai_error_message
from app.schemas import AiTestRequest, ChatMessage


router = APIRouter(tags=["ai"])


@router.post("/ai/test")
async def ai_test(body: AiTestRequest) -> JSONResponse:
    try:
        config = resolve_ai_config(body.ai_config)
        reply = await chat_once(
            config,
            [
                ChatMessage(role="system", content="你是 AI 服务连通性测试助手，请只回复一句简短确认。"),
                ChatMessage(role="user", content="请回复：连接成功"),
            ],
            temperature=0,
            max_tokens=32,
        )
    except Exception as exc:
        return JSONResponse(
            status_code=502,
            content={"ok": False, "error": get_ai_error_message(exc, "AI 连接测试失败")},
        )
    return JSONResponse(
        {
            "ok": True,
            "reply": reply.strip(),
            "model": config.model,
        }
    )

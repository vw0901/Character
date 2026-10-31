from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, StreamingResponse

from app.ai.client import stream_chat
from app.ai.prompts.game_action import build_messages
from app.ai.resolve import resolve_ai_config
from app.ai.sse import SSE_HEADERS, sse_data, sse_error
from app.errors import get_ai_error_message
from app.schemas import GameActionRequest


router = APIRouter(tags=["game"])


@router.post("/game/action")
async def game_action(body: GameActionRequest, request: Request):
    if not body.bible or not body.game_state or not body.choice_id:
        return JSONResponse(status_code=400, content={"error": "缺少必要的游戏数据"})

    messages = build_messages(
        body.bible,
        body.game_state,
        body.choice_id,
        body.choice_text,
        body.character_choice,
    )

    async def generate():
        try:
            config = resolve_ai_config(body.ai_config)
            async for text in stream_chat(config, messages, temperature=0.9):
                if await request.is_disconnected():
                    return
                yield sse_data(text)
        except Exception as exc:
            yield sse_error(get_ai_error_message(exc, "处理游戏动作失败"))
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream; charset=utf-8",
        headers=SSE_HEADERS,
    )

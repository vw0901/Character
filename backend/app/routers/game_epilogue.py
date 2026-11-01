from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, StreamingResponse

from app.ai.client import stream_chat
from app.ai.prompts.epilogue import build_messages
from app.ai.resolve import resolve_ai_config
from app.ai.sse import SSE_HEADERS, sse_data, sse_error
from app.errors import get_ai_error_message
from app.schemas import GameEpilogueRequest


router = APIRouter(tags=["game"])


@router.post("/game/epilogue")
async def game_epilogue(body: GameEpilogueRequest, request: Request):
    """为已经结束的故事写后日谈。

    成功与失败都会写：成功写目标达成后的余波，失败写未竟之事的下落。
    流式返回纯文本，前端边收边显示，收完后随故事书一起存档。
    """
    title = str(body.goal.get("title") or "").strip()
    if not title:
        return JSONResponse(status_code=400, content={"error": "缺少最终目标"})
    if body.outcome not in {"success", "failure"}:
        return JSONResponse(status_code=400, content={"error": "故事尚未结束，无法书写后日谈"})

    messages = build_messages(
        body.bible,
        body.character_choice,
        body.goal,
        body.timeline,
        body.outcome,
        body.outcome_reason,
        body.ending_text,
        body.history,
    )

    async def generate():
        try:
            config = resolve_ai_config(body.ai_config)
            async for text in stream_chat(
                config, messages, temperature=0.85, max_tokens=1600
            ):
                if await request.is_disconnected():
                    return
                yield sse_data(text)
        except Exception as exc:
            yield sse_error(get_ai_error_message(exc, "书写后日谈失败"))
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream; charset=utf-8",
        headers=SSE_HEADERS,
    )

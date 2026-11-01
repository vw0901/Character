from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, StreamingResponse

from app.ai.client import stream_chat
from app.ai.prompts.check import build_messages
from app.ai.resolve import resolve_ai_config
from app.ai.sse import SSE_HEADERS, sse_data, sse_error
from app.errors import get_ai_error_message
from app.schemas import CheckRequest


router = APIRouter(tags=["check"])


@router.post("/check")
async def check(body: CheckRequest, request: Request):
    if not body.bible:
        return JSONResponse(status_code=400, content={"error": "请提供设定圣经数据"})

    messages = build_messages(body.bible)

    async def generate():
        try:
            config = resolve_ai_config(body.ai_config)
            async for text in stream_chat(
                config, messages, temperature=0.5, max_tokens=4096
            ):
                if await request.is_disconnected():
                    return
                yield sse_data(text)
        except Exception as exc:
            yield sse_error(get_ai_error_message(exc, "漏洞体检失败"))
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream; charset=utf-8",
        headers=SSE_HEADERS,
    )

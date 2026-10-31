from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, StreamingResponse

from app.ai.client import stream_chat
from app.ai.prompts.bible import build_messages
from app.ai.resolve import resolve_ai_config
from app.ai.sse import SSE_HEADERS, sse_data, sse_error
from app.errors import get_ai_error_message
from app.schemas import BibleRequest


router = APIRouter(tags=["bible"])


@router.post("/bible")
async def bible(body: BibleRequest, request: Request):
    novel_name = body.novel_name.strip()
    if not novel_name:
        return JSONResponse(status_code=400, content={"error": "请提供小说名称"})

    messages = build_messages(novel_name, body.search_results, body.search_summary)

    async def generate():
        try:
            config = resolve_ai_config(body.ai_config)
            async for text in stream_chat(config, messages, temperature=0.7):
                if await request.is_disconnected():
                    return
                yield sse_data(text)
        except Exception as exc:
            yield sse_error(get_ai_error_message(exc, "生成设定圣经失败"))
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream; charset=utf-8",
        headers=SSE_HEADERS,
    )

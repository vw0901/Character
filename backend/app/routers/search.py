from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.ai.resolve import resolve_ai_config
from app.ai.search import search_novel
from app.errors import get_ai_error_message
from app.schemas import SearchRequest


router = APIRouter(tags=["search"])


@router.post("/search")
async def search(body: SearchRequest) -> JSONResponse:
    novel_name = body.novel_name.strip()
    if not novel_name:
        return JSONResponse(status_code=400, content={"error": "请提供小说名称"})

    try:
        config = resolve_ai_config(body.ai_config)
        result = await search_novel(config, novel_name)
    except Exception as exc:
        return JSONResponse(
            status_code=502,
            content={"error": get_ai_error_message(exc, "搜索小说信息失败")},
        )
    return JSONResponse(result)

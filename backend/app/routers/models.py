from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.ai.client import list_models
from app.ai.resolve import resolve_ai_config
from app.errors import AIConfigurationError, get_ai_error_message
from app.schemas import AiConfig, ModelsRequest


router = APIRouter(tags=["models"])


@router.post("/models")
async def models(body: ModelsRequest) -> JSONResponse:
    config = body.ai_config.model_copy(deep=True) if body.ai_config else AiConfig()
    if body.base_url:
        config.base_url = body.base_url
    if body.api_key:
        config.api_key = body.api_key

    try:
        resolved = resolve_ai_config(config, require_model=False)
    except AIConfigurationError as exc:
        return JSONResponse(status_code=400, content={"error": str(exc)})
    except Exception as exc:
        return JSONResponse(
            status_code=400,
            content={"error": get_ai_error_message(exc, "AI 服务配置无效")},
        )

    try:
        available = await list_models(resolved)
    except Exception as exc:
        return JSONResponse(
            status_code=502,
            content={"error": get_ai_error_message(exc, "获取模型列表失败")},
        )
    return JSONResponse({"models": available})

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.version import APP_VERSION, PROJECT_FORMAT, PROJECT_FORMAT_VERSION


router = APIRouter(tags=["meta"])


@router.get("/meta")
async def meta() -> JSONResponse:
    return JSONResponse(
        {
            "version": APP_VERSION,
            "projectFormat": PROJECT_FORMAT,
            "projectFormatVersion": PROJECT_FORMAT_VERSION,
        }
    )

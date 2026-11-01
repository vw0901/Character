from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.config import STATIC_DIR
from app.routers import (
    ai_test,
    bible,
    check,
    game,
    game_action,
    game_goal,
    meta,
    models,
    projects,
    repair,
    search,
)


app = FastAPI(title="假如是你", description="小说设定圣经与 AI 文字冒险")


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    return JSONResponse(status_code=400, content={"error": "请求参数不完整或格式错误"})


for router in (
    search.router,
    bible.router,
    check.router,
    repair.router,
    game.router,
    game_action.router,
    game_goal.router,
    models.router,
    ai_test.router,
    projects.router,
    meta.router,
):
    app.include_router(router, prefix="/api")


@app.get("/healthz")
async def healthz() -> dict[str, str]:
    return {"status": "ok"}


_next_dir = STATIC_DIR / "_next"
if _next_dir.is_dir():
    app.mount("/_next", StaticFiles(directory=_next_dir), name="next-assets")

if STATIC_DIR.is_dir():
    app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")

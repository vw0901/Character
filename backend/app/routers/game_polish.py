import re

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.ai.client import chat_once
from app.ai.prompts.polish import build_messages
from app.ai.resolve import resolve_ai_config
from app.errors import get_ai_error_message
from app.schemas import GamePolishRequest


router = APIRouter(tags=["game"])

MAX_TEXT = 200
MAX_POLISHED = 200

_LABELS = ("润色后：", "润色后:", "润色：", "润色:", "改写：", "改写:", "行动：", "行动:", "结果：")


def clean_polish(raw: str) -> str:
    """模型偶尔会带上代码块、引号或「润色：」前缀，这里只留正文。"""
    text = (raw or "").strip()
    text = re.sub(r"```[a-zA-Z]*", "", text).strip()
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    if not lines:
        return ""

    text = lines[0]
    for label in _LABELS:
        if text.startswith(label):
            text = text[len(label) :].strip()
            break
    text = text.strip("“”\"'「」『』 ")
    return text[:MAX_POLISHED]


@router.post("/game/polish")
async def game_polish(body: GamePolishRequest) -> JSONResponse:
    """润色玩家自己写下的行动。

    只改写措辞，不推进剧情、不判定成败；玩家点「润色」才会走到这里。
    """
    text = body.text.strip()
    if not text:
        return JSONResponse(status_code=400, content={"ok": False, "error": "请先写下你想做的事"})
    if len(text) > MAX_TEXT:
        return JSONResponse(
            status_code=400,
            content={"ok": False, "error": f"行动描述最多 {MAX_TEXT} 字"},
        )

    messages = build_messages(
        body.bible,
        body.character_choice,
        body.goal,
        body.scene,
        text,
        body.history,
    )

    try:
        config = resolve_ai_config(body.ai_config)
        raw = await chat_once(config, messages, temperature=0.6, max_tokens=300)
    except Exception as exc:
        return JSONResponse(
            status_code=502,
            content={
                "ok": False,
                "error": get_ai_error_message(exc, "润色行动失败"),
            },
        )

    polished = clean_polish(raw)
    if not polished:
        return JSONResponse(
            status_code=502,
            content={"ok": False, "error": "AI 没有给出润色结果，请重试"},
        )

    return JSONResponse({"ok": True, "text": polished})

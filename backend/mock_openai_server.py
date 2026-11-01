import json
import os
import time
from collections.abc import Iterator
from typing import Any

import uvicorn
from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse


app = FastAPI(title="mock-openai-server")

BIBLE = {
    "novelName": "测试小说",
    "author": "测试作者",
    "status": "完结",
    "genre": "奇幻",
    "synopsis": "一个用于测试的设定圣经。",
    "worldview": {
        "summary": "测试世界观",
        "geography": "测试地理",
        "history": "测试历史",
        "rules": "测试规则",
    },
    "powerSystem": {
        "name": "测试体系",
        "levels": ["一阶", "二阶"],
        "description": "测试说明",
        "limitations": "测试限制",
    },
    "factions": [
        {"name": "测试势力", "description": "描述", "keyMembers": ["甲"], "goal": "目标"}
    ],
    "characters": [
        {
            "name": "林澈",
            "role": "主角",
            "abilities": "剑术",
            "personality": "谨慎",
            "relationships": "独行",
        }
    ],
    "timeline": [{"event": "开端", "description": "故事开始"}],
    "mysteries": [{"question": "谜题", "clues": "线索", "theories": "猜测"}],
}

CHECK = {
    "overallScore": 82,
    "summary": "整体设定稳定。",
    "issues": [
        {
            "category": "世界观",
            "severity": "中",
            "title": "测试漏洞",
            "description": "测试描述",
            "fix": "测试修补方案",
        }
    ],
    "strengths": ["人物动机清晰"],
}

REPAIR = {
    "summary": "已按体检报告补全世界观与力量体系。",
    "appliedFixes": [
        {
            "issue": "测试漏洞",
            "action": "补充了世界观限制条件",
            "field": "worldview",
        }
    ],
    "bible": BIBLE,
}

GAME = {
    "title": "测试冒险",
    "intro": "你睁开眼，雨落在青石板上。",
    "finalGoal": {
        "title": "在血月前找到失踪的妹妹",
        "description": "在血月降临前找到妹妹并带她离开古桥。",
    },
    "timeline": {
        "label": "血月降临前",
        "totalDays": 20,
        "currentDay": 1,
    },
    "playerCharacter": {
        "name": "林澈",
        "background": "游侠",
        "initialStats": {"health": 100, "power": 50, "reputation": 50},
    },
    "currentScene": {
        "id": "scene_1",
        "location": "古桥",
        "description": "雨幕中，一座断桥横在河面。",
        "choices": [
            {"id": "choice_1", "text": "过桥", "hint": "有风险"},
            {"id": "choice_2", "text": "沿河查看", "hint": "寻找线索"},
            {"id": "choice_3", "text": "返回", "hint": "安全"},
        ],
    },
}

ACTION = {
    "narration": "你踏上湿滑的石桥，身后传来脚步声。",
    "currentScene": {
        "id": "scene_2",
        "location": "桥心",
        "description": "河风卷起水雾，桥心立着一个戴斗笠的人。",
        "choices": [
            {"id": "choice_2_1", "text": "询问来意", "hint": "可能暴露位置"},
            {"id": "choice_2_2", "text": "拔剑戒备", "hint": "可能引发冲突"},
            {"id": "choice_2_3", "text": "跳入河水", "hint": "消耗体力"},
        ],
    },
    "statsChange": {"health": -5, "power": 2, "reputation": 1},
    "daysPassed": 1,
    "goalAchieved": False,
    "isEnding": False,
    "endingType": None,
    "endingText": "",
}


def _system_prompt(messages: list[dict[str, Any]]) -> str:
    for message in messages:
        if message.get("role") == "system":
            return str(message.get("content", ""))
    return ""


def _response_text(system_prompt: str, user_prompt: str) -> str:
    if "小说设定修补师" in system_prompt:
        return json.dumps(REPAIR, ensure_ascii=False, separators=(",", ":"))
    if "小说设定审计师" in system_prompt:
        return json.dumps(CHECK, ensure_ascii=False, separators=(",", ":"))
    if "文字冒险游戏大师" in system_prompt and "刚刚做出了一个选择" in system_prompt:
        return json.dumps(ACTION, ensure_ascii=False, separators=(",", ":"))
    if "文字冒险游戏大师" in system_prompt:
        return json.dumps(GAME, ensure_ascii=False, separators=(",", ":"))
    if "小说解析师" in system_prompt:
        return json.dumps(BIBLE, ensure_ascii=False, separators=(",", ":"))
    if "小说资料整理助手" in system_prompt:
        return "根据检索结果，这是一部测试小说，世界观设定完整。"
    if "博学的小说资料助手" in system_prompt:
        return json.dumps(
            {"summary": "测试作者创作的奇幻小说，目前已完结，核心围绕古桥与旧神展开。"},
            ensure_ascii=False,
            separators=(",", ":"),
        )
    if "连通性测试助手" in system_prompt:
        return "连接成功"
    return f"收到：{user_prompt[:20]}"


def _chunk(model: str, content: str, finish_reason: str | None = None) -> dict[str, Any]:
    return {
        "id": "chatcmpl-mock",
        "object": "chat.completion.chunk",
        "created": int(time.time()),
        "model": model,
        "choices": [
            {
                "index": 0,
                "delta": {"content": content} if content else {},
                "finish_reason": finish_reason,
            }
        ],
    }


def _stream_chunks(model: str, text: str) -> Iterator[str]:
    split = max(1, len(text) // 3)
    pieces = [text[index : index + split] for index in range(0, len(text), split)]
    for piece in pieces:
        payload = _chunk(model, piece)
        yield f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"
    yield f"data: {json.dumps(_chunk(model, '', 'stop'), ensure_ascii=False)}\n\n"
    yield "data: [DONE]\n\n"


@app.get("/v1/models")
async def models(authorization: str | None = Header(default=None)) -> JSONResponse:
    if authorization and authorization.endswith("bad"):
        raise HTTPException(status_code=401, detail="invalid api key")
    return JSONResponse(
        {
            "object": "list",
            "data": [
                {"id": "mock-chat", "object": "model"},
                {"id": "mock-reasoner", "object": "model"},
            ],
        }
    )


@app.post("/v1/chat/completions")
async def chat_completions(
    payload: dict[str, Any],
    authorization: str | None = Header(default=None),
) -> Any:
    if authorization and authorization.endswith("bad"):
        raise HTTPException(status_code=401, detail="invalid api key")

    model = str(payload.get("model") or "mock-chat")
    messages = payload.get("messages") or []
    system_prompt = _system_prompt(messages if isinstance(messages, list) else [])
    user_prompt = ""
    if isinstance(messages, list):
        for message in reversed(messages):
            if isinstance(message, dict) and message.get("role") == "user":
                user_prompt = str(message.get("content") or "")
                break

    text = _response_text(system_prompt, user_prompt)
    if payload.get("stream"):
        if model == "nonstream-only":
            raise HTTPException(status_code=400, detail="stream not supported")
        return StreamingResponse(
            _stream_chunks(model, text),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache"},
        )

    return JSONResponse(
        {
            "id": "chatcmpl-mock",
            "object": "chat.completion",
            "created": int(time.time()),
            "model": model,
            "choices": [
                {
                    "index": 0,
                    "message": {"role": "assistant", "content": text},
                    "finish_reason": "stop",
                }
            ],
            "usage": {"prompt_tokens": 1, "completion_tokens": 1, "total_tokens": 2},
        }
    )


@app.get("/healthz")
async def healthz() -> dict[str, str]:
    return {"status": "ok"}


if __name__ == "__main__":
    uvicorn.run(
        app,
        host=os.getenv("MOCK_HOST", "127.0.0.1"),
        port=int(os.getenv("MOCK_PORT", "4900")),
        log_level="info",
    )

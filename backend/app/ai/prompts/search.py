import json
from collections.abc import Sequence

from app.schemas import ChatMessage, SearchResult


SUMMARY_SYSTEM_PROMPT = """你是一位严谨的小说资料整理助手。请仅依据提供的检索结果，整理小说作者、完结状态、类型、世界观设定、主要人物等已知信息。
不要编造检索结果中不存在的事实，不确定的信息请明确标注为“未确认”。
输出 2-4 段简洁的中文摘要，不要输出 JSON，不要输出 markdown 标题。"""

FALLBACK_SYSTEM_PROMPT = """你是一位博学的小说资料助手。用户没有提供联网检索结果，请基于你的已有知识介绍这部小说。
请严格输出以下 JSON，不要输出 markdown 代码块或额外文字：
{
  "summary": "关于作者、完结状态、类型、世界观、主要人物和核心设定的中文摘要；不确定的信息明确标注为“未确认”"
}"""


def build_summary_messages(query: str, results: Sequence[SearchResult]) -> list[ChatMessage]:
    snippets = "\n\n".join(
        f"{index + 1}. {item.title}\nURL: {item.url}\n{item.snippet}"
        for index, item in enumerate(results[:10])
    )
    user_content = f"检索词：{query}\n\n检索结果：\n{snippets}"
    return [
        ChatMessage(role="system", content=SUMMARY_SYSTEM_PROMPT),
        ChatMessage(role="user", content=user_content),
    ]


def build_fallback_messages(novel_name: str) -> list[ChatMessage]:
    return [
        ChatMessage(role="system", content=FALLBACK_SYSTEM_PROMPT),
        ChatMessage(
            role="user",
            content=f"请介绍小说《{novel_name}》的作者、完结状态、类型、世界观设定和主要人物。",
        ),
    ]


def parse_fallback_summary(text: str) -> str:
    from app.ai.json_utils import extract_json_object

    payload = extract_json_object(text)
    if payload and isinstance(payload.get("summary"), str):
        return payload["summary"].strip()
    try:
        payload = json.loads(text)
        if isinstance(payload, dict) and isinstance(payload.get("summary"), str):
            return payload["summary"].strip()
    except (TypeError, ValueError):
        pass
    return text.strip()

import logging
from typing import Any
from urllib.parse import urlparse

import httpx

from app.ai.client import chat_once
from app.ai.prompts.search import (
    build_fallback_messages,
    build_summary_messages,
    parse_fallback_summary,
)
from app.ai.resolve import ResolvedAiConfig
from app.schemas import SearchResult


logger = logging.getLogger(__name__)
TAVILY_URL = "https://api.tavily.com/search"


def _site_name(url: str) -> str:
    host = urlparse(url).netloc.lower()
    return host[4:] if host.startswith("www.") else host


async def _tavily_search(config: ResolvedAiConfig, query: str) -> tuple[list[SearchResult], str]:
    timeout = min(max(config.timeout, 10.0), 60.0)
    payload = {
        "query": query,
        "max_results": 10,
        "include_answer": True,
        "search_depth": "basic",
    }
    headers = {
        "Authorization": f"Bearer {config.tavily_api_key}",
        "User-Agent": "novel-ai/1.0",
    }
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.post(TAVILY_URL, json=payload, headers=headers)
        response.raise_for_status()
        data = response.json()

    raw_items = data.get("results", []) if isinstance(data, dict) else []
    results: list[SearchResult] = []
    for item in raw_items:
        if not isinstance(item, dict):
            continue
        url = str(item.get("url") or "")
        results.append(
            SearchResult(
                title=str(item.get("title") or ""),
                url=url,
                snippet=str(item.get("content") or item.get("snippet") or ""),
                site_name=_site_name(url),
            )
        )
    answer = data.get("answer") if isinstance(data, dict) else ""
    return results, answer.strip() if isinstance(answer, str) else ""


async def _summarize_results(
    config: ResolvedAiConfig,
    query: str,
    results: list[SearchResult],
) -> str:
    return await chat_once(
        config,
        build_summary_messages(query, results),
        temperature=0.3,
    )


async def _model_fallback_summary(config: ResolvedAiConfig, novel_name: str) -> str:
    reply = await chat_once(
        config,
        build_fallback_messages(novel_name),
        temperature=0.3,
    )
    return parse_fallback_summary(reply)


def _snippet_summary(results: list[SearchResult]) -> str:
    return "\n\n".join(
        f"{item.title}：{item.snippet}" for item in results[:5] if item.snippet
    )


async def search_novel(config: ResolvedAiConfig, novel_name: str) -> dict[str, Any]:
    query = f"{novel_name} 小说 作者 完结状态 世界观设定"
    results: list[SearchResult] = []
    summary = ""

    if config.search_provider == "tavily" and config.tavily_api_key:
        try:
            results, summary = await _tavily_search(config, query)
            if results and not summary:
                try:
                    summary = await _summarize_results(config, query, results)
                except Exception:
                    logger.exception("Failed to summarize Tavily search results")
                    summary = _snippet_summary(results)
        except Exception:
            logger.exception("Tavily search failed; falling back to model knowledge")

    if not summary:
        summary = await _model_fallback_summary(config, novel_name)

    return {
        "novelName": novel_name,
        "summary": summary,
        "results": [item.model_dump(by_alias=True) for item in results],
    }

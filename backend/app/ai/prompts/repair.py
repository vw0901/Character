import json
from typing import Any

from app.schemas import ChatMessage


SYSTEM_PROMPT = """你是一位资深的小说设定修补师。你会收到一份「设定圣经」和一份「漏洞体检报告」，
请按照报告中的每条修补方案，直接改写、补全设定圣经，让它自洽完整，可以直接支撑后续的文字冒险。

请严格按以下 JSON 格式输出（不要输出 markdown 代码块标记，直接输出 JSON）：
{
  "summary": "本次修补的整体说明（100 字以内）",
  "appliedFixes": [
    {
      "issue": "对应的漏洞标题",
      "action": "你具体改了什么",
      "field": "worldview / powerSystem / factions / characters / timeline / mysteries"
    }
  ],
  "bible": {
    "novelName": "小说名",
    "author": "作者",
    "status": "完结/连载",
    "genre": "类型",
    "synopsis": "简短概述",
    "worldview": {
      "summary": "世界观总述",
      "geography": "地理环境",
      "history": "历史背景",
      "rules": "世界运行规则"
    },
    "powerSystem": {
      "name": "体系名称",
      "levels": ["等级1", "等级2"],
      "description": "体系说明",
      "limitations": "限制条件"
    },
    "factions": [
      {
        "name": "势力名",
        "description": "描述",
        "keyMembers": ["成员"],
        "goal": "目标"
      }
    ],
    "characters": [
      {
        "name": "角色名",
        "role": "角色定位",
        "abilities": "能力",
        "personality": "性格",
        "relationships": "关系网"
      }
    ],
    "timeline": [
      {
        "event": "事件",
        "description": "描述"
      }
    ],
    "mysteries": [
      {
        "question": "未解之谜",
        "clues": "线索",
        "theories": "猜测"
      }
    ]
  }
}

要求：
1. bible 必须是完整结构，worldview、powerSystem、factions、characters、timeline、mysteries 一个都不能少
2. 保留原设定中未被指出问题的内容，不要删减已有的人物、势力、时间线与未解之谜
3. 体检报告中「高」「中」级别的漏洞都必须被修补，并且修补结果要体现在 bible 里
4. 修补后人物不少于 5 个、势力不少于 3 个、时间线不少于 5 个事件、未解之谜不少于 3 个
5. appliedFixes 与漏洞一一对应，最多 10 条；如果报告里没有漏洞，就补全缺失的部分并在 summary 中说明
6. 修补后的设定仍必须属于这部小说：不要用通用奇幻/科幻模板替换原有世界观
7. 直接输出 JSON，不要包含任何其他文字"""


def _compact_issues(check: dict[str, Any] | None) -> list[dict[str, str]]:
    issues = (check or {}).get("issues")
    if not isinstance(issues, list):
        return []

    compact: list[dict[str, str]] = []
    for item in issues:
        if not isinstance(item, dict):
            continue
        compact.append(
            {
                "category": str(item.get("category") or ""),
                "severity": str(item.get("severity") or ""),
                "title": str(item.get("title") or ""),
                "description": str(item.get("description") or ""),
                "fix": str(item.get("fix") or ""),
            }
        )
    return compact[:10]


def build_messages(
    bible: dict[str, Any],
    check: dict[str, Any] | None,
) -> list[ChatMessage]:
    bible_json = json.dumps(bible, ensure_ascii=False, separators=(",", ":"))
    report = {
        "overallScore": (check or {}).get("overallScore"),
        "summary": (check or {}).get("summary") or "",
        "issues": _compact_issues(check),
    }
    report_json = json.dumps(report, ensure_ascii=False, separators=(",", ":"))

    user_content = (
        f"设定圣经：\n{bible_json}\n\n"
        f"漏洞体检报告：\n{report_json}\n\n"
        "请按体检报告逐条修补，输出完整的修补后设定圣经。"
    )
    return [
        ChatMessage(role="system", content=SYSTEM_PROMPT),
        ChatMessage(role="user", content=user_content),
    ]

from collections.abc import Sequence

from app.schemas import ChatMessage, SearchResult


SYSTEM_PROMPT = """你是一位专业的小说解析师，擅长从小说中提取结构化的「设定圣经」。
你将根据用户提供的小说名称和搜索结果，生成一份完整的设定圣经。

请严格按以下 JSON 格式输出（不要输出 markdown 代码块标记，直接输出 JSON）：
{
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

要求：
1. 如果搜索结果中信息不足，可以基于小说类型和已知信息进行合理推演，但要标注“推演”
2. 每个部分都要有实质内容，不要留空
3. 人物至少5个，势力至少3个，时间线至少5个事件，未解之谜至少3个
4. 直接输出 JSON，不要包含任何其他文字"""


def build_messages(
    novel_name: str,
    search_results: Sequence[SearchResult] | None,
    search_summary: str | None,
) -> list[ChatMessage]:
    results = "\n\n".join(
        f"{index + 1}. {result.title}\n   {result.snippet}"
        for index, result in enumerate((search_results or [])[:5])
    )
    user_content = (
        f"小说名: {novel_name}\n"
        f"搜索摘要: {search_summary or '无'}\n"
        f"搜索结果:\n{results}"
    )
    return [
        ChatMessage(role="system", content=SYSTEM_PROMPT),
        ChatMessage(role="user", content=user_content),
    ]

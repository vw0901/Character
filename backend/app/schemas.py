from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class APIModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")


class ChatMessage(APIModel):
    role: Literal["system", "user", "assistant"]
    content: str


class AiConfig(APIModel):
    base_url: str | None = Field(default=None, alias="baseUrl")
    api_key: str | None = Field(default=None, alias="apiKey")
    model: str | None = None
    temperature: float | None = None
    search_provider: str | None = Field(default=None, alias="searchProvider")
    tavily_api_key: str | None = Field(default=None, alias="tavilyApiKey")
    timeout: float | None = None


class SearchResult(APIModel):
    title: str = ""
    url: str = ""
    snippet: str = ""
    site_name: str = Field(default="", alias="siteName")


class SearchRequest(APIModel):
    novel_name: str = Field(alias="novelName")
    ai_config: AiConfig | None = Field(default=None, alias="aiConfig")


class BibleRequest(APIModel):
    novel_name: str = Field(alias="novelName")
    search_results: list[SearchResult] = Field(default_factory=list, alias="searchResults")
    search_summary: str = Field(default="", alias="searchSummary")
    ai_config: AiConfig | None = Field(default=None, alias="aiConfig")


class CheckRequest(APIModel):
    bible: dict[str, Any]
    ai_config: AiConfig | None = Field(default=None, alias="aiConfig")


class CharacterChoice(APIModel):
    mode: str | None = None
    name: str
    background: str = ""
    abilities: str | None = None
    personality: str | None = None


class GameRequest(APIModel):
    bible: dict[str, Any]
    character_choice: CharacterChoice | None = Field(default=None, alias="characterChoice")
    ai_config: AiConfig | None = Field(default=None, alias="aiConfig")


class GameActionRequest(APIModel):
    bible: dict[str, Any]
    game_state: dict[str, Any] = Field(alias="gameState")
    choice_id: str = Field(alias="choiceId")
    choice_text: str = Field(default="", alias="choiceText")
    history: list[dict[str, Any]] = Field(default_factory=list)
    character_choice: CharacterChoice | None = Field(default=None, alias="characterChoice")
    ai_config: AiConfig | None = Field(default=None, alias="aiConfig")


class GameGoalCheckRequest(APIModel):
    goal: dict[str, Any]
    narration: str = ""
    scene: dict[str, Any] | None = None
    history: list[dict[str, Any]] = Field(default_factory=list)
    ai_config: AiConfig | None = Field(default=None, alias="aiConfig")


class GamePolishRequest(APIModel):
    text: str
    bible: dict[str, Any] = Field(default_factory=dict)
    character_choice: CharacterChoice | None = Field(default=None, alias="characterChoice")
    goal: dict[str, Any] | None = None
    scene: dict[str, Any] | None = None
    history: list[dict[str, Any]] = Field(default_factory=list)
    ai_config: AiConfig | None = Field(default=None, alias="aiConfig")


class GameEpilogueRequest(APIModel):
    bible: dict[str, Any] = Field(default_factory=dict)
    character_choice: CharacterChoice | None = Field(default=None, alias="characterChoice")
    goal: dict[str, Any]
    timeline: dict[str, Any] | None = None
    outcome: str
    outcome_reason: str = Field(default="", alias="outcomeReason")
    ending_text: str = Field(default="", alias="endingText")
    history: list[dict[str, Any]] = Field(default_factory=list)
    ai_config: AiConfig | None = Field(default=None, alias="aiConfig")


class RepairRequest(APIModel):
    bible: dict[str, Any]
    check: dict[str, Any] | None = None
    ai_config: AiConfig | None = Field(default=None, alias="aiConfig")


class ModelsRequest(APIModel):
    ai_config: AiConfig | None = Field(default=None, alias="aiConfig")
    base_url: str | None = Field(default=None, alias="baseUrl")
    api_key: str | None = Field(default=None, alias="apiKey")


class AiTestRequest(APIModel):
    ai_config: AiConfig | None = Field(default=None, alias="aiConfig")

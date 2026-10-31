import {
  APP_VERSION,
  MAX_UNDO_SNAPSHOTS,
  PROJECT_FORMAT,
  PROJECT_FORMAT_VERSION,
  type AdventureSnapshot,
  type AdventureState,
  type CharacterChoice,
  type CheckResult,
  type GameState,
  type HistoryEntry,
  type ProjectDocument,
  type RepairFix,
  type RepairResult,
  type Scene,
  type SceneResult,
  type SearchData,
  type SettingBible,
  type StatValues,
} from "./types";

const DEFAULT_STATS: StatValues = { health: 100, power: 50, reputation: 50 };

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value.trim() ? value : fallback;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
}

function numberValue(value: unknown, fallback = 0): number {
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function stringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => text(item)).filter(Boolean);
  }
  const single = text(value);
  return single ? [single] : [];
}

function normalizeStats(value: unknown): StatValues {
  const record = asRecord(value) ?? {};
  return {
    health: clamp(Math.round(numberValue(record.health, DEFAULT_STATS.health)), 0, 100),
    power: clamp(Math.round(numberValue(record.power, DEFAULT_STATS.power)), 0, 100),
    reputation: clamp(
      Math.round(numberValue(record.reputation, DEFAULT_STATS.reputation)),
      0,
      100
    ),
  };
}

/** 模型输常常带说明文字或 ``` 代码块，这里做宽松解析。 */
export function parseJsonLoose(raw: string): unknown | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const unfenced = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const candidates = [trimmed, unfenced];
  const start = unfenced.indexOf("{");
  const end = unfenced.lastIndexOf("}");
  if (start !== -1 && end > start) {
    candidates.push(unfenced.slice(start, end + 1));
  }

  for (const candidate of candidates) {
    try {
      const parsed: unknown = JSON.parse(candidate);
      if (parsed !== null && typeof parsed === "object") return parsed;
    } catch {
      // 继续尝试下一个候选。
    }
    try {
      const repaired = JSON.parse(
        candidate.replace(/,\s*([}\]])/g, "$1").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
      );
      if (repaired !== null && typeof repaired === "object") return repaired;
    } catch {
      // 继续尝试下一个候选。
    }
  }
  return null;
}

export function normalizeSearchData(value: unknown, fallbackName = ""): SearchData | null {
  const record = asRecord(value);
  if (!record) return null;

  const results = asArray(record.results)
    .map((item) => {
      const row = asRecord(item);
      if (!row) return null;
      const title = text(row.title);
      const snippet = text(row.snippet);
      if (!title && !snippet) return null;
      return {
        title,
        url: text(row.url),
        snippet,
        siteName: text(row.siteName) || text(row.site_name),
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const novelName = text(record.novelName, fallbackName);
  if (!novelName && results.length === 0) return null;

  return { novelName, summary: text(record.summary), results };
}

export function normalizeBible(value: unknown, fallbackName = ""): SettingBible | null {
  const record = asRecord(value);
  if (!record) return null;

  const worldview = asRecord(record.worldview) ?? {};
  const powerSystem = asRecord(record.powerSystem) ?? asRecord(record.power_system) ?? {};

  const factions = asArray(record.factions)
    .map((item) => {
      const row = asRecord(item);
      if (!row) return null;
      const name = text(row.name);
      if (!name) return null;
      return {
        name,
        description: text(row.description),
        keyMembers: stringList(row.keyMembers ?? row.key_members),
        goal: text(row.goal),
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const characters = asArray(record.characters)
    .map((item) => {
      const row = asRecord(item);
      if (!row) return null;
      const name = text(row.name);
      if (!name) return null;
      return {
        name,
        role: text(row.role),
        abilities: text(row.abilities),
        personality: text(row.personality),
        relationships: text(row.relationships),
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const timeline = asArray(record.timeline)
    .map((item) => {
      const row = asRecord(item);
      if (!row) return null;
      const event = text(row.event);
      if (!event) return null;
      return { event, description: text(row.description) };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const mysteries = asArray(record.mysteries)
    .map((item) => {
      const row = asRecord(item);
      if (!row) return null;
      const question = text(row.question);
      if (!question) return null;
      return {
        question,
        clues: text(row.clues),
        theories: text(row.theories),
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const bible: SettingBible = {
    novelName: text(record.novelName, fallbackName),
    author: text(record.author),
    status: text(record.status),
    genre: text(record.genre),
    synopsis: text(record.synopsis),
    worldview: {
      summary: text(worldview.summary),
      geography: text(worldview.geography),
      history: text(worldview.history),
      rules: text(worldview.rules),
    },
    powerSystem: {
      name: text(powerSystem.name),
      levels: stringList(powerSystem.levels),
      description: text(powerSystem.description),
      limitations: text(powerSystem.limitations),
    },
    factions,
    characters,
    timeline,
    mysteries,
  };

  const recognizable =
    Boolean(bible.novelName) ||
    factions.length > 0 ||
    characters.length > 0 ||
    timeline.length > 0 ||
    mysteries.length > 0 ||
    Boolean(bible.worldview.summary) ||
    Boolean(bible.synopsis);
  return recognizable ? bible : null;
}

export function normalizeCheck(value: unknown): CheckResult | null {
  const record = asRecord(value);
  if (!record) return null;

  const issues = asArray(record.issues)
    .map((item) => {
      const row = asRecord(item);
      if (!row) return null;
      return {
        category: text(row.category),
        severity: text(row.severity),
        title: text(row.title),
        description: text(row.description),
        fix: text(row.fix),
      };
    })
    .filter(
      (item): item is NonNullable<typeof item> =>
        item !== null && Boolean(item.title || item.description)
    );

  const summary = text(record.summary);
  const hasScore = record.overallScore !== undefined || record.overall_score !== undefined;
  if (!summary && issues.length === 0 && !hasScore) return null;

  return {
    overallScore: clamp(
      Math.round(numberValue(record.overallScore ?? record.overall_score)),
      0,
      100
    ),
    summary,
    issues,
    strengths: stringList(record.strengths),
  };
}

export function normalizeRepair(value: unknown): RepairResult | null {
  const record = asRecord(value);
  if (!record) return null;

  const bible = normalizeBible(record.bible);
  if (!bible) return null;

  const appliedFixes = asArray(record.appliedFixes ?? record.applied_fixes)
    .map((item) => {
      const row = asRecord(item);
      if (!row) return null;
      const issue = text(row.issue) || text(row.title);
      const action = text(row.action) || text(row.fix);
      if (!issue && !action) return null;
      return { issue, action, field: text(row.field) } satisfies RepairFix;
    })
    .filter((item): item is RepairFix => item !== null);

  return {
    summary: text(record.summary),
    appliedFixes,
    bible,
  };
}

export function normalizeScene(value: unknown, fallbackPrefix = "scene"): Scene | null {
  const record = asRecord(value);
  if (!record) return null;

  const choices = asArray(record.choices)
    .map((item, index) => {
      const row = asRecord(item);
      if (!row) return null;
      const label = text(row.text) || text(row.label);
      if (!label) return null;
      const hint = text(row.hint);
      return {
        id: text(row.id) || `${fallbackPrefix}_choice_${index + 1}`,
        text: label,
        ...(hint ? { hint } : {}),
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const location = text(record.location);
  const description = text(record.description);
  if (!location && !description && choices.length === 0) return null;

  return {
    id: text(record.id) || `${fallbackPrefix}_1`,
    location,
    description,
    choices,
  };
}

export function normalizeGameState(value: unknown): GameState | null {
  const record = asRecord(value);
  if (!record) return null;

  const scene = normalizeScene(record.currentScene ?? record.current_scene);
  if (!scene) return null;

  const player = asRecord(record.playerCharacter ?? record.player_character) ?? {};

  return {
    title: text(record.title),
    intro: text(record.intro),
    playerCharacter: {
      name: text(player.name),
      background: text(player.background),
      initialStats: normalizeStats(player.initialStats ?? player.initial_stats),
    },
    currentScene: scene,
  };
}

export function normalizeSceneResult(value: unknown): SceneResult | null {
  const record = asRecord(value);
  if (!record) return null;

  const scene = normalizeScene(record.currentScene ?? record.current_scene, "scene");
  const narration = text(record.narration);
  const isEnding = record.isEnding === true || record.is_ending === true;
  const endingText = text(record.endingText ?? record.ending_text);

  if (isEnding) {
    if (!narration && !endingText) return null;
    return {
      narration,
      currentScene: scene ?? { id: "ending", location: "", description: "", choices: [] },
      statsChange: normalizeStatsChange(record),
      isEnding: true,
      endingText,
    };
  }

  if (!scene || (!narration && scene.choices.length === 0)) return null;

  return {
    narration,
    currentScene: scene,
    statsChange: normalizeStatsChange(record),
    isEnding: false,
    endingText,
  };
}

function normalizeStatsChange(record: Record<string, unknown>): Partial<StatValues> {
  const changes = asRecord(record.statsChange ?? record.stats_change) ?? {};
  return {
    health: Math.round(numberValue(changes.health)),
    power: Math.round(numberValue(changes.power)),
    reputation: Math.round(numberValue(changes.reputation)),
  };
}

function normalizeCharacter(value: unknown): CharacterChoice | null {
  const record = asRecord(value);
  if (!record) return null;
  const name = text(record.name);
  if (!name) return null;
  return {
    mode: record.mode === "custom" ? "custom" : "existing",
    name,
    background: text(record.background),
    ...(text(record.abilities) ? { abilities: text(record.abilities) } : {}),
    ...(text(record.personality) ? { personality: text(record.personality) } : {}),
  };
}

function normalizeHistory(value: unknown): HistoryEntry[] {
  return asArray(value)
    .map((item) => {
      const row = asRecord(item);
      if (!row) return null;
      const content = text(row.text);
      if (!content) return null;
      const type: HistoryEntry["type"] = row.type === "choice" ? "choice" : "narration";
      return { type, text: content };
    })
    .filter((item): item is HistoryEntry => item !== null);
}

function normalizeSnapshots(value: unknown): AdventureSnapshot[] {
  return asArray(value)
    .map((item) => {
      const record = asRecord(item);
      if (!record) return null;
      const gameState = normalizeGameState(record.gameState ?? record.game_state);
      if (!gameState) return null;
      return {
        gameState,
        stats: normalizeStats(record.stats),
        history: normalizeHistory(record.history),
        isEnding: record.isEnding === true,
        endingText: text(record.endingText ?? record.ending_text),
        turn: Math.max(0, Math.round(numberValue(record.turn))),
      } satisfies AdventureSnapshot;
    })
    .filter((item): item is AdventureSnapshot => item !== null)
    .slice(-MAX_UNDO_SNAPSHOTS);
}

export function normalizeAdventure(value: unknown): AdventureState | null {
  const record = asRecord(value);
  if (!record) return null;

  const character = normalizeCharacter(record.character);
  if (!character) return null;

  const gameState = normalizeGameState(record.gameState ?? record.game_state);
  const history = normalizeHistory(record.history);

  return {
    character,
    gameState,
    stats: normalizeStats(record.stats),
    history,
    isEnding: record.isEnding === true,
    endingText: text(record.endingText ?? record.ending_text),
    turn: Math.max(0, Math.round(numberValue(record.turn))),
    snapshots: normalizeSnapshots(record.snapshots),
    startedAt: text(record.startedAt ?? record.started_at) || new Date().toISOString(),
  };
}

function slugify(name: string): string {
  return name
    .trim()
    .replace(/[^\p{L}\p{N}_-]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function makeProjectId(name: string): string {
  const slug = slugify(name);
  return slug || `novel-${Date.now().toString(36)}`;
}

function baseProject(novelName: string): ProjectDocument {
  const now = new Date().toISOString();
  return {
    format: PROJECT_FORMAT,
    formatVersion: PROJECT_FORMAT_VERSION,
    appVersion: APP_VERSION,
    id: makeProjectId(novelName || "未命名"),
    novelName: novelName || "未命名",
    createdAt: now,
    updatedAt: now,
    search: null,
    bible: null,
    check: null,
    repair: null,
    adventure: null,
  };
}

export function createProjectFromSearch(search: SearchData): ProjectDocument {
  return { ...baseProject(search.novelName), search };
}

export function createProjectFromBible(bible: SettingBible): ProjectDocument {
  return { ...baseProject(bible.novelName), bible };
}

/** 解析导入的 JSON，自动识别「项目存档 / 设定圣经 / 检索结果」三种结构。 */
export function parseImportedJson(
  raw: string
): { project: ProjectDocument; kind: "project" | "bible" | "search" } {
  const parsed = parseJsonLoose(raw);
  if (!parsed) throw new Error("文件内容不是有效的 JSON");
  const record = asRecord(parsed);
  if (!record) throw new Error("JSON 顶层必须是一个对象");

  const looksLikeProject =
    record.format === PROJECT_FORMAT ||
    "search" in record ||
    "bible" in record ||
    "adventure" in record;

  if (looksLikeProject) {
    const project = normalizeProject(record);
    if (project) return { project, kind: "project" };
  }

  const bibleFields = [
    "worldview",
    "powerSystem",
    "power_system",
    "factions",
    "characters",
    "timeline",
    "mysteries",
  ];
  const looksLikeBible = bibleFields.some((key) => key in record);
  const looksLikeSearch =
    Array.isArray(record.results) || (!looksLikeBible && "summary" in record);

  if (looksLikeBible) {
    const bible = normalizeBible(record);
    if (bible) return { project: createProjectFromBible(bible), kind: "bible" };
  }

  if (looksLikeSearch) {
    const search = normalizeSearchData(record);
    if (search) return { project: createProjectFromSearch(search), kind: "search" };
  }

  const bible = normalizeBible(record);
  if (bible) return { project: createProjectFromBible(bible), kind: "bible" };

  const search = normalizeSearchData(record);
  if (search) return { project: createProjectFromSearch(search), kind: "search" };

  throw new Error("无法识别的 JSON：既不是项目存档，也不是设定圣经或检索结果");
}

export function normalizeProject(value: unknown): ProjectDocument | null {
  const record = asRecord(value);
  if (!record) return null;

  const search = normalizeSearchData(record.search);
  const bible = normalizeBible(record.bible);
  const check = normalizeCheck(record.check);
  const repair = normalizeRepair(record.repair);
  const adventure = normalizeAdventure(record.adventure);

  if (!search && !bible && !check && !repair && !adventure) return null;

  const novelName =
    text(record.novelName) ||
    search?.novelName ||
    bible?.novelName ||
    adventure?.gameState?.title ||
    "未命名";

  const base = baseProject(novelName);
  const storedId = text(record.id);
  return {
    ...base,
    // 导入的文件可能来自别的机器，但已有 id 时沿用，便于覆盖同名存档。
    id: storedId && /^[\p{L}\p{N}_-]{1,64}$/u.test(storedId) ? storedId : base.id,
    createdAt: text(record.createdAt) || base.createdAt,
    updatedAt: text(record.updatedAt) || base.updatedAt,
    appVersion: text(record.appVersion) || APP_VERSION,
    search,
    bible,
    check,
    repair,
    adventure,
  };
}

import { asRecord, parseJsonLoose, text } from "./json";
import {
  normalizeBible,
  normalizeCheck,
  normalizeRepair,
  normalizeSearchData,
} from "./content";
import { normalizeAdventure } from "./game";
import { characterKey } from "../adventure";
import {
  APP_VERSION,
  PROJECT_FORMAT,
  PROJECT_FORMAT_VERSION,
  type AdventureState,
  type ProjectDocument,
  type SearchData,
  type SettingBible,
} from "../types";

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
    adventures: {},
    activeAdventureKey: null,
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
    "adventure" in record ||
    "adventures" in record;

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

/** 兼容旧版的单个 `adventure`，统一收进按角色索引的故事书表。 */
function normalizeAdventures(record: Record<string, unknown>): {
  adventures: Record<string, AdventureState>;
  legacyActiveKey: string | null;
} {
  const adventures: Record<string, AdventureState> = {};
  const raw = asRecord(record.adventures);
  if (raw) {
    for (const [key, value] of Object.entries(raw)) {
      const adventure = normalizeAdventure(value);
      if (adventure) adventures[key] = adventure;
    }
  }

  const legacy = normalizeAdventure(record.adventure);
  let legacyActiveKey: string | null = null;
  if (legacy) {
    const key = characterKey(legacy.character);
    if (!adventures[key]) adventures[key] = legacy;
    legacyActiveKey = key;
  }

  return { adventures, legacyActiveKey };
}

export function normalizeProject(value: unknown): ProjectDocument | null {
  const record = asRecord(value);
  if (!record) return null;

  const search = normalizeSearchData(record.search);
  const bible = normalizeBible(record.bible);
  const check = normalizeCheck(record.check);
  const repair = normalizeRepair(record.repair);
  const { adventures, legacyActiveKey } = normalizeAdventures(record);

  if (!search && !bible && !check && !repair && Object.keys(adventures).length === 0) {
    return null;
  }

  const novelName =
    text(record.novelName) ||
    search?.novelName ||
    bible?.novelName ||
    Object.values(adventures).find((item) => item.gameState?.title)?.gameState?.title ||
    "未命名";

  const base = baseProject(novelName);
  const storedId = text(record.id);
  const storedActive = text(record.activeAdventureKey);
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
    adventures,
    activeAdventureKey:
      storedActive && adventures[storedActive] ? storedActive : legacyActiveKey,
  };
}

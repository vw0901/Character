import { clamp } from "../rules";
import {
  asArray,
  asRecord,
  numberValue,
  stringList,
  text,
} from "./json";
import type {
  CheckResult,
  RepairFix,
  RepairResult,
  SearchData,
  SettingBible,
} from "../types";

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

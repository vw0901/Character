import { asArray, asRecord, clamp, numberValue, normalizeStats, text } from "./json";
import {
  MAX_UNDO_SNAPSHOTS,
  type AdventureOutcome,
  type AdventureSnapshot,
  type AdventureState,
  type CharacterChoice,
  type GameState,
  type HistoryEntry,
  type Scene,
  type SceneResult,
  type StatValues,
  type StoryGoal,
  type StoryTimeline,
} from "../types";
import { DEFAULT_TIMELINE } from "../adventure";

export interface GameOpening {
  gameState: GameState;
  goal: StoryGoal;
  timeline: StoryTimeline;
}

export function normalizeStoryGoal(value: unknown): StoryGoal {
  const record = asRecord(value) ?? {};
  const title = text(record.title);
  const description = text(record.description);
  if (!title && !description) {
    return { title: "完成属于你的旅程", description: "在这个世界走到故事的终点。" };
  }
  return { title, description };
}

export function normalizeStoryTimeline(value: unknown): StoryTimeline {
  const record = asRecord(value) ?? {};
  const rawTotal = Math.round(numberValue(record.totalDays ?? record.total_days, 0));
  const totalDays = rawTotal > 0 ? clamp(rawTotal, 1, 365) : DEFAULT_TIMELINE.totalDays;
  const currentDay = Math.max(1, Math.round(numberValue(record.currentDay ?? record.current_day, 1)));
  return {
    label: text(record.label) || DEFAULT_TIMELINE.label,
    totalDays,
    currentDay,
  };
}

function normalizeOutcome(value: unknown, isEnding: boolean): AdventureOutcome {
  if (value === "success" || value === "failure") return value;
  return isEnding ? "failure" : "playing";
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

/** 开局响应同时包含初始场景、最终目标与时间线。 */
export function normalizeGameOpening(value: unknown): GameOpening | null {
  const record = asRecord(value);
  const gameState = normalizeGameState(value);
  if (!record || !gameState) return null;

  return {
    gameState,
    goal: normalizeStoryGoal(record.finalGoal ?? record.final_goal),
    timeline: normalizeStoryTimeline(record.timeline),
  };
}

export function normalizeSceneResult(value: unknown): SceneResult | null {
  const record = asRecord(value);
  if (!record) return null;

  const scene = normalizeScene(record.currentScene ?? record.current_scene, "scene");
  const narration = text(record.narration);
  const isEnding = record.isEnding === true || record.is_ending === true;
  const endingText = text(record.endingText ?? record.ending_text);
  const endingType = normalizeEndingType(record.endingType ?? record.ending_type);
  const daysPassed = clamp(
    Math.round(numberValue(record.daysPassed ?? record.days_passed, 1)),
    1,
    30
  );
  const goalAchieved =
    record.goalAchieved === true || record.goal_achieved === true;

  if (isEnding) {
    if (!narration && !endingText) return null;
    return {
      narration,
      currentScene: scene ?? { id: "ending", location: "", description: "", choices: [] },
      statsChange: normalizeStatsChange(record),
      isEnding: true,
      endingType,
      daysPassed,
      goalAchieved,
      endingText,
    };
  }

  if (!scene || (!narration && scene.choices.length === 0)) return null;

  return {
    narration,
    currentScene: scene,
    statsChange: normalizeStatsChange(record),
    isEnding: false,
    endingType,
    daysPassed,
    goalAchieved,
    endingText,
  };
}

function normalizeEndingType(value: unknown): "success" | "failure" | null {
  if (value === "success" || value === "failure") return value;
  return null;
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
      const isEnding = record.isEnding === true;
      return {
        gameState,
        stats: normalizeStats(record.stats),
        history: normalizeHistory(record.history),
        isEnding,
        endingText: text(record.endingText ?? record.ending_text),
        turn: Math.max(0, Math.round(numberValue(record.turn))),
        timeline: normalizeStoryTimeline(record.timeline),
        outcome: normalizeOutcome(record.outcome, isEnding),
        outcomeReason: text(record.outcomeReason ?? record.outcome_reason),
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

  const isEnding = record.isEnding === true;

  return {
    character,
    gameState: normalizeGameState(record.gameState ?? record.game_state),
    stats: normalizeStats(record.stats),
    history: normalizeHistory(record.history),
    isEnding,
    endingText: text(record.endingText ?? record.ending_text),
    turn: Math.max(0, Math.round(numberValue(record.turn))),
    snapshots: normalizeSnapshots(record.snapshots),
    startedAt: text(record.startedAt ?? record.started_at) || new Date().toISOString(),
    goal: normalizeStoryGoal(record.goal ?? record.finalGoal ?? record.final_goal),
    timeline: normalizeStoryTimeline(record.timeline),
    outcome: normalizeOutcome(record.outcome, isEnding),
    outcomeReason: text(record.outcomeReason ?? record.outcome_reason),
  };
}

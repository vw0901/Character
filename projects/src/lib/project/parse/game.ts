import { asArray, asRecord, normalizeStats, numberValue, text } from "./json";
import {
  DEFAULT_TOTAL_DAYS,
  MAX_TOTAL_DAYS,
  MIN_DAYS_PER_ACTION,
  MIN_TOTAL_DAYS,
  clamp,
  clampDaysPerAction,
  openingStats,
  reconcilePlayingOutcome,
} from "../rules";
import {
  MAX_UNDO_SNAPSHOTS,
  type AdventureOutcome,
  type AdventureSnapshot,
  type AdventureState,
  type CharacterChoice,
  type GameState,
  type GoalCheckVerdict,
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
  return { title: title || "完成属于你的旅程", description };
}

interface TimelineBounds {
  minTotal: number;
  maxTotal: number;
  /** 开局固定天数，避免模型让故事从中途开始。 */
  forceDay?: number;
}

function buildTimeline(value: unknown, bounds: TimelineBounds): StoryTimeline {
  const record = asRecord(value) ?? {};
  const rawTotal = Math.round(numberValue(record.totalDays ?? record.total_days, 0));
  const totalDays =
    rawTotal > 0 ? clamp(rawTotal, bounds.minTotal, bounds.maxTotal) : DEFAULT_TOTAL_DAYS;
  const rawCurrent = Math.max(
    1,
    Math.round(numberValue(record.currentDay ?? record.current_day, 1))
  );
  return {
    label: text(record.label) || DEFAULT_TIMELINE.label,
    totalDays,
    currentDay: bounds.forceDay ?? rawCurrent,
  };
}

/** 存档中的时间线保持宽容，避免旧存档被改写。 */
export function normalizeStoryTimeline(value: unknown): StoryTimeline {
  return buildTimeline(value, { minTotal: 1, maxTotal: 365 });
}

/**
 * 开局时间线：强制落在 15-30 天，并从第 1 天开始。
 * 模型给出 3 天或 365 天时，按提示词的约定收敛，保证目标有可完成的窗口。
 */
function normalizeOpeningTimeline(value: unknown): StoryTimeline {
  return buildTimeline(value, {
    minTotal: MIN_TOTAL_DAYS,
    maxTotal: MAX_TOTAL_DAYS,
    forceDay: 1,
  });
}

/** 开局目标必须存在：没有目标的局无法判定胜负，只能要求重新生成。 */
function normalizeOpeningGoal(value: unknown): StoryGoal | null {
  // 兼容模型把 finalGoal 直接写成一句话的情况。
  if (typeof value === "string") {
    const title = text(value);
    return title ? { title, description: "在时间线耗尽前达成这件事。" } : null;
  }
  const record = asRecord(value) ?? {};
  const title = text(record.title);
  if (!title) return null;
  return {
    title,
    description: text(record.description) || "在时间线耗尽前达成这件事。",
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

  // 缺少目标、或开场没有任何可选行动，都是走不下去的死局。
  const goal = normalizeOpeningGoal(record.finalGoal ?? record.final_goal);
  if (!goal || gameState.currentScene.choices.length === 0) return null;

  return {
    gameState: {
      ...gameState,
      playerCharacter: {
        ...gameState.playerCharacter,
        initialStats: openingStats(gameState.playerCharacter.initialStats),
      },
    },
    goal,
    timeline: normalizeOpeningTimeline(record.timeline),
  };
}

export function normalizeSceneResult(value: unknown): SceneResult | null {
  const record = asRecord(value);
  if (!record) return null;

  const scene = normalizeScene(record.currentScene ?? record.current_scene, "scene");
  const narration = text(record.narration);
  const goalAchieved =
    record.goalAchieved === true || record.goal_achieved === true;
  // 目标达成后故事就该收束；模型漏写 isEnding 时按结局处理，避免多走一步。
  const isEnding =
    record.isEnding === true || record.is_ending === true || goalAchieved;
  const endingText = text(record.endingText ?? record.ending_text);
  const endingType = normalizeEndingType(record.endingType ?? record.ending_type);
  const daysPassed = clampDaysPerAction(
    numberValue(record.daysPassed ?? record.days_passed, MIN_DAYS_PER_ACTION)
  );

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

  // 非结局回合必须留下可执行的选项，否则玩家会卡在没有任何按钮的场景里。
  if (!scene || scene.choices.length === 0) return null;

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

/**
 * 目标判定接口的返回：
 * - `ok === false` 表示这次判定没做成（AI 报错或结果无法解析），交给本地兜底；
 * - 成功解析时以 `achieved` 为准，`confidence` 只用于展示，不改变结论。
 */
export function normalizeGoalCheck(value: unknown): GoalCheckVerdict | null {
  const record = asRecord(value);
  if (!record || record.ok === false) return null;
  if (typeof record.achieved !== "boolean") return null;

  const confidence =
    record.confidence === "high" || record.confidence === "medium"
      ? record.confidence
      : "low";

  return {
    achieved: record.achieved,
    confidence,
    reason: text(record.reason),
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

  const adventure: AdventureState = {
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

  // 旧存档或手工改过的存档可能还标着「进行中」，但按规则已经该判负。
  const reconciled = reconcilePlayingOutcome({
    outcome: adventure.outcome,
    isEnding: adventure.isEnding,
    stats: adventure.stats,
    timeline: adventure.timeline,
  });
  if (reconciled.outcome === adventure.outcome) return adventure;

  return {
    ...adventure,
    outcome: reconciled.outcome,
    outcomeReason: reconciled.reason,
    isEnding: true,
  };
}

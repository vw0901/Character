import { DEFAULT_STATS } from "./parse/json";
import type {
  AdventureOutcome,
  AdventureSnapshot,
  AdventureState,
  CharacterChoice,
  GameState,
  SceneResult,
  StatValues,
  StoryGoal,
  StoryTimeline,
} from "./types";

/** 故事书的键：同一本书在存档里只对应一个角色。 */
export function characterKey(character: CharacterChoice): string {
  const mode = character.mode === "custom" ? "custom" : "bible";
  return `${mode}:${character.name.trim()}`;
}

export const PENDING_GOAL: StoryGoal = {
  title: "等待命运揭晓",
  description: "故事开始时会确定这个角色的最终目标。",
};

export const DEFAULT_TIMELINE: StoryTimeline = {
  label: "主线",
  totalDays: 20,
  currentDay: 1,
};

export function createAdventure(character: CharacterChoice): AdventureState {
  return {
    character,
    gameState: null,
    stats: DEFAULT_STATS,
    history: [],
    isEnding: false,
    endingText: "",
    turn: 0,
    snapshots: [],
    startedAt: new Date().toISOString(),
    goal: PENDING_GOAL,
    timeline: DEFAULT_TIMELINE,
    outcome: "playing",
    outcomeReason: "",
  };
}

export function snapshotOf(
  adventure: AdventureState,
  gameState: GameState
): AdventureSnapshot {
  return {
    gameState,
    stats: adventure.stats,
    history: adventure.history,
    isEnding: adventure.isEnding,
    endingText: adventure.endingText,
    turn: adventure.turn,
    timeline: adventure.timeline,
    outcome: adventure.outcome,
    outcomeReason: adventure.outcomeReason,
  };
}

/** 剩余天数（不含当天），用于倒计时展示。 */
export function daysRemaining(timeline: StoryTimeline): number {
  return Math.max(0, timeline.totalDays - timeline.currentDay);
}

interface OutcomeResolution {
  outcome: AdventureOutcome;
  reason: string;
  timeline: StoryTimeline;
}

/**
 * 由客户端统一裁定结局，避免模型漏报或误报：
 * 达成目标 → 成功；生命归零 / 超过时间线 → 失败。
 */
export function resolveOutcome(
  current: Pick<AdventureState, "goal" | "timeline">,
  nextStats: StatValues,
  result: Pick<SceneResult, "daysPassed" | "goalAchieved" | "isEnding" | "endingType">
): OutcomeResolution {
  const timeline: StoryTimeline = {
    ...current.timeline,
    currentDay: current.timeline.currentDay + Math.max(0, result.daysPassed),
  };

  if (result.goalAchieved || result.endingType === "success") {
    return {
      outcome: "success",
      reason: `达成最终目标：${current.goal.title}`,
      timeline,
    };
  }

  if (nextStats.health <= 0) {
    return { outcome: "failure", reason: "生命值归零，冒险失败", timeline };
  }

  if (timeline.currentDay > timeline.totalDays) {
    return {
      outcome: "failure",
      reason: `时间线耗尽（第 ${timeline.currentDay} 天 / 共 ${timeline.totalDays} 天），未能达成最终目标`,
      timeline,
    };
  }

  if (result.isEnding) {
    return { outcome: "failure", reason: "故事以失败告终", timeline };
  }

  return { outcome: "playing", reason: "", timeline };
}

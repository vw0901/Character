import { DEFAULT_STATS, DEFAULT_TOTAL_DAYS } from "./rules";
import type {
  AdventureSnapshot,
  AdventureState,
  CharacterChoice,
  GameState,
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
  totalDays: DEFAULT_TOTAL_DAYS,
  currentDay: 1,
};

export function createAdventure(character: CharacterChoice): AdventureState {
  return {
    character,
    gameState: null,
    stats: { ...DEFAULT_STATS },
    history: [],
    isEnding: false,
    endingText: "",
    turn: 0,
    snapshots: [],
    startedAt: new Date().toISOString(),
    goal: { ...PENDING_GOAL },
    timeline: { ...DEFAULT_TIMELINE },
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

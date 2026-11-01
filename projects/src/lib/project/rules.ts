import type {
  AdventureOutcome,
  AdventureState,
  SceneResult,
  StatValues,
  StoryTimeline,
} from "./types";

/**
 * 文字冒险的裁定规则集中在这里，解析层、会话层与界面都只认这一份规则，
 * 避免「模型怎么说就怎么算」导致的血条乱跳与无法达成的目标。
 *
 * 本文件刻意不依赖其它模块的运行时导出，方便单独验证规则。
 */

/** 所有属性都收敛到 0-100。 */
export const STAT_MIN = 0;
export const STAT_MAX = 100;

export const DEFAULT_STATS: StatValues = { health: 100, power: 50, reputation: 50 };

/**
 * 单次行动对属性的影响上限。
 * 非结局回合封顶，避免「擦破皮掉 80 血」「一句好话回满血」这类不合理的加减；
 * 结局回合不截断，否则「当场阵亡」会出现一个还剩半管血的尸体。
 */
export const STAT_CHANGE_LIMITS: Record<keyof StatValues, { min: number; max: number }> = {
  health: { min: -40, max: 25 },
  power: { min: -30, max: 30 },
  reputation: { min: -30, max: 30 },
};

/** 开局生命值下限：还没开始就先判死，等于生成了一个无法完成的局。 */
export const OPENING_HEALTH_MIN = 20;

/** 一局故事的天数区间，与提示词、README 中的「15-30 天」保持一致。 */
export const MIN_TOTAL_DAYS = 15;
export const MAX_TOTAL_DAYS = 30;
export const DEFAULT_TOTAL_DAYS = 20;

/** 一次行动消耗的天数区间。 */
export const MIN_DAYS_PER_ACTION = 1;
export const MAX_DAYS_PER_ACTION = 3;

export const HEALTH_FAILURE_REASON = "生命值归零，冒险失败";
export const ENDING_FAILURE_REASON = "故事以失败告终";

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function clampDaysPerAction(value: number): number {
  const days = Number.isFinite(value) ? Math.round(value) : MIN_DAYS_PER_ACTION;
  return clamp(days, MIN_DAYS_PER_ACTION, MAX_DAYS_PER_ACTION);
}

/** 把属性值收敛成 0-100 的整数；healthFloor 用来保证开局不是「已死」。 */
export function sanitizeStats(
  value: Partial<StatValues>,
  healthFloor: number = STAT_MIN
): StatValues {
  const read = (input: unknown, fallback: number, floor: number): number => {
    const parsed =
      typeof input === "number" && Number.isFinite(input) ? Math.round(input) : fallback;
    return clamp(parsed, floor, STAT_MAX);
  };
  return {
    health: read(value.health, DEFAULT_STATS.health, healthFloor),
    power: read(value.power, DEFAULT_STATS.power, STAT_MIN),
    reputation: read(value.reputation, DEFAULT_STATS.reputation, STAT_MIN),
  };
}

/** 开局属性：生命值至少 OPENING_HEALTH_MIN，避免一开局就注定的失败局。 */
export function openingStats(value: Partial<StatValues>): StatValues {
  return sanitizeStats(value, OPENING_HEALTH_MIN);
}

export interface StatChangeOptions {
  /** 结局回合：单项变化不再截断，让结局叙述与数值一致。 */
  final?: boolean;
}

/** 应用一次行动的属性变化：先按回合类型截断单项变化，再收敛到 0-100。 */
export function applyStatChange(
  base: StatValues,
  change: Partial<StatValues>,
  options: StatChangeOptions = {}
): StatValues {
  const step = (key: keyof StatValues): number => {
    const raw = change[key];
    const value = typeof raw === "number" && Number.isFinite(raw) ? Math.round(raw) : 0;
    const limit = STAT_CHANGE_LIMITS[key];
    return options.final
      ? clamp(value, -STAT_MAX, STAT_MAX)
      : clamp(value, limit.min, limit.max);
  };
  return {
    health: clamp(base.health + step("health"), STAT_MIN, STAT_MAX),
    power: clamp(base.power + step("power"), STAT_MIN, STAT_MAX),
    reputation: clamp(base.reputation + step("reputation"), STAT_MIN, STAT_MAX),
  };
}

export function isDead(stats: StatValues): boolean {
  return stats.health <= 0;
}

export function isTimelineExhausted(timeline: StoryTimeline): boolean {
  return timeline.currentDay > timeline.totalDays;
}

export function timelineFailureReason(timeline: StoryTimeline): string {
  return `时间线耗尽（第 ${timeline.currentDay} 天 / 共 ${timeline.totalDays} 天），未能达成最终目标`;
}

export interface OutcomeResolution {
  outcome: AdventureOutcome;
  reason: string;
  timeline: StoryTimeline;
}

/**
 * 由客户端统一裁定结局，避免模型漏报或误报：
 * 达成目标 → 成功；生命归零 / 超过时间线 → 失败。
 * 先判成功再判死亡：同归于尽式的达成也算成功。
 */
export function resolveOutcome(
  current: Pick<AdventureState, "goal" | "timeline">,
  nextStats: StatValues,
  result: Pick<SceneResult, "daysPassed" | "goalAchieved" | "isEnding" | "endingType">
): OutcomeResolution {
  const timeline: StoryTimeline = {
    ...current.timeline,
    currentDay: current.timeline.currentDay + Math.max(0, Math.round(result.daysPassed)),
  };

  if (result.goalAchieved || result.endingType === "success") {
    return {
      outcome: "success",
      reason: `达成最终目标：${current.goal.title}`,
      timeline,
    };
  }

  if (isDead(nextStats)) {
    return { outcome: "failure", reason: HEALTH_FAILURE_REASON, timeline };
  }

  if (isTimelineExhausted(timeline)) {
    return { outcome: "failure", reason: timelineFailureReason(timeline), timeline };
  }

  if (result.isEnding) {
    return { outcome: "failure", reason: ENDING_FAILURE_REASON, timeline };
  }

  return { outcome: "playing", reason: "", timeline };
}

/**
 * 读档 / 回退后的状态对账：只修正「还标着进行中、但按规则已经结束」的状态，
 * 已经写入的结局保持不变。
 */
export function reconcilePlayingOutcome(state: {
  outcome: AdventureOutcome;
  isEnding: boolean;
  stats: StatValues;
  timeline: StoryTimeline;
}): { outcome: AdventureOutcome; reason: string } {
  if (state.outcome !== "playing") return { outcome: state.outcome, reason: "" };

  if (isDead(state.stats)) {
    return { outcome: "failure", reason: HEALTH_FAILURE_REASON };
  }
  if (isTimelineExhausted(state.timeline)) {
    return {
      outcome: "failure",
      reason: timelineFailureReason(state.timeline),
    };
  }
  if (state.isEnding) {
    return { outcome: "failure", reason: ENDING_FAILURE_REASON };
  }
  return { outcome: "playing", reason: "" };
}

/**
 * 判定接口不可用时的本地兜底。
 *
 * 只认叙述里明确写出「最终目标已达成」这类句子：像「找到线索」这种局部进展
 * 不能等同于「找到妹妹」，宁可漏判，也不要把进行中的故事误判成成功。
 */
const GOAL_COMPLETION_PATTERNS = [
  /(?:最终目标|主线目标|终极目标)[^。！？!?\n]{0,12}(?:达成|完成|实现|做到)/,
  /(?:达成|完成|实现|做到)[^。！？!?\n]{0,10}(?:最终目标|主线目标|终极目标)/,
  /大功告成/,
];

const NEGATION_MARKERS = [
  "没有",
  "没能",
  "未能",
  "尚未",
  "还没",
  "未达成",
  "未完成",
  "未实现",
  "未做到",
  "暂未",
  "无法",
  "不能",
  "差点",
  "险些",
  "差一点",
  "并未",
  "不曾",
  "白白",
];

export function detectGoalAchievedFromText(text: string): boolean {
  return text
    .split(/[。！？!?\n]+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .some(
      (sentence) =>
        !NEGATION_MARKERS.some((marker) => sentence.includes(marker)) &&
        GOAL_COMPLETION_PATTERNS.some((pattern) => pattern.test(sentence))
    );
}


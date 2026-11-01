import type { AdventureOutcome, SaveState } from "./types";

export const SAVE_LABELS: Record<SaveState, string> = {
  idle: "未保存",
  saving: "保存中…",
  saved: "已保存到本机",
  error: "保存失败",
};

export const OUTCOME_LABELS: Record<AdventureOutcome, string> = {
  playing: "进行中",
  success: "已达成目标",
  failure: "已失败",
};

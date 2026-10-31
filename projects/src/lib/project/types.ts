export const PROJECT_FORMAT = "if-it-were-you/project";
export const PROJECT_FORMAT_VERSION = 1;
export const APP_VERSION = "0.2.0";
export const MAX_UNDO_SNAPSHOTS = 20;

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  siteName: string;
}

export interface SearchData {
  novelName: string;
  summary: string;
  results: SearchResult[];
}

export interface SettingBible {
  novelName: string;
  author: string;
  status: string;
  genre: string;
  synopsis: string;
  worldview: {
    summary: string;
    geography: string;
    history: string;
    rules: string;
  };
  powerSystem: {
    name: string;
    levels: string[];
    description: string;
    limitations: string;
  };
  factions: Array<{
    name: string;
    description: string;
    keyMembers: string[];
    goal: string;
  }>;
  characters: Array<{
    name: string;
    role: string;
    abilities: string;
    personality: string;
    relationships: string;
  }>;
  timeline: Array<{
    event: string;
    description: string;
  }>;
  mysteries: Array<{
    question: string;
    clues: string;
    theories: string;
  }>;
}

export interface CheckIssue {
  category: string;
  severity: string;
  title: string;
  description: string;
  fix: string;
}

export interface CheckResult {
  overallScore: number;
  summary: string;
  issues: CheckIssue[];
  strengths: string[];
}

export interface RepairFix {
  issue: string;
  action: string;
  field: string;
}

export interface RepairResult {
  summary: string;
  appliedFixes: RepairFix[];
  bible: SettingBible;
}

export interface SceneChoice {
  id: string;
  text: string;
  hint?: string;
}

export interface Scene {
  id: string;
  location: string;
  description: string;
  choices: SceneChoice[];
}

export interface PlayerCharacter {
  name: string;
  background: string;
  initialStats: StatValues;
}

export interface GameState {
  title: string;
  intro: string;
  playerCharacter: PlayerCharacter;
  currentScene: Scene;
}

export interface StatValues {
  health: number;
  power: number;
  reputation: number;
}

export interface HistoryEntry {
  type: "narration" | "choice";
  text: string;
}

export interface CharacterChoice {
  mode: "existing" | "custom";
  name: string;
  background: string;
  abilities?: string;
  personality?: string;
}

export interface SceneResult {
  narration: string;
  currentScene: Scene;
  statsChange: Partial<StatValues>;
  isEnding: boolean;
  endingText?: string;
}

export interface AdventureSnapshot {
  gameState: GameState;
  stats: StatValues;
  history: HistoryEntry[];
  isEnding: boolean;
  endingText: string;
  turn: number;
}

export interface AdventureState {
  character: CharacterChoice;
  gameState: GameState | null;
  stats: StatValues;
  history: HistoryEntry[];
  isEnding: boolean;
  endingText: string;
  turn: number;
  snapshots: AdventureSnapshot[];
  startedAt: string;
}

export interface ProjectDocument {
  format: string;
  formatVersion: number;
  appVersion: string;
  id: string;
  novelName: string;
  createdAt: string;
  updatedAt: string;
  search: SearchData | null;
  bible: SettingBible | null;
  check: CheckResult | null;
  repair: RepairResult | null;
  adventure: AdventureState | null;
}

export interface ProjectSummary {
  id: string;
  novelName: string;
  updatedAt: string;
  appVersion: string;
  hasSearch: boolean;
  hasBible: boolean;
  hasCheck: boolean;
  hasRepair: boolean;
  hasAdventure: boolean;
}

export type SaveState = "idle" | "saving" | "saved" | "error";

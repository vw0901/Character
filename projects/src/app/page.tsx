"use client";

import { useState, useCallback } from "react";
import { SearchPhase } from "@/components/search-phase";
import { BibleDisplay } from "@/components/bible-display";
import { CheckDisplay } from "@/components/check-display";
import { GamePhase } from "@/components/game-phase";

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

export interface CheckResult {
  overallScore: number;
  summary: string;
  issues: Array<{
    category: string;
    severity: string;
    title: string;
    description: string;
    fix: string;
  }>;
  strengths: string[];
}

export interface GameState {
  title: string;
  intro: string;
  playerCharacter: {
    name: string;
    background: string;
    initialStats: {
      health: number;
      power: number;
      reputation: number;
    };
  };
  currentScene: {
    id: string;
    location: string;
    description: string;
    choices: Array<{
      id: string;
      text: string;
      hint?: string;
    }>;
  };
}

export interface CharacterChoice {
  mode: "existing" | "custom";
  name: string;
  background: string;
  abilities?: string;
  personality?: string;
}

export interface PlayerIdentity {
  name: string;
  background: string;
  abilities?: string;
  personality?: string;
}

export interface SceneResult {
  narration: string;
  currentScene: {
    id: string;
    location: string;
    description: string;
    choices: Array<{
      id: string;
      text: string;
      hint?: string;
    }>;
  };
  statsChange: {
    health: number;
    power: number;
    reputation: number;
  };
  isEnding: boolean;
  endingText?: string;
}

type Phase = "search" | "bible" | "check" | "game";

export default function Home() {
  const [phase, setPhase] = useState<Phase>("search");
  const [searchData, setSearchData] = useState<SearchData | null>(null);
  const [bible, setBible] = useState<SettingBible | null>(null);
  const [checkResult, setCheckResult] = useState<CheckResult | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);

  const handleSearchComplete = useCallback((data: SearchData) => {
    setSearchData(data);
    setPhase("bible");
  }, []);

  const handleBibleComplete = useCallback((bibleData: SettingBible) => {
    setBible(bibleData);
  }, []);

  const handleStartCheck = useCallback(() => {
    setPhase("check");
  }, []);

  const handleCheckComplete = useCallback((result: CheckResult) => {
    setCheckResult(result);
  }, []);

  const handleStartGame = useCallback(() => {
    setPhase("game");
  }, []);

  const handleRestart = useCallback(() => {
    setPhase("search");
    setSearchData(null);
    setBible(null);
    setCheckResult(null);
    setGameState(null);
  }, []);

  return (
    <main className="min-h-screen">
      {phase === "search" && (
        <SearchPhase onSearchComplete={handleSearchComplete} />
      )}

      {phase === "bible" && searchData && (
        <BibleDisplay
          searchData={searchData}
          onBibleComplete={handleBibleComplete}
          onStartCheck={handleStartCheck}
          bible={bible}
        />
      )}

      {phase === "check" && bible && (
        <CheckDisplay
          bible={bible}
          checkResult={checkResult}
          onCheckComplete={handleCheckComplete}
          onStartGame={handleStartGame}
        />
      )}

      {phase === "game" && bible && (
        <GamePhase
          bible={bible}
          gameState={gameState}
          setGameState={setGameState}
          onRestart={handleRestart}
        />
      )}
    </main>
  );
}

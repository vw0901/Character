"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { withAiConfig } from "@/lib/ai/browser";
import { errorMessage } from "@/lib/ai/error";
import { readSseText } from "@/lib/ai/sse";
import {
  DEFAULT_STATS,
  MAX_UNDO_SNAPSHOTS,
  createAdventure,
  normalizeGameOpening,
  normalizeSceneResult,
  parseJsonLoose,
  resolveOutcome,
  snapshotOf,
  type AdventureState,
  type CharacterChoice,
  type GameState,
  type SceneResult,
  type SettingBible,
  type StatValues,
} from "@/lib/project";

interface UseGameSessionParams {
  bible: SettingBible;
  adventure: AdventureState | null;
  onAdventureChange: (adventure: AdventureState) => void;
  onLeave: () => void;
}

function clampStats(base: StatValues, change: Partial<StatValues>): StatValues {
  const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
  return {
    health: clamp(base.health + (change.health ?? 0)),
    power: clamp(base.power + (change.power ?? 0)),
    reputation: clamp(base.reputation + (change.reputation ?? 0)),
  };
}

/** 文字冒险的会话状态：开局生成、推进回合、回退与打字机效果。 */
export function useGameSession({
  bible,
  adventure,
  onAdventureChange,
  onLeave,
}: UseGameSessionParams) {
  const [isInitializing, setIsInitializing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [narration, setNarration] = useState("");
  const [displayedText, setDisplayedText] = useState("");
  const [error, setError] = useState("");
  const typewriterRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fullTextRef = useRef<string>("");
  const initKeyRef = useRef("");

  const characters = bible.characters || [];
  const character = adventure?.character ?? null;
  const gameState = adventure?.gameState ?? null;
  const stats = adventure?.stats ?? DEFAULT_STATS;
  const history = adventure?.history ?? [];
  const isEnding = adventure?.isEnding ?? false;
  const endingText = adventure?.endingText ?? "";
  const currentScene = gameState?.currentScene;
  const canUndo = Boolean(adventure && adventure.snapshots.length > 0 && !isProcessing);

  // 切换故事书时清掉上一本留下的临时状态（必须在开场 effect 之前）。
  useEffect(() => {
    setNarration("");
    setDisplayedText("");
    setError("");
    setIsProcessing(false);
    setIsInitializing(false);
    initKeyRef.current = "";
  }, [adventure?.character.name, adventure?.startedAt]);

  // 选好角色但没有初始场景时，生成开场。
  useEffect(() => {
    if (!adventure?.character || adventure.gameState) return;
    const key = `${adventure.character.name}:${adventure.startedAt}`;
    if (initKeyRef.current === key) return;
    initKeyRef.current = key;

    const initGame = async () => {
      setIsInitializing(true);
      setError("");

      try {
        const res = await fetch("/api/game", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            withAiConfig({ bible, characterChoice: adventure.character })
          ),
        });

        let accumulated = "";
        for await (const text of readSseText(res)) {
          accumulated += text;
        }

        const opening = normalizeGameOpening(parseJsonLoose(accumulated));
        if (opening) {
          const initialStats = opening.gameState.playerCharacter.initialStats ?? DEFAULT_STATS;
          const nextState: GameState = {
            ...opening.gameState,
            playerCharacter: {
              name: adventure.character.name,
              background:
                adventure.character.background || opening.gameState.playerCharacter.background,
              initialStats,
            },
          };
          onAdventureChange({
            ...adventure,
            gameState: nextState,
            stats: initialStats,
            history: [{ type: "narration", text: opening.gameState.intro }],
            isEnding: false,
            endingText: "",
            goal: opening.goal,
            timeline: opening.timeline,
            outcome: "playing",
            outcomeReason: "",
          });
          setNarration(opening.gameState.intro);
        } else if (!accumulated) {
          setError("AI 服务未返回内容，请检查服务配置后重试");
        } else {
          setError("AI 返回的游戏初始场景无法解析，请重新选择角色");
        }
      } catch (err) {
        console.error("Game init failed:", err);
        setError(errorMessage(err, "生成游戏初始场景失败，请检查 AI 服务配置后重试"));
      } finally {
        setIsInitializing(false);
      }
    };

    void initGame();
  }, [adventure, bible, onAdventureChange]);

  // Typewriter effect
  useEffect(() => {
    if (!narration) return;

    fullTextRef.current = narration;
    let index = 0;
    setDisplayedText("");

    if (typewriterRef.current) {
      clearTimeout(typewriterRef.current);
    }

    const type = () => {
      if (index < fullTextRef.current.length) {
        index++;
        setDisplayedText(fullTextRef.current.slice(0, index));
        typewriterRef.current = setTimeout(type, 30);
      }
    };

    typewriterRef.current = setTimeout(type, 100);

    return () => {
      if (typewriterRef.current) {
        clearTimeout(typewriterRef.current);
      }
    };
  }, [narration]);

  const startAdventure = useCallback(
    (next: CharacterChoice) => {
      onAdventureChange(createAdventure(next));
      setNarration("");
      setDisplayedText("");
      setError("");
    },
    [onAdventureChange]
  );

  const handleChoice = async (choiceId: string, choiceText: string) => {
    if (isProcessing || !adventure?.gameState) return;

    const current = adventure;
    const currentState = current.gameState;
    if (!currentState) return;

    const snapshot = snapshotOf(current, currentState);
    const historyWithChoice = [
      ...current.history,
      { type: "choice" as const, text: choiceText },
    ];

    // 先乐观展示玩家的选择；失败时回滚到 current，不会重复记录。
    onAdventureChange({ ...current, history: historyWithChoice });
    setIsProcessing(true);
    setNarration("");
    setError("");

    try {
      const res = await fetch("/api/game/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          withAiConfig({
            bible,
            gameState: {
              ...currentState,
              stats: current.stats,
              goal: current.goal,
              timeline: current.timeline,
            },
            choiceId,
            choiceText,
            characterChoice: current.character,
          })
        ),
      });

      let accumulated = "";
      for await (const text of readSseText(res)) {
        accumulated += text;
      }

      const result: SceneResult | null = normalizeSceneResult(
        parseJsonLoose(accumulated)
      );

      if (result) {
        const nextStats = clampStats(current.stats, result.statsChange);
        const narrationText = result.narration || result.endingText || "";
        const resolution = resolveOutcome(current, nextStats, result);
        const ended = resolution.outcome !== "playing";
        onAdventureChange({
          ...current,
          gameState: ended
            ? currentState
            : { ...currentState, currentScene: result.currentScene },
          stats: nextStats,
          history: [
            ...historyWithChoice,
            { type: "narration", text: narrationText },
          ],
          isEnding: ended,
          endingText: ended ? result.endingText || "" : "",
          turn: current.turn + 1,
          snapshots: [...current.snapshots, snapshot].slice(-MAX_UNDO_SNAPSHOTS),
          timeline: resolution.timeline,
          outcome: resolution.outcome,
          outcomeReason: resolution.reason,
        });
        setNarration(narrationText);
      } else {
        onAdventureChange(current);
        setError(
          accumulated
            ? "AI 返回的下一场景无法解析，请重新选择该选项"
            : "AI 服务未返回内容，请检查服务配置后重试"
        );
      }
    } catch (err) {
      console.error("Action failed:", err);
      onAdventureChange(current);
      setError(errorMessage(err, "处理游戏动作失败，请检查 AI 服务配置后重试"));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUndo = () => {
    if (!adventure || adventure.snapshots.length === 0) return;
    const snapshot = adventure.snapshots[adventure.snapshots.length - 1];
    setNarration("");
    setDisplayedText("");
    setError("");
    initKeyRef.current = "";
    onAdventureChange({
      ...adventure,
      ...snapshot,
      snapshots: adventure.snapshots.slice(0, -1),
    });
  };

  const resetToSelect = () => {
    initKeyRef.current = "";
    setNarration("");
    setDisplayedText("");
    setError("");
    onLeave();
  };

  return {
    characters,
    character,
    gameState,
    stats,
    history,
    isEnding,
    endingText,
    currentScene,
    canUndo,
    isInitializing,
    isProcessing,
    narration,
    displayedText,
    error,
    startAdventure,
    handleChoice,
    handleUndo,
    resetToSelect,
  };
}

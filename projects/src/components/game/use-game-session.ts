"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { withAiConfig } from "@/lib/ai/browser";
import { errorMessage } from "@/lib/ai/error";
import { readSseText } from "@/lib/ai/sse";
import {
  DEFAULT_STATS,
  MAX_UNDO_SNAPSHOTS,
  applyStatChange,
  createAdventure,
  detectGoalAchievedFromText,
  normalizeGameOpening,
  normalizeGoalCheck,
  normalizeSceneResult,
  parseJsonLoose,
  resolveOutcome,
  snapshotOf,
  type AdventureState,
  type CharacterChoice,
  type GameState,
  type GoalCheckVerdict,
  type SceneResult,
  type SettingBible,
  type StoryGoal,
} from "@/lib/project";

interface UseGameSessionParams {
  bible: SettingBible;
  adventure: AdventureState | null;
  onAdventureChange: (adventure: AdventureState) => void;
  onLeave: () => void;
}

/** 判定请求要等模型把整轮剧情写完才能发出，超时后交给本地兜底。 */
const GOAL_CHECK_TIMEOUT_MS = 20_000;

interface GoalCheckParams {
  goal: StoryGoal;
  narration: string;
  scene: SceneResult["currentScene"];
  history: AdventureState["history"];
}

async function requestGoalCheck({
  goal,
  narration,
  scene,
  history,
}: GoalCheckParams): Promise<GoalCheckVerdict | null> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), GOAL_CHECK_TIMEOUT_MS);
  try {
    const res = await fetch("/api/game/goal-check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        withAiConfig({
          goal,
          narration,
          scene,
          history: history.map(({ type, text }) => ({ type, text })),
        })
      ),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return normalizeGoalCheck(await res.json());
  } catch (err) {
    console.warn("Goal check failed:", err);
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}

/**
 * 结果叙述 + 新场景描述。
 * 场景描述（150-300 字）是模型专门为玩家写的画面，不能只留在 gameState 里。
 */
function joinNarration(narration: string, sceneDescription: string): string {
  return [narration.trim(), sceneDescription.trim()].filter(Boolean).join("\n\n");
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
  const [isVerifyingGoal, setIsVerifyingGoal] = useState(false);
  const [narration, setNarration] = useState("");
  const [displayedText, setDisplayedText] = useState("");
  const [error, setError] = useState("");
  const typewriterRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fullTextRef = useRef<string>("");
  const initKeyRef = useRef("");
  // 读档时对最新一段剧情补做一次目标复核，避免「存档里目标已完成」的旧局继续下去。
  const loadCheckKeyRef = useRef("");
  // 同一时刻只允许一个行动请求；state 更新有延迟，用它挡住连点。
  const processingRef = useRef(false);

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
    setIsVerifyingGoal(false);
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
          const introText = joinNarration(
            opening.gameState.intro,
            opening.gameState.currentScene.description
          );
          onAdventureChange({
            ...adventure,
            gameState: nextState,
            stats: initialStats,
            history: [{ type: "narration", text: introText }],
            isEnding: false,
            endingText: "",
            goal: opening.goal,
            timeline: opening.timeline,
            outcome: "playing",
            outcomeReason: "",
          });
          setNarration(introText);
        } else if (!accumulated) {
          setError("AI 服务未返回内容，请检查服务配置后重试");
        } else {
          setError("AI 返回的开场不完整（缺少场景、选项或最终目标），请重新生成开场");
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

  // 旧存档里目标可能早已在叙述中完成：读档时对最新一段剧情补做一次复核。
  useEffect(() => {
    const gameState = adventure?.gameState;
    if (!adventure || !gameState) return;

    const key = `${adventure.character.name}:${adventure.startedAt}`;
    if (loadCheckKeyRef.current === key) return;
    if (processingRef.current) return;
    loadCheckKeyRef.current = key;

    // 还没行动过（或已经结束）的局不用复核，第一次行动后自然会判定。
    if (adventure.outcome !== "playing" || adventure.turn === 0) return;

    const lastNarration = [...adventure.history]
      .reverse()
      .find((entry) => entry.type === "narration");
    if (!lastNarration) return;

    const checkLoadedRound = async () => {
      processingRef.current = true;
      setIsProcessing(true);
      setIsVerifyingGoal(true);

      let verdict: GoalCheckVerdict | null = null;
      try {
        verdict = await requestGoalCheck({
          goal: adventure.goal,
          narration: lastNarration.text,
          scene: gameState.currentScene,
          history: adventure.history.slice(-8),
        });
      } finally {
        processingRef.current = false;
        setIsProcessing(false);
        setIsVerifyingGoal(false);
      }

      if (verdict?.achieved !== true) return;
      onAdventureChange({
        ...adventure,
        isEnding: true,
        outcome: "success",
        outcomeReason: `达成最终目标：${adventure.goal.title}`,
      });
    };

    void checkLoadedRound();
  }, [adventure, onAdventureChange]);

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
      processingRef.current = false;
      onAdventureChange(createAdventure(next));
      setNarration("");
      setDisplayedText("");
      setError("");
    },
    [onAdventureChange]
  );

  const handleChoice = async (choiceId: string, choiceText: string) => {
    if (processingRef.current || isProcessing) return;

    const current = adventure;
    if (!current?.gameState) return;

    processingRef.current = true;
    const currentState = current.gameState;

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
        const roundText = [result.narration, result.endingText ?? ""]
          .filter(Boolean)
          .join("\n");

        // 模型常把目标完成写进叙述却忘记打标记：每轮再用独立判定复核一次。
        let goalAchieved =
          result.goalAchieved || result.endingType === "success";
        if (!goalAchieved) {
          setIsVerifyingGoal(true);
          let verdict: GoalCheckVerdict | null = null;
          try {
            verdict = await requestGoalCheck({
              goal: current.goal,
              narration: roundText,
              scene: result.currentScene,
              history: historyWithChoice.slice(-8),
            });
          } finally {
            setIsVerifyingGoal(false);
          }
          goalAchieved =
            verdict?.achieved === true ||
            (!verdict && detectGoalAchievedFromText(roundText));
        }

        // 判定为完成时强制收束为成功结局，不再渲染下一组选项。
        const effectiveResult: SceneResult = goalAchieved
          ? {
              ...result,
              goalAchieved: true,
              isEnding: true,
              endingType: "success",
            }
          : result;

        // 结局回合按结局叙述结算；其余回合按规则封顶单次加减。
        const final =
          effectiveResult.isEnding ||
          effectiveResult.goalAchieved ||
          effectiveResult.endingType !== null;
        const nextStats = applyStatChange(current.stats, effectiveResult.statsChange, {
          final,
        });
        const resolution = resolveOutcome(current, nextStats, effectiveResult);
        const ended = resolution.outcome !== "playing";
        // 每轮都把新场景描述接在叙述后写进日志，玩家才能读到「你现在在哪」。
        const narrationText = joinNarration(
          effectiveResult.narration || effectiveResult.endingText || "",
          effectiveResult.currentScene.description
        );
        onAdventureChange({
          ...current,
          gameState: ended
            ? currentState
            : { ...currentState, currentScene: effectiveResult.currentScene },
          stats: nextStats,
          history: [
            ...historyWithChoice,
            { type: "narration", text: narrationText },
          ],
          isEnding: ended,
          endingText: ended ? effectiveResult.endingText || "" : "",
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
      processingRef.current = false;
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
    isVerifyingGoal,
    narration,
    displayedText,
    error,
    startAdventure,
    handleChoice,
    handleUndo,
    resetToSelect,
  };
}

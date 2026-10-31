"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import {
  Gamepad2, Heart, Zap, Star, Loader2, RotateCcw,
  ChevronRight, Skull, User, UserPlus, Wand2, Undo2, Download,
} from "lucide-react";
import { withAiConfig } from "@/lib/ai/browser";
import { readSseText } from "@/lib/ai/sse";
import {
  MAX_UNDO_SNAPSHOTS,
  normalizeGameState,
  normalizeSceneResult,
  parseJsonLoose,
  type AdventureSnapshot,
  type AdventureState,
  type CharacterChoice,
  type GameState,
  type ProjectDocument,
  type SaveState,
  type SceneResult,
  type SettingBible,
  type StatValues,
} from "@/lib/project";

interface GamePhaseProps {
  project: ProjectDocument;
  bible: SettingBible;
  adventure: AdventureState | null;
  saveState: SaveState;
  onAdventureChange: (adventure: AdventureState | null) => void;
  onExport: () => void;
  onRestart: () => void;
}

const DEFAULT_STATS: StatValues = { health: 100, power: 50, reputation: 50 };

const SAVE_LABELS: Record<SaveState, string> = {
  idle: "未保存",
  saving: "保存中…",
  saved: "已保存到本机",
  error: "保存失败",
};

function clampStats(base: StatValues, change: Partial<StatValues>): StatValues {
  const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
  return {
    health: clamp(base.health + (change.health ?? 0)),
    power: clamp(base.power + (change.power ?? 0)),
    reputation: clamp(base.reputation + (change.reputation ?? 0)),
  };
}

export function GamePhase({
  project,
  bible,
  adventure,
  saveState,
  onAdventureChange,
  onExport,
  onRestart,
}: GamePhaseProps) {
  const [mode, setMode] = useState<"existing" | "custom">("existing");
  const [customName, setCustomName] = useState("");
  const [customBg, setCustomBg] = useState("");
  const [customAbilities, setCustomAbilities] = useState("");
  const [customPersonality, setCustomPersonality] = useState("");

  const [isInitializing, setIsInitializing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [narration, setNarration] = useState("");
  const [displayedText, setDisplayedText] = useState("");
  const [rawText, setRawText] = useState("");
  const [error, setError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
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

  // 选好角色但没有初始场景时，生成开场。
  useEffect(() => {
    if (!adventure?.character || adventure.gameState) return;
    const key = `${adventure.character.name}:${adventure.startedAt}`;
    if (initKeyRef.current === key) return;
    initKeyRef.current = key;

    const initGame = async () => {
      setIsInitializing(true);
      setRawText("");
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
          setRawText(accumulated);
        }

        const parsed = normalizeGameState(parseJsonLoose(accumulated));
        if (parsed) {
          const initialStats = parsed.playerCharacter.initialStats ?? DEFAULT_STATS;
          const nextState: GameState = {
            ...parsed,
            playerCharacter: {
              name: adventure.character.name,
              background: adventure.character.background || parsed.playerCharacter.background,
              initialStats,
            },
          };
          onAdventureChange({
            ...adventure,
            gameState: nextState,
            stats: initialStats,
            history: [{ type: "narration", text: parsed.intro }],
            isEnding: false,
            endingText: "",
          });
          setNarration(parsed.intro);
        } else if (!accumulated) {
          setError("AI 服务未返回内容，请检查服务配置后重试");
        } else {
          setError("AI 返回的游戏初始场景无法解析，请重新选择角色");
        }
      } catch (err) {
        console.error("Game init failed:", err);
        const message = err instanceof Error ? err.message : "";
        setError(
          message && message !== "Failed to fetch"
            ? message
            : "生成游戏初始场景失败，请检查 AI 服务配置后重试"
        );
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

  // Auto scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history, displayedText]);

  const startAdventure = useCallback(
    (next: CharacterChoice) => {
      onAdventureChange({
        character: next,
        gameState: null,
        stats: DEFAULT_STATS,
        history: [],
        isEnding: false,
        endingText: "",
        turn: 0,
        snapshots: [],
        startedAt: new Date().toISOString(),
      });
      setNarration("");
      setDisplayedText("");
      setError("");
    },
    [onAdventureChange]
  );

  const handleSelectCharacter = (selected: (typeof characters)[number]) => {
    const roleText = selected.role ? `身份：${selected.role}` : "";
    const abilityText = selected.abilities ? `能力：${selected.abilities}` : "";
    const relationText = selected.relationships ? `关系：${selected.relationships}` : "";
    const personalityText = selected.personality ? `性格：${selected.personality}` : "";
    startAdventure({
      mode: "existing",
      name: selected.name,
      background:
        [roleText, abilityText, relationText, personalityText]
          .filter(Boolean)
          .join("；") || "故事中的关键人物",
      abilities: selected.abilities,
      personality: selected.personality,
    });
  };

  const handleCreateCustom = () => {
    if (!customName.trim()) return;
    startAdventure({
      mode: "custom",
      name: customName.trim(),
      background: customBg.trim() || "一位刚刚踏入小说世界的旅人",
      abilities: customAbilities.trim() || undefined,
      personality: customPersonality.trim() || undefined,
    });
  };

  const handleChoice = async (choiceId: string, choiceText: string) => {
    if (isProcessing || !adventure?.gameState) return;

    const current = adventure;
    const currentState = current.gameState;
    if (!currentState) return;

    const snapshot: AdventureSnapshot = {
      gameState: currentState,
      stats: current.stats,
      history: current.history,
      isEnding: current.isEnding,
      endingText: current.endingText,
      turn: current.turn,
    };
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
            gameState: { ...currentState, stats: current.stats },
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
        onAdventureChange({
          ...current,
          gameState: result.isEnding
            ? currentState
            : { ...currentState, currentScene: result.currentScene },
          stats: nextStats,
          history: [
            ...historyWithChoice,
            { type: "narration", text: narrationText },
          ],
          isEnding: result.isEnding,
          endingText: result.isEnding ? result.endingText || "" : "",
          turn: current.turn + 1,
          snapshots: [...current.snapshots, snapshot].slice(-MAX_UNDO_SNAPSHOTS),
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
      const message = err instanceof Error ? err.message : "";
      setError(
        message && message !== "Failed to fetch"
          ? message
          : "处理游戏动作失败，请检查 AI 服务配置后重试"
      );
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
    onAdventureChange(null);
  };

  const liveIndex = narration ? history.length - 1 : -1;
  const displayTitle = gameState?.title || project.novelName || "文字冒险";

  // ---- Character selection screen ----
  if (!character) {
    return (
      <div className="min-h-screen py-6 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-8 animate-fade-in">
            <div className="flex items-center gap-3">
              <Wand2 className="w-6 h-6 text-amber" />
              <h1 className="font-serif text-xl font-bold text-parchment">选择你的角色</h1>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onExport}
                className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground hover:text-parchment border border-border rounded-lg hover:border-amber/30 transition-all"
              >
                <Download className="w-4 h-4" />
                导出存档
              </button>
              <button
                onClick={onRestart}
                className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground hover:text-parchment border border-border rounded-lg hover:border-amber/30 transition-all"
              >
                <RotateCcw className="w-4 h-4" />
                重新开始
              </button>
            </div>
          </div>

          <p className="mb-6 text-xs text-muted-foreground">
            {project.repair && project.repair.appliedFixes.length > 0
              ? `本次冒险使用已修补 ${project.repair.appliedFixes.length} 处漏洞后的设定。`
              : ""}
          </p>

          {/* Mode switcher */}
          <div className="flex gap-2 mb-8">
            <button
              onClick={() => setMode("existing")}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg border transition-all text-sm ${
                mode === "existing"
                  ? "bg-amber text-ink border-amber font-medium"
                  : "bg-card text-muted-foreground border-border hover:border-amber/40"
              }`}
            >
              <User className="w-4 h-4" />
              扮演故事角色
            </button>
            <button
              onClick={() => setMode("custom")}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg border transition-all text-sm ${
                mode === "custom"
                  ? "bg-amber text-ink border-amber font-medium"
                  : "bg-card text-muted-foreground border-border hover:border-amber/40"
              }`}
            >
              <UserPlus className="w-4 h-4" />
              自创角色
            </button>
          </div>

          {mode === "existing" ? (
            <>
              <p className="text-xs text-muted-foreground mb-3">
                从小说设定中挑选一位人物，以第一人称进入属于 TA 的故事
              </p>
              {characters.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {characters.map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSelectCharacter(item)}
                      className="text-left p-5 bg-card border border-border rounded-xl hover:border-amber/40 hover:bg-secondary/50 transition-all group"
                    >
                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                          <User className="w-5 h-5 text-amber" />
                        </div>
                        <div>
                          <p className="font-serif text-lg text-parchment group-hover:text-amber-light transition-colors">
                            {item.name}
                          </p>
                          <p className="text-xs text-amber">{item.role || "关键人物"}</p>
                        </div>
                      </div>
                      {item.abilities && (
                        <p className="text-xs text-muted-foreground mb-2">
                          能力：{item.abilities}
                        </p>
                      )}
                      {item.personality && (
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {item.personality}
                        </p>
                      )}
                      <span className="inline-flex items-center gap-1 mt-3 text-xs text-amber opacity-0 group-hover:opacity-100 transition-opacity">
                        扮演 TA 进入故事 <ChevronRight className="w-3 h-3" />
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-8 bg-card border border-border rounded-xl text-center text-muted-foreground">
                  设定圣经中暂未提取到人物，可直接自创角色进入故事。
                </div>
              )}
            </>
          ) : (
            <div className="bg-card border border-border rounded-xl p-6 space-y-4">
              <p className="text-xs text-muted-foreground">
                创造一位只属于你的角色，踏入小说世界的冒险
              </p>
              <div>
                <label className="block text-sm text-parchment mb-1.5">
                  角色名字 <span className="text-crimson">*</span>
                </label>
                <input
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="例如：云中客"
                  className="w-full px-4 py-2.5 bg-secondary border border-border rounded-lg text-parchment placeholder:text-muted-foreground/50 focus:outline-none focus:border-amber/50"
                />
              </div>
              <div>
                <label className="block text-sm text-parchment mb-1.5">角色背景</label>
                <textarea
                  value={customBg}
                  onChange={(e) => setCustomBg(e.target.value)}
                  placeholder="例如：一位从异世界误入此处的流浪旅人，对这个世界一无所知…"
                  rows={3}
                  className="w-full px-4 py-2.5 bg-secondary border border-border rounded-lg text-parchment placeholder:text-muted-foreground/50 focus:outline-none focus:border-amber/50 resize-none"
                />
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-parchment mb-1.5">能力 / 特长（可选）</label>
                  <input
                    value={customAbilities}
                    onChange={(e) => setCustomAbilities(e.target.value)}
                    placeholder="例如：通晓古文字、剑术"
                    className="w-full px-4 py-2.5 bg-secondary border border-border rounded-lg text-parchment placeholder:text-muted-foreground/50 focus:outline-none focus:border-amber/50"
                  />
                </div>
                <div>
                  <label className="block text-sm text-parchment mb-1.5">性格（可选）</label>
                  <input
                    value={customPersonality}
                    onChange={(e) => setCustomPersonality(e.target.value)}
                    placeholder="例如：谨慎、好奇"
                    className="w-full px-4 py-2.5 bg-secondary border border-border rounded-lg text-parchment placeholder:text-muted-foreground/50 focus:outline-none focus:border-amber/50"
                  />
                </div>
              </div>
              <button
                onClick={handleCreateCustom}
                disabled={!customName.trim()}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-amber text-ink font-medium rounded-lg hover:bg-amber-light transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <UserPlus className="w-4 h-4" />
                以 TA 的身份开始冒险
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ---- Game view ----
  return (
    <div className="min-h-screen py-6 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3 animate-fade-in">
          <div className="flex items-center gap-3">
            <Gamepad2 className="w-6 h-6 text-amber" />
            <div>
              <h1 className="font-serif text-xl font-bold text-parchment">
                {displayTitle}
              </h1>
              <p className="text-xs text-amber">扮演：{character.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleUndo}
              disabled={!canUndo}
              title="回到上一次选择之前"
              className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-parchment border border-border rounded-lg hover:border-amber/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Undo2 className="w-4 h-4" />
              回退
            </button>
            <button
              type="button"
              onClick={onExport}
              className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-parchment border border-border rounded-lg hover:border-amber/30 transition-all"
            >
              <Download className="w-4 h-4" />
              导出
            </button>
            <button
              type="button"
              onClick={resetToSelect}
              className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-parchment border border-border rounded-lg hover:border-amber/30 transition-all"
            >
              <RotateCcw className="w-4 h-4" />
              切换角色
            </button>
          </div>
        </div>

        <div className="mb-6 flex items-center justify-between text-[11px] text-muted-foreground">
          <span className={saveState === "error" ? "text-crimson" : ""}>
            {SAVE_LABELS[saveState]}
          </span>
          <span>
            第 {adventure?.turn ?? 0} 回合 · 可回退 {adventure?.snapshots.length ?? 0} 步
          </span>
        </div>

        {/* Loading */}
        {isInitializing && (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-12 h-12 text-amber animate-spin mb-6" />
            <p className="text-parchment font-serif text-xl mb-2">
              正在生成冒险世界...
            </p>
            <p className="text-muted-foreground text-sm">
              以 {character.name} 的身份，将设定圣经转化为可玩的文字冒险游戏
            </p>
          </div>
        )}

        {error && !isInitializing && !gameState && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="mb-5 max-w-xl text-sm text-crimson">{error}</p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link
                href="/settings/"
                className="rounded-lg border border-amber/30 px-5 py-2.5 text-sm text-parchment transition-colors hover:border-amber/60"
              >
                前往 AI 设置
              </Link>
              <button
                type="button"
                onClick={resetToSelect}
                className="rounded-lg border border-border px-5 py-2.5 text-sm text-muted-foreground transition-colors hover:border-amber/30 hover:text-parchment"
              >
                重新选择角色
              </button>
            </div>
          </div>
        )}

        {/* Game Content */}
        {gameState && !isInitializing && (
          <div className="animate-fade-in">
            {/* Stats Bar */}
            {!isEnding && (
              <div className="flex items-center gap-4 mb-6 p-4 bg-card border border-border rounded-xl">
                <div className="flex items-center gap-4 flex-1">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-amber" />
                    <span className="text-xs text-parchment">{gameState.playerCharacter.name}</span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <StatBar icon={<Heart className="w-4 h-4 text-crimson" />} value={stats.health} color="bg-crimson" />
                  <StatBar icon={<Zap className="w-4 h-4 text-amber" />} value={stats.power} color="bg-amber" />
                  <StatBar icon={<Star className="w-4 h-4 text-sage" />} value={stats.reputation} color="bg-sage" />
                </div>
              </div>
            )}

            {/* Game Log */}
            <div
              ref={scrollRef}
              className="bg-card border border-border rounded-xl p-6 min-h-[400px] max-h-[60vh] overflow-y-auto mb-6"
            >
              {history.map((entry, i) => (
                <div key={i} className="mb-4">
                  {entry.type === "narration" ? (
                    <p className="game-text text-parchment leading-relaxed whitespace-pre-wrap">
                      {i === liveIndex ? displayedText || entry.text : entry.text}
                    </p>
                  ) : (
                    <div className="flex items-center gap-2 pl-4 border-l-2 border-amber/30 my-3">
                      <ChevronRight className="w-4 h-4 text-amber" />
                      <p className="text-amber text-sm italic">{entry.text}</p>
                    </div>
                  )}
                </div>
              ))}

              {history.length === 0 && !isProcessing && (
                <p className="text-sm text-muted-foreground">故事即将开始…</p>
              )}

              {/* Processing indicator */}
              {isProcessing && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm game-text">命运正在编织...</span>
                </div>
              )}
            </div>

            {error && !isProcessing && (
              <div className="mb-4 rounded-lg border border-crimson/30 bg-crimson/10 px-4 py-3 text-sm text-crimson">
                {error}{" "}
                <Link href="/settings/" className="underline underline-offset-2 hover:text-amber">
                  打开 AI 设置
                </Link>
              </div>
            )}

            {/* Ending */}
            {isEnding && (
              <div className="text-center py-8 animate-fade-in">
                <Skull className="w-16 h-16 text-amber mx-auto mb-4" />
                <h2 className="font-serif text-2xl text-parchment mb-4">冒险结束</h2>
                {endingText && (
                  <p className="text-muted-foreground mb-8 max-w-md mx-auto leading-relaxed">{endingText}</p>
                )}
                <div className="flex items-center justify-center gap-4 mb-6">
                  <div className="text-center">
                    <Heart className="w-5 h-5 text-crimson mx-auto mb-1" />
                    <span className="text-sm text-parchment">{stats.health}</span>
                  </div>
                  <div className="text-center">
                    <Zap className="w-5 h-5 text-amber mx-auto mb-1" />
                    <span className="text-sm text-parchment">{stats.power}</span>
                  </div>
                  <div className="text-center">
                    <Star className="w-5 h-5 text-sage mx-auto mb-1" />
                    <span className="text-sm text-parchment">{stats.reputation}</span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <button
                    onClick={handleUndo}
                    disabled={!canUndo}
                    className="px-6 py-3 border border-border text-muted-foreground font-medium rounded-lg hover:border-amber/40 hover:text-parchment transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    回退一步
                  </button>
                  <button
                    onClick={resetToSelect}
                    className="px-8 py-3 bg-amber text-ink font-medium rounded-lg hover:bg-amber-light transition-colors"
                  >
                    换个角色再来一次
                  </button>
                </div>
              </div>
            )}

            {/* Choices */}
            {!isEnding && currentScene && !isProcessing && (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground mb-2">
                  当前位置: {currentScene.location}
                </p>
                {currentScene.choices.map((choice) => (
                  <button
                    key={choice.id}
                    onClick={() => handleChoice(choice.id, choice.text)}
                    className="w-full text-left p-4 bg-card border border-border rounded-xl hover:border-amber/40 hover:bg-secondary/50 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <ChevronRight className="w-4 h-4 text-amber opacity-0 group-hover:opacity-100 transition-opacity" />
                      <div className="flex-1">
                        <p className="text-parchment group-hover:text-amber-light transition-colors">
                          {choice.text}
                        </p>
                        {choice.hint && (
                          <p className="text-xs text-muted-foreground mt-1">{choice.hint}</p>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StatBar({
  icon,
  value,
  color,
}: {
  icon: React.ReactNode;
  value: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2">
      {icon}
      <div className="w-16 h-2 bg-secondary rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all duration-500`}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground w-6 text-right">{value}</span>
    </div>
  );
}

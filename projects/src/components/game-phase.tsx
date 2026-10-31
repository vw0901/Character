"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import {
  Gamepad2, Heart, Zap, Star, Loader2, RotateCcw,
  ChevronRight, Skull, User, UserPlus, Wand2,
} from "lucide-react";
import { withAiConfig } from "@/lib/ai/browser";
import { readSseText } from "@/lib/ai/sse";
import type { SettingBible, GameState, SceneResult, CharacterChoice } from "@/app/page";

interface GamePhaseProps {
  bible: SettingBible;
  gameState: GameState | null;
  setGameState: (state: GameState | null) => void;
  onRestart: () => void;
}

export function GamePhase({
  bible,
  gameState,
  setGameState,
  onRestart,
}: GamePhaseProps) {
  const [selectedCharacter, setSelectedCharacter] = useState<CharacterChoice | null>(null);
  const [mode, setMode] = useState<"existing" | "custom">("existing");
  const [customName, setCustomName] = useState("");
  const [customBg, setCustomBg] = useState("");
  const [customAbilities, setCustomAbilities] = useState("");
  const [customPersonality, setCustomPersonality] = useState("");

  const [isInitializing, setIsInitializing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [narration, setNarration] = useState("");
  const [displayedText, setDisplayedText] = useState("");
  const [stats, setStats] = useState({ health: 100, power: 50, reputation: 50 });
  const [history, setHistory] = useState<Array<{ type: "narration" | "choice"; text: string }>>([]);
  const [isEnding, setIsEnding] = useState(false);
  const [endingText, setEndingText] = useState("");
  const [rawText, setRawText] = useState("");
  const [error, setError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const typewriterRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fullTextRef = useRef<string>("");

  const characters = bible.characters || [];

  const parseGameState = useCallback((text: string): GameState | null => {
    try {
      const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const json = JSON.parse(cleaned);
      return json as GameState;
    } catch {
      return null;
    }
  }, []);

  const parseSceneResult = useCallback((text: string): SceneResult | null => {
    try {
      const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const json = JSON.parse(cleaned);
      return json as SceneResult;
    } catch {
      return null;
    }
  }, []);

  // Initialize game only after a character is chosen
  useEffect(() => {
    if (!selectedCharacter) return;
    if (gameState) {
      setDisplayedText(gameState.intro);
      setStats(gameState.playerCharacter.initialStats);
      setHistory([{ type: "narration", text: gameState.intro }]);
      return;
    }

    const initGame = async () => {
      setIsInitializing(true);
      setRawText("");
      setError("");

      try {
        const res = await fetch("/api/game", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            withAiConfig({ bible, characterChoice: selectedCharacter })
          ),
        });

        let accumulated = "";
        for await (const text of readSseText(res)) {
          accumulated += text;
          setRawText(accumulated);
        }

        const parsed = parseGameState(accumulated);
        if (parsed) {
          // Ensure the player character reflects the chosen identity
          parsed.playerCharacter = {
            name: selectedCharacter.name,
            background: selectedCharacter.background,
            initialStats: parsed.playerCharacter?.initialStats || { health: 100, power: 50, reputation: 50 },
          };
          setGameState(parsed);
          setDisplayedText(parsed.intro);
          setStats(parsed.playerCharacter.initialStats);
          setHistory([{ type: "narration", text: parsed.intro }]);
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

    initGame();
  }, [bible, gameState, selectedCharacter, setGameState, parseGameState]);

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

  const handleSelectCharacter = (character: (typeof characters)[number]) => {
    const roleText = character.role ? `身份：${character.role}` : "";
    const abilityText = character.abilities ? `能力：${character.abilities}` : "";
    const relationText = character.relationships ? `关系：${character.relationships}` : "";
    const personalityText = character.personality ? `性格：${character.personality}` : "";
    setSelectedCharacter({
      mode: "existing",
      name: character.name,
      background: [roleText, abilityText, relationText, personalityText]
        .filter(Boolean)
        .join("；") || "故事中的关键人物",
      abilities: character.abilities,
      personality: character.personality,
    });
  };

  const handleCreateCustom = () => {
    if (!customName.trim()) return;
    setSelectedCharacter({
      mode: "custom",
      name: customName.trim(),
      background: customBg.trim() || "一位刚刚踏入小说世界的旅人",
      abilities: customAbilities.trim() || undefined,
      personality: customPersonality.trim() || undefined,
    });
  };

  const handleChoice = async (choiceId: string, choiceText: string) => {
    if (isProcessing) return;

    setHistory((prev) => [...prev, { type: "choice", text: choiceText }]);
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
              ...gameState,
              currentScene: gameState?.currentScene,
              stats,
            },
            choiceId,
            choiceText,
            characterChoice: selectedCharacter,
          })
        ),
      });

      let accumulated = "";
      for await (const text of readSseText(res)) {
        accumulated += text;
      }

      const result = parseSceneResult(accumulated);
      if (result) {
        setStats((prev) => ({
          health: Math.max(0, Math.min(100, prev.health + (result.statsChange?.health || 0))),
          power: Math.max(0, Math.min(100, prev.power + (result.statsChange?.power || 0))),
          reputation: Math.max(0, Math.min(100, prev.reputation + (result.statsChange?.reputation || 0))),
        }));

        if (result.isEnding) {
          setIsEnding(true);
          setEndingText(result.endingText || "");
          setHistory((prev) => [...prev, { type: "narration", text: result.narration }]);
          setNarration(result.narration);
        } else {
          const newState: GameState = {
            ...gameState!,
            currentScene: result.currentScene,
          };
          setGameState(newState);
          setHistory((prev) => [...prev, { type: "narration", text: result.narration }]);
          setNarration(result.narration);
        }
      } else if (!accumulated) {
        setError("AI 服务未返回内容，请检查服务配置后重试");
      } else {
        setError("AI 返回的下一场景无法解析，请重新选择该选项");
      }
    } catch (err) {
      console.error("Action failed:", err);
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

  const currentScene = gameState?.currentScene;

  // ---- Character selection screen ----
  if (!selectedCharacter) {
    return (
      <div className="min-h-screen py-6 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-8 animate-fade-in">
            <div className="flex items-center gap-3">
              <Wand2 className="w-6 h-6 text-amber" />
              <h1 className="font-serif text-xl font-bold text-parchment">{"选择你的角色"}</h1>
            </div>
            <button
              onClick={onRestart}
              className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground hover:text-parchment border border-border rounded-lg hover:border-amber/30 transition-all"
            >
              <RotateCcw className="w-4 h-4" />
              {"重新开始"}
            </button>
          </div>

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
              {"扮演故事角色"}
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
              {"自创角色"}
            </button>
          </div>

          {mode === "existing" ? (
            <>
              <p className="text-xs text-muted-foreground mb-3">
                {"从小说设定中挑选一位人物，以第一人称进入属于 TA 的故事"}
              </p>
              {characters.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {characters.map((character, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSelectCharacter(character)}
                      className="text-left p-5 bg-card border border-border rounded-xl hover:border-amber/40 hover:bg-secondary/50 transition-all group"
                    >
                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                          <User className="w-5 h-5 text-amber" />
                        </div>
                        <div>
                          <p className="font-serif text-lg text-parchment group-hover:text-amber-light transition-colors">
                            {character.name}
                          </p>
                          <p className="text-xs text-amber">{character.role || "关键人物"}</p>
                        </div>
                      </div>
                      {character.abilities && (
                        <p className="text-xs text-muted-foreground mb-2">
                          {"能力"}：{character.abilities}
                        </p>
                      )}
                      {character.personality && (
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {character.personality}
                        </p>
                      )}
                      <span className="inline-flex items-center gap-1 mt-3 text-xs text-amber opacity-0 group-hover:opacity-100 transition-opacity">
                        {"扮演 TA 进入故事"} <ChevronRight className="w-3 h-3" />
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-8 bg-card border border-border rounded-xl text-center text-muted-foreground">
                  {"设定圣经中暂未提取到人物，可直接自创角色进入故事。"}
                </div>
              )}
            </>
          ) : (
            <div className="bg-card border border-border rounded-xl p-6 space-y-4">
              <p className="text-xs text-muted-foreground">
                {"创造一位只属于你的角色，踏入小说世界的冒险"}
              </p>
              <div>
                <label className="block text-sm text-parchment mb-1.5">
                  {"角色名字"} <span className="text-crimson">*</span>
                </label>
                <input
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="例如：云中客"
                  className="w-full px-4 py-2.5 bg-secondary border border-border rounded-lg text-parchment placeholder:text-muted-foreground/50 focus:outline-none focus:border-amber/50"
                />
              </div>
              <div>
                <label className="block text-sm text-parchment mb-1.5">{"角色背景"}</label>
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
                  <label className="block text-sm text-parchment mb-1.5">{"能力 / 特长（可选）"}</label>
                  <input
                    value={customAbilities}
                    onChange={(e) => setCustomAbilities(e.target.value)}
                    placeholder="例如：通晓古文字、剑术"
                    className="w-full px-4 py-2.5 bg-secondary border border-border rounded-lg text-parchment placeholder:text-muted-foreground/50 focus:outline-none focus:border-amber/50"
                  />
                </div>
                <div>
                  <label className="block text-sm text-parchment mb-1.5">{"性格（可选）"}</label>
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
                {"以 TA 的身份开始冒险"}
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
        <div className="flex items-center justify-between mb-6 animate-fade-in">
          <div className="flex items-center gap-3">
            <Gamepad2 className="w-6 h-6 text-amber" />
            <div>
              <h1 className="font-serif text-xl font-bold text-parchment">
                {gameState?.title || "文字冒险"}
              </h1>
              <p className="text-xs text-amber">{"扮演"}：{selectedCharacter.name}</p>
            </div>
          </div>
          <button
            onClick={() => { setSelectedCharacter(null); setGameState(null); setHistory([]); setIsEnding(false); setNarration(""); setError(""); }}
            className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground hover:text-parchment border border-border rounded-lg hover:border-amber/30 transition-all"
          >
            <RotateCcw className="w-4 h-4" />
            {"切换角色"}
          </button>
        </div>

        {/* Loading */}
        {isInitializing && (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-12 h-12 text-amber animate-spin mb-6" />
            <p className="text-parchment font-serif text-xl mb-2">
              {"正在生成冒险世界..."}
            </p>
            <p className="text-muted-foreground text-sm">
              {"以 "}{selectedCharacter.name}{" 的身份，将设定圣经转化为可玩的文字冒险游戏"}
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
                onClick={() => setSelectedCharacter(null)}
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
              {/* History */}
              {history.map((entry, i) => (
                <div key={i} className="mb-4">
                  {entry.type === "narration" ? (
                    <p className="game-text text-parchment leading-relaxed whitespace-pre-wrap">
                      {i === history.length - 1 ? displayedText || entry.text : entry.text}
                    </p>
                  ) : (
                    <div className="flex items-center gap-2 pl-4 border-l-2 border-amber/30 my-3">
                      <ChevronRight className="w-4 h-4 text-amber" />
                      <p className="text-amber text-sm italic">{entry.text}</p>
                    </div>
                  )}
                </div>
              ))}

              {/* Processing indicator */}
              {isProcessing && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm game-text">{"命运正在编织..."}</span>
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
                <h2 className="font-serif text-2xl text-parchment mb-4">{"冒险结束"}</h2>
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
                <button
                  onClick={() => { setSelectedCharacter(null); setGameState(null); setHistory([]); setIsEnding(false); setNarration(""); setError(""); }}
                  className="px-8 py-3 bg-amber text-ink font-medium rounded-lg hover:bg-amber-light transition-colors"
                >
                  {"换个角色再来一次"}
                </button>
              </div>
            )}

            {/* Choices */}
            {!isEnding && currentScene && !isProcessing && (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground mb-2">
                  {"当前位置"}: {currentScene.location}
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
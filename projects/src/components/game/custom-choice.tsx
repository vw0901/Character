"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Send, Sparkles, Undo2 } from "lucide-react";
import { withAiConfig } from "@/lib/ai/browser";
import { errorMessage } from "@/lib/ai/error";
import type {
  CharacterChoice,
  HistoryEntry,
  Scene,
  SettingBible,
  StoryGoal,
} from "@/lib/project";

/** 与后端一致：行动描述最长 200 字。 */
const MAX_CHARS = 200;
const POLISH_TIMEOUT_MS = 30_000;

interface CustomChoiceProps {
  scene: Scene;
  turn: number;
  bible: SettingBible;
  character: CharacterChoice | null;
  goal: StoryGoal;
  history: HistoryEntry[];
  onChoice: (choiceId: string, choiceText: string) => void;
}

function readPolished(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    throw new Error("AI 没有返回润色结果，请重试");
  }
  const record = payload as { ok?: unknown; text?: unknown; error?: unknown };
  if (typeof record.error === "string" && record.error) {
    throw new Error(record.error);
  }
  if (record.ok === false) {
    throw new Error("AI 没有返回润色结果，请重试");
  }
  const text = typeof record.text === "string" ? record.text.trim() : "";
  if (!text) throw new Error("AI 没有返回润色结果，请重试");
  return text.slice(0, MAX_CHARS);
}

/** 玩家自己写行动：可以直接出门，也可以先让 AI 润色成一句更贴故事的话。 */
export function CustomChoice({
  scene,
  turn,
  bible,
  character,
  goal,
  history,
  onChoice,
}: CustomChoiceProps) {
  const [text, setText] = useState("");
  const [originalText, setOriginalText] = useState("");
  const [isPolishing, setIsPolishing] = useState(false);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  // 场景已经翻页时，上一次润色的结果不能再写进输入框。
  const polishSeqRef = useRef(0);

  // 进入新的一轮就清空；行动失败时场景没变，手写的文字还留着可以重试。
  useEffect(() => {
    polishSeqRef.current += 1;
    abortRef.current?.abort();
    setText("");
    setOriginalText("");
    setError("");
    setIsPolishing(false);
  }, [scene.id, turn]);

  // 离开冒险界面时别让润色请求继续跑。
  useEffect(() => () => abortRef.current?.abort(), []);

  const trimmed = text.trim();
  const canPolish = trimmed.length >= 2 && !isPolishing;
  const canSubmit = trimmed.length > 0 && !isPolishing;

  const handlePolish = async () => {
    if (!canPolish) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const seq = polishSeqRef.current;
    const timer = window.setTimeout(() => controller.abort(), POLISH_TIMEOUT_MS);

    setIsPolishing(true);
    setError("");
    try {
      const res = await fetch("/api/game/polish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify(
          withAiConfig({
            bible,
            characterChoice: character,
            goal,
            scene: {
              id: scene.id,
              location: scene.location,
              description: scene.description,
            },
            history: history.slice(-6).map(({ type, text }) => ({ type, text })),
            text: trimmed,
          })
        ),
      });
      const payload: unknown = await res.json().catch(() => null);
      const polished = readPolished(payload);
      if (seq !== polishSeqRef.current) return;
      setOriginalText(text);
      setText(polished);
    } catch (err) {
      if (seq !== polishSeqRef.current) return;
      setError(
        controller.signal.aborted
          ? "润色超时，可以再试一次"
          : errorMessage(err, "润色失败，请检查 AI 服务配置后重试")
      );
    } finally {
      window.clearTimeout(timer);
      if (seq === polishSeqRef.current) setIsPolishing(false);
    }
  };

  const handleSubmit = () => {
    if (!canSubmit) return;
    onChoice(`custom_${turn}`, trimmed);
  };

  const restore = () => {
    if (!originalText) return;
    setText(originalText);
    setOriginalText("");
    setError("");
  };

  return (
    <div className="rounded-xl border border-dashed border-border bg-card/60 p-4">
      <div className="mb-2 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-amber" />
        <p className="text-xs text-muted-foreground">
          或者，自己写一个行动（写好后可以让 AI 润色，也可以直接行动）
        </p>
      </div>

      <textarea
        value={text}
        onChange={(event) => {
          setText(event.target.value.slice(0, MAX_CHARS));
          if (error) setError("");
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            handleSubmit();
          }
        }}
        rows={3}
        maxLength={MAX_CHARS}
        disabled={isPolishing}
        aria-label="自己写一个行动"
        placeholder="用你自己的话写下此刻想做的事，例如：我压低声音，问斗笠人是不是守桥人。"
        className="w-full resize-none rounded-lg border border-border bg-secondary px-4 py-2.5 text-sm text-parchment placeholder:text-muted-foreground/50 focus:border-amber/50 focus:outline-none disabled:opacity-60"
      />

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {text.length}/{MAX_CHARS} · Ctrl+Enter 直接行动
        </p>
        <div className="flex items-center gap-2">
          {originalText && !isPolishing && (
            <button
              type="button"
              onClick={restore}
              className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-amber/30 hover:text-parchment"
            >
              <Undo2 className="h-3.5 w-3.5" />
              还原原句
            </button>
          )}
          <button
            type="button"
            onClick={() => void handlePolish()}
            disabled={!canPolish}
            className="flex items-center gap-1.5 rounded-lg border border-amber/30 px-3 py-1.5 text-xs text-amber transition-colors hover:border-amber/60 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isPolishing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            {isPolishing ? "润色中…" : "润色"}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="flex items-center gap-1.5 rounded-lg bg-amber px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-amber-light disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Send className="h-3.5 w-3.5" />
            开始行动
          </button>
        </div>
      </div>

      {isPolishing && (
        <p className="mt-2 text-xs text-muted-foreground">
          AI 正在把你的行动写成故事里的一句话…
        </p>
      )}
      {error && <p className="mt-2 text-xs text-crimson">{error}</p>}
    </div>
  );
}

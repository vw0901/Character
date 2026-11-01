"use client";

import { useEffect, useRef } from "react";
import { ChevronRight, Loader2 } from "lucide-react";
import type { HistoryEntry } from "@/lib/project";

interface GameLogProps {
  history: HistoryEntry[];
  displayedText: string;
  liveIndex: number;
  isProcessing: boolean;
  /** 判定目标是否达成时的提示；不传则显示默认等待文案。 */
  processingLabel?: string;
  /** 本回合文字还在逐字显示。 */
  isTyping?: boolean;
  /** 点击「显示全文」时立即结束打字。 */
  onSkipTyping?: () => void;
}

export function GameLog({
  history,
  displayedText,
  liveIndex,
  isProcessing,
  processingLabel,
  isTyping = false,
  onSkipTyping,
}: GameLogProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history, displayedText]);

  return (
    <div
      ref={scrollRef}
      className="bg-card border border-border rounded-xl p-6 min-h-[400px] max-h-[60vh] overflow-y-auto mb-6"
    >
      {history.map((entry, i) => (
        <div key={i} className="mb-4">
          {entry.type === "narration" ? (
            <p className="game-text text-parchment leading-relaxed whitespace-pre-wrap">
              {/* 打字期间以 displayedText 为准，否则会先闪一下整段文字再从头打。 */}
              {i === liveIndex && (isTyping || displayedText)
                ? displayedText
                : entry.text}
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

      {isTyping && onSkipTyping && (
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            onClick={onSkipTyping}
            className="rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-amber/40 hover:text-parchment"
          >
            显示全文
          </button>
        </div>
      )}

      {isProcessing && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm game-text">
            {processingLabel ?? "命运正在编织..."}
          </span>
        </div>
      )}
    </div>
  );
}

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
}

export function GameLog({
  history,
  displayedText,
  liveIndex,
  isProcessing,
  processingLabel,
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

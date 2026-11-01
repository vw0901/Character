import { Heart, RotateCcw, Skull, Star, Trophy, Undo2, Zap } from "lucide-react";
import type { AdventureOutcome, StatValues } from "@/lib/project";

interface OutcomePanelProps {
  outcome: Exclude<AdventureOutcome, "playing">;
  reason: string;
  endingText: string;
  stats: StatValues;
  canUndo: boolean;
  onUndo: () => void;
  onRestartBook: () => void;
  onLeave: () => void;
}

export function OutcomePanel({
  outcome,
  reason,
  endingText,
  stats,
  canUndo,
  onUndo,
  onRestartBook,
  onLeave,
}: OutcomePanelProps) {
  const success = outcome === "success";

  return (
    <div className="text-center py-8 animate-fade-in">
      {success ? (
        <Trophy className="w-16 h-16 text-amber mx-auto mb-4" />
      ) : (
        <Skull className="w-16 h-16 text-crimson mx-auto mb-4" />
      )}
      <h2 className="font-serif text-2xl text-parchment mb-2">
        {success ? "达成最终目标" : "冒险失败"}
      </h2>
      {reason && (
        <p className={`text-sm mb-3 ${success ? "text-forest" : "text-crimson"}`}>{reason}</p>
      )}
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
          onClick={onUndo}
          disabled={!canUndo}
          className="inline-flex items-center gap-2 px-6 py-3 border border-border text-muted-foreground font-medium rounded-lg hover:border-amber/40 hover:text-parchment transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Undo2 className="w-4 h-4" />
          回退一步
        </button>
        <button
          onClick={onRestartBook}
          className="inline-flex items-center gap-2 px-6 py-3 border border-border text-muted-foreground font-medium rounded-lg hover:border-amber/40 hover:text-parchment transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          重开本角色
        </button>
        <button
          onClick={onLeave}
          className="px-8 py-3 bg-amber text-ink font-medium rounded-lg hover:bg-amber-light transition-colors"
        >
          换一本故事书
        </button>
      </div>
    </div>
  );
}

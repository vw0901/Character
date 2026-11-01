import {
  BookOpen,
  Feather,
  Heart,
  Loader2,
  RotateCcw,
  Skull,
  Star,
  Trophy,
  Undo2,
  Users,
  Zap,
} from "lucide-react";
import type { AdventureOutcome, StatValues } from "@/lib/project";

interface OutcomePanelProps {
  outcome: Exclude<AdventureOutcome, "playing">;
  reason: string;
  endingText: string;
  epilogue: string;
  epilogueDraft: string;
  isWritingEpilogue: boolean;
  epilogueError: string;
  stats: StatValues;
  canUndo: boolean;
  onUndo: () => void;
  onWriteEpilogue: () => void;
  onRestartBook: () => void;
  onLeave: () => void;
}

/** 后日谈按空行分段，读起来像小说的收尾，而不是一整块文字。 */
function epilogueParagraphs(text: string): string[] {
  const blocks = text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
  // 模型只给单换行时再按行拆开，避免整篇挤成一段。
  if (blocks.length <= 1) {
    return (blocks[0] ?? "")
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean);
  }
  return blocks;
}

export function OutcomePanel({
  outcome,
  reason,
  endingText,
  epilogue,
  epilogueDraft,
  isWritingEpilogue,
  epilogueError,
  stats,
  canUndo,
  onUndo,
  onWriteEpilogue,
  onRestartBook,
  onLeave,
}: OutcomePanelProps) {
  const success = outcome === "success";
  // 重写时先藏起上一版，等新的文字流出来再显示，避免两版混在一起。
  const epilogueText = isWritingEpilogue ? epilogueDraft : epilogue;
  const paragraphs = epilogueParagraphs(epilogueText);

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

      <section className="mx-auto mb-8 max-w-xl rounded-xl border border-border bg-card/60 px-6 py-5 text-left">
        <header className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-amber">
            <Feather className="w-4 h-4" />
            <h3 className="font-serif text-sm tracking-wide">后日谈 · 大结局</h3>
          </div>
          {(epilogue || epilogueError) && !isWritingEpilogue && (
            <button
              type="button"
              onClick={onWriteEpilogue}
              className="text-xs text-muted-foreground transition-colors hover:text-amber"
            >
              {epilogue ? "重新书写" : "再试一次"}
            </button>
          )}
        </header>

        {paragraphs.length > 0 && (
          <div className="game-text text-parchment leading-relaxed">
            {paragraphs.map((paragraph, index) => (
              <p key={index} className="mb-3 last:mb-0">
                {paragraph}
              </p>
            ))}
            {isWritingEpilogue && (
              <span aria-hidden="true" className="inline-block text-amber animate-pulse">
                ▍
              </span>
            )}
          </div>
        )}

        {!isWritingEpilogue && epilogueError && (
          <p className="text-sm text-crimson">{epilogueError}</p>
        )}

        {!epilogueError && paragraphs.length === 0 && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="game-text text-sm">正在为这段故事写下后日谈...</span>
          </div>
        )}
      </section>

      {success && (
        <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto leading-relaxed">
          这段故事已经完结。你可以接着开启同一角色的下一段故事，或去书架选择其他故事和人物。
        </p>
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
        {success ? (
          <>
            <button
              onClick={onRestartBook}
              className="inline-flex items-center gap-2 px-8 py-3 bg-amber text-ink font-medium rounded-lg hover:bg-amber-light transition-colors"
            >
              <BookOpen className="w-4 h-4" />
              进入下一段故事
            </button>
            <button
              onClick={onLeave}
              className="inline-flex items-center gap-2 px-6 py-3 border border-border text-muted-foreground font-medium rounded-lg hover:border-amber/40 hover:text-parchment transition-colors"
            >
              <Users className="w-4 h-4" />
              选择其他故事或人物
            </button>
          </>
        ) : (
          <>
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
          </>
        )}
      </div>
    </div>
  );
}

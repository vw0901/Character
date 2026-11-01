import { Download, Gamepad2, RotateCcw, Undo2 } from "lucide-react";
import { SAVE_LABELS, type SaveState } from "@/lib/project";

interface GameHeaderProps {
  title: string;
  characterName: string;
  saveState: SaveState;
  turn: number;
  snapshotCount: number;
  canUndo: boolean;
  busy?: boolean;
  onUndo: () => void;
  onExport: () => void;
  onSwitchCharacter: () => void;
}

export function GameHeader({
  title,
  characterName,
  saveState,
  turn,
  snapshotCount,
  canUndo,
  busy = false,
  onUndo,
  onExport,
  onSwitchCharacter,
}: GameHeaderProps) {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3 animate-fade-in">
        <div className="flex items-center gap-3">
          <Gamepad2 className="w-6 h-6 text-amber" />
          <div>
            <h1 className="font-serif text-xl font-bold text-parchment">{title}</h1>
            <p className="text-xs text-amber">扮演：{characterName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onUndo}
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
            onClick={onSwitchCharacter}
            disabled={busy}
            title="回到故事书列表，当前进度会保留"
            className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-parchment border border-border rounded-lg hover:border-amber/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
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
          第 {turn} 回合 · 可回退 {snapshotCount} 步
        </span>
      </div>
    </>
  );
}

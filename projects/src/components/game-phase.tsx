"use client";

import Link from "next/link";
import { Loader2, User } from "lucide-react";
import type {
  AdventureState,
  CharacterChoice,
  ProjectDocument,
  SaveState,
  SettingBible,
} from "@/lib/project";
import { CharacterSelect } from "./game/character-select";
import { ChoiceList } from "./game/choice-list";
import { GameHeader } from "./game/game-header";
import { GameLog } from "./game/game-log";
import { OutcomePanel } from "./game/outcome-panel";
import { StatsRow } from "./game/stat-bar";
import { StoryStatus } from "./game/story-status";
import { useGameSession } from "./game/use-game-session";

interface GamePhaseProps {
  project: ProjectDocument;
  bible: SettingBible;
  adventure: AdventureState | null;
  books: Record<string, AdventureState>;
  saveState: SaveState;
  onAdventureChange: (adventure: AdventureState) => void;
  onStartBook: (character: CharacterChoice) => void;
  onOpenBook: (key: string) => void;
  onLeaveBook: () => void;
  onRestartBook: () => void;
  onExport: () => void;
  onRestart: () => void;
}

export function GamePhase({
  project,
  bible,
  adventure,
  books,
  saveState,
  onAdventureChange,
  onStartBook,
  onOpenBook,
  onLeaveBook,
  onRestartBook,
  onExport,
  onRestart,
}: GamePhaseProps) {
  const {
    characters,
    character,
    gameState,
    stats,
    history,
    endingText,
    epilogue,
    epilogueDraft,
    isWritingEpilogue,
    epilogueError,
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
    handleWriteEpilogue,
    resetToSelect,
  } = useGameSession({
    bible,
    adventure,
    onAdventureChange,
    onLeave: onLeaveBook,
  });

  if (!adventure || !character) {
    return (
      <CharacterSelect
        characters={characters}
        books={books}
        repairCount={project.repair?.appliedFixes.length ?? 0}
        onStart={onStartBook}
        onOpenBook={onOpenBook}
        onExport={onExport}
        onRestart={onRestart}
      />
    );
  }

  const liveIndex = narration ? history.length - 1 : -1;
  const displayTitle = gameState?.title || project.novelName || "文字冒险";
  const ended = adventure.outcome !== "playing";

  return (
    <div className="min-h-screen py-6 px-4">
      <div className="max-w-3xl mx-auto">
        <GameHeader
          title={displayTitle}
          characterName={character.name}
          saveState={saveState}
          turn={adventure.turn}
          snapshotCount={adventure.snapshots.length}
          canUndo={canUndo}
          onUndo={handleUndo}
          onExport={onExport}
          onSwitchCharacter={resetToSelect}
          busy={isProcessing || isInitializing}
        />

        <StoryStatus
          goal={adventure.goal}
          timeline={adventure.timeline}
          outcome={adventure.outcome}
        />

        {isInitializing && (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-12 h-12 text-amber animate-spin mb-6" />
            <p className="text-parchment font-serif text-xl mb-2">
              正在生成冒险世界...
            </p>
            <p className="text-muted-foreground text-sm">
              以 {character.name} 的身份，为 TA 定下最终目标与时间线
            </p>
          </div>
        )}

        {error && !isInitializing && !gameState && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="mb-5 max-w-xl text-sm text-crimson">{error}</p>
            <div className="flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={startAdventure.bind(null, character)}
                className="rounded-lg border border-amber/30 px-5 py-2.5 text-sm text-parchment transition-colors hover:border-amber/60"
              >
                重新生成开场
              </button>
              <Link
                href="/settings/"
                className="rounded-lg border border-border px-5 py-2.5 text-sm text-muted-foreground transition-colors hover:border-amber/30 hover:text-parchment"
              >
                前往 AI 设置
              </Link>
              <button
                type="button"
                onClick={resetToSelect}
                className="rounded-lg border border-border px-5 py-2.5 text-sm text-muted-foreground transition-colors hover:border-amber/30 hover:text-parchment"
              >
                更换故事书
              </button>
            </div>
          </div>
        )}

        {gameState && !isInitializing && (
          <div className="animate-fade-in">
            {!ended && (
              <div className="flex items-center gap-4 mb-6 p-4 bg-card border border-border rounded-xl">
                <div className="flex items-center gap-4 flex-1">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-amber" />
                    <span className="text-xs text-parchment">{gameState.playerCharacter.name}</span>
                  </div>
                </div>
                <StatsRow stats={stats} />
              </div>
            )}

            <GameLog
              history={history}
              displayedText={displayedText}
              liveIndex={liveIndex}
              isProcessing={isProcessing}
              processingLabel={
                isVerifyingGoal ? "正在判定本轮是否达成最终目标..." : undefined
              }
            />

            {error && !isProcessing && (
              <div className="mb-4 rounded-lg border border-crimson/30 bg-crimson/10 px-4 py-3 text-sm text-crimson">
                {error}{" "}
                <Link href="/settings/" className="underline underline-offset-2 hover:text-amber">
                  打开 AI 设置
                </Link>
              </div>
            )}

            {ended && (
              <OutcomePanel
                outcome={adventure.outcome === "success" ? "success" : "failure"}
                reason={adventure.outcomeReason}
                endingText={endingText}
                epilogue={epilogue}
                epilogueDraft={epilogueDraft}
                isWritingEpilogue={isWritingEpilogue}
                epilogueError={epilogueError}
                stats={stats}
                canUndo={canUndo}
                onUndo={handleUndo}
                onWriteEpilogue={handleWriteEpilogue}
                onRestartBook={onRestartBook}
                onLeave={resetToSelect}
              />
            )}

            {!ended && currentScene && !isProcessing && (
              <ChoiceList scene={currentScene} onChoice={handleChoice} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

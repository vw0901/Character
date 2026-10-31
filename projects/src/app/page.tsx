"use client";

import { useCallback, useEffect, useState } from "react";
import { SearchPhase } from "@/components/search-phase";
import { BibleDisplay } from "@/components/bible-display";
import { CheckDisplay } from "@/components/check-display";
import { GamePhase } from "@/components/game-phase";
import {
  createProjectFromSearch,
  downloadProject,
  saveProjectToServer,
  type AdventureState,
  type CheckResult,
  type ProjectDocument,
  type RepairResult,
  type SaveState,
  type SearchData,
  type SettingBible,
} from "@/lib/project";

type Phase = "search" | "bible" | "check" | "game";

function phaseForProject(project: ProjectDocument): Phase {
  if (project.bible && project.adventure?.gameState) return "game";
  if (project.bible && (project.check || project.repair)) return "check";
  if (project.bible || project.search) return "bible";
  return "search";
}

export default function Home() {
  const [phase, setPhase] = useState<Phase>("search");
  const [project, setProject] = useState<ProjectDocument | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");

  // 任意阶段变化后自动落盘：整个项目只写一个 JSON 文件。
  useEffect(() => {
    if (!project) return;
    let cancelled = false;
    setSaveState("saving");
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          await saveProjectToServer(project);
          if (!cancelled) setSaveState("saved");
        } catch {
          if (!cancelled) setSaveState("error");
        }
      })();
    }, 600);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [project]);

  const patchProject = useCallback((patch: Partial<ProjectDocument>) => {
    setProject((prev) =>
      prev ? { ...prev, ...patch, updatedAt: new Date().toISOString() } : prev
    );
  }, []);

  const handleSearchComplete = useCallback((data: SearchData) => {
    setProject(createProjectFromSearch(data));
    setPhase("bible");
  }, []);

  const handleImport = useCallback((imported: ProjectDocument) => {
    setProject({ ...imported, updatedAt: new Date().toISOString() });
    setPhase(phaseForProject(imported));
  }, []);

  const handleBibleComplete = useCallback(
    (bible: SettingBible) => {
      patchProject({ bible });
    },
    [patchProject]
  );

  const handleStartCheck = useCallback(() => {
    setPhase("check");
  }, []);

  const handleCheckComplete = useCallback(
    (check: CheckResult) => {
      patchProject({ check });
    },
    [patchProject]
  );

  const handleRepairComplete = useCallback(
    (repair: RepairResult) => {
      patchProject({ repair });
    },
    [patchProject]
  );

  const handleStartGame = useCallback(() => {
    setPhase("game");
  }, []);

  const handleAdventureChange = useCallback(
    (adventure: AdventureState | null) => {
      patchProject({ adventure });
    },
    [patchProject]
  );

  const handleRestart = useCallback(() => {
    setProject(null);
    setSaveState("idle");
    setPhase("search");
  }, []);

  const handleExport = useCallback(() => {
    if (project) downloadProject(project);
  }, [project]);

  return (
    <main className="min-h-screen">
      {phase === "search" && (
        <SearchPhase
          onSearchComplete={handleSearchComplete}
          onImportProject={handleImport}
        />
      )}

      {phase === "bible" && project && (
        <BibleDisplay
          project={project}
          saveState={saveState}
          onBibleComplete={handleBibleComplete}
          onStartCheck={handleStartCheck}
          onExport={handleExport}
          onRestart={handleRestart}
        />
      )}

      {phase === "check" && project?.bible && (
        <CheckDisplay
          project={project}
          saveState={saveState}
          onCheckComplete={handleCheckComplete}
          onRepairComplete={handleRepairComplete}
          onStartGame={handleStartGame}
          onExport={handleExport}
        />
      )}

      {phase === "game" && project?.bible && (
        <GamePhase
          project={project}
          bible={project.repair?.bible ?? project.bible}
          adventure={project.adventure}
          saveState={saveState}
          onAdventureChange={handleAdventureChange}
          onExport={handleExport}
          onRestart={handleRestart}
        />
      )}
    </main>
  );
}

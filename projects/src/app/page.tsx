"use client";

import { useCallback, useEffect, useState } from "react";
import { SearchPhase } from "@/components/search-phase";
import { BibleDisplay } from "@/components/bible-display";
import { CheckDisplay } from "@/components/check-display";
import { GamePhase } from "@/components/game-phase";
import {
  characterKey,
  createAdventure,
  createProjectFromSearch,
  downloadProject,
  saveProjectToServer,
  type AdventureState,
  type CharacterChoice,
  type CheckResult,
  type ProjectDocument,
  type RepairResult,
  type SaveState,
  type SearchData,
  type SettingBible,
} from "@/lib/project";

type Phase = "search" | "bible" | "check" | "game";

function phaseForProject(project: ProjectDocument): Phase {
  const hasBook =
    Boolean(project.activeAdventureKey) || Object.keys(project.adventures).length > 0;
  if (project.bible && hasBook) return "game";
  if (project.bible && (project.check || project.repair)) return "check";
  if (project.bible || project.search) return "bible";
  return "search";
}

function now(): string {
  return new Date().toISOString();
}

export default function Home() {
  const [phase, setPhase] = useState<Phase>("search");
  const [project, setProject] = useState<ProjectDocument | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");

  // 任意阶段变化后自动落盘：整个项目只写一个 JSON 文件，每本故事书都在里面。
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
      prev ? { ...prev, ...patch, updatedAt: now() } : prev
    );
  }, []);

  const handleSearchComplete = useCallback((data: SearchData) => {
    setProject(createProjectFromSearch(data));
    setPhase("bible");
  }, []);

  const handleImport = useCallback((imported: ProjectDocument) => {
    setProject({ ...imported, updatedAt: now() });
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

  const applyAdventure = useCallback((key: string, adventure: AdventureState) => {
    setProject((prev) => {
      if (!prev || !prev.adventures[key]) return prev;
      return {
        ...prev,
        adventures: { ...prev.adventures, [key]: adventure },
        updatedAt: now(),
      };
    });
  }, []);

  // 有书就继续，没有就为这个角色新建一本。
  const handleStartBook = useCallback((character: CharacterChoice) => {
    setProject((prev) => {
      if (!prev) return prev;
      const key = characterKey(character);
      if (prev.adventures[key]) {
        return { ...prev, activeAdventureKey: key, updatedAt: now() };
      }
      return {
        ...prev,
        adventures: { ...prev.adventures, [key]: createAdventure(character) },
        activeAdventureKey: key,
        updatedAt: now(),
      };
    });
  }, []);

  const handleOpenBook = useCallback((key: string) => {
    setProject((prev) => {
      if (!prev || !prev.adventures[key]) return prev;
      return { ...prev, activeAdventureKey: key, updatedAt: now() };
    });
  }, []);

  const handleLeaveBook = useCallback(() => {
    setProject((prev) => (prev ? { ...prev, activeAdventureKey: null, updatedAt: now() } : prev));
  }, []);

  const handleRestartBook = useCallback(() => {
    setProject((prev) => {
      const key = prev?.activeAdventureKey;
      if (!prev || !key) return prev;
      const book = prev.adventures[key];
      if (!book) return prev;
      return {
        ...prev,
        adventures: { ...prev.adventures, [key]: createAdventure(book.character) },
        updatedAt: now(),
      };
    });
  }, []);

  const handleRestart = useCallback(() => {
    setProject(null);
    setSaveState("idle");
    setPhase("search");
  }, []);

  const handleExport = useCallback(() => {
    if (project) downloadProject(project);
  }, [project]);

  const activeKey = project?.activeAdventureKey ?? null;
  const activeAdventure =
    project && activeKey ? project.adventures[activeKey] ?? null : null;

  // 请求回来时仍写回发起请求的那本书，避免切换角色后串档。
  const handleAdventureChange = useCallback(
    (adventure: AdventureState) => {
      if (activeKey) applyAdventure(activeKey, adventure);
    },
    [activeKey, applyAdventure]
  );

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
          adventure={activeAdventure}
          books={project.adventures}
          saveState={saveState}
          onAdventureChange={handleAdventureChange}
          onStartBook={handleStartBook}
          onOpenBook={handleOpenBook}
          onLeaveBook={handleLeaveBook}
          onRestartBook={handleRestartBook}
          onExport={handleExport}
          onRestart={handleRestart}
        />
      )}
    </main>
  );
}

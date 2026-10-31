"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BookOpen, Search, Loader2, Upload, FolderOpen, FileJson } from "lucide-react";
import { withAiConfig } from "@/lib/ai/browser";
import {
  listSavedProjects,
  loadSavedProject,
  parseImportedJson,
  readJsonFile,
  type ProjectDocument,
  type ProjectSummary,
  type SearchData,
} from "@/lib/project";

interface SearchPhaseProps {
  onSearchComplete: (data: SearchData) => void;
  onImportProject: (project: ProjectDocument) => void;
}

const IMPORT_LABELS: Record<string, string> = {
  project: "项目存档",
  bible: "设定圣经",
  search: "检索结果",
};

export function SearchPhase({ onSearchComplete, onImportProject }: SearchPhaseProps) {
  const [novelName, setNovelName] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [savedProjects, setSavedProjects] = useState<ProjectSummary[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [loadingId, setLoadingId] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadingSaved(true);
    void listSavedProjects()
      .then((projects) => {
        if (!cancelled) setSavedProjects(projects.slice(0, 6));
      })
      .catch(() => {
        if (!cancelled) setSavedProjects([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingSaved(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSearch = async () => {
    if (!novelName.trim()) return;
    setIsSearching(true);
    setError("");
    setNotice("");

    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(withAiConfig({ novelName: novelName.trim() })),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          data && typeof data.error === "string" ? data.error : "搜索失败，请重试"
        );
      }
      if (!data) {
        throw new Error("搜索服务返回内容无效");
      }

      onSearchComplete({
        novelName: data.novelName,
        summary: data.summary,
        results: data.results,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "搜索失败，请重试");
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const handleFilePicked = async (file: File | undefined) => {
    if (!file) return;
    setError("");
    setNotice("");
    try {
      const text = await readJsonFile(file);
      const { project, kind } = parseImportedJson(text);
      onImportProject(project);
      setNotice(`已从${IMPORT_LABELS[kind] ?? "JSON"}导入《${project.novelName}》`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "解析 JSON 失败");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleLoadSaved = async (id: string) => {
    setLoadingId(id);
    setError("");
    setNotice("");
    try {
      const project = await loadSavedProject(id);
      onImportProject(project);
    } catch (err) {
      setError(err instanceof Error ? err.message : "读取存档失败");
    } finally {
      setLoadingId("");
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-amber/5 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-amber/3 blur-3xl" />
      </div>

      <div className="relative z-10 max-w-2xl w-full text-center">
        {/* Logo/Icon */}
        <div className="mb-8 inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-card border border-border glow-amber">
          <BookOpen className="w-10 h-10 text-amber" />
        </div>

        {/* Title */}
        <h1 className="font-serif text-4xl md:text-5xl font-bold text-parchment mb-4 tracking-wide">
          {"假如是你"}
        </h1>
        <p className="text-muted-foreground text-lg mb-12 max-w-md mx-auto">
          {"输入一部小说，生成它的设定圣经，再以「你」为主角走进故事"}
        </p>

        {/* Search Input */}
        <div className="relative max-w-lg mx-auto">
          <div className="relative flex items-center">
            <Search className="absolute left-4 w-5 h-5 text-muted-foreground" />
            <input
              ref={inputRef}
              type="text"
              value={novelName}
              onChange={(e) => setNovelName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={"输入小说名，如《斗罗大陆》《三体》《魏临美小说》..."}
              className="w-full pl-12 pr-28 py-4 bg-card border border-border rounded-xl text-parchment placeholder:text-muted-foreground/50 focus:outline-none focus:border-amber/50 focus:ring-1 focus:ring-amber/30 transition-all text-lg"
              disabled={isSearching}
            />
            <button
              onClick={handleSearch}
              disabled={isSearching || !novelName.trim()}
              className="absolute right-2 px-6 py-2.5 bg-amber text-ink font-medium rounded-lg hover:bg-amber-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSearching ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {"检索中"}
                </>
              ) : (
                "检索"
              )}
            </button>
          </div>

          <div className="mt-3 flex items-center justify-center gap-2 text-sm">
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => void handleFilePicked(e.target.files?.[0])}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground border border-border rounded-lg hover:text-parchment hover:border-amber/40 transition-all"
            >
              <Upload className="w-3.5 h-3.5" />
              {"导入 JSON 存档"}
            </button>
            <span className="text-xs text-muted-foreground/60">
              {"支持项目存档 / 设定圣经 / 检索结果"}
            </span>
          </div>

          {error && (
            <p className="mt-3 text-crimson text-sm">
              {error}{" "}
              <Link href="/settings/" className="underline underline-offset-2 hover:text-amber">
                打开 AI 设置
              </Link>
            </p>
          )}

          {notice && <p className="mt-3 text-sm text-sage">{notice}</p>}
        </div>

        {/* Hints */}
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          {["斗罗大陆", "三体", "射雕英雄传", "魏临美小说", "哈利波特"].map((name) => (
            <button
              key={name}
              onClick={() => {
                setNovelName(name);
                inputRef.current?.focus();
              }}
              className="px-4 py-1.5 text-sm bg-secondary border border-border rounded-full text-muted-foreground hover:text-parchment hover:border-amber/30 transition-all"
            >
              {name}
            </button>
          ))}
        </div>

        {/* Saved projects */}
        <div className="mt-12 text-left">
          <div className="flex items-center gap-2 mb-3 text-xs text-muted-foreground">
            <FolderOpen className="w-4 h-4" />
            <span>{"本机存档"}</span>
            {loadingSaved && <Loader2 className="w-3 h-3 animate-spin" />}
          </div>

          {savedProjects.length > 0 ? (
            <div className="grid gap-2">
              {savedProjects.map((item) => (
                <button
                  key={item.id}
                  onClick={() => void handleLoadSaved(item.id)}
                  disabled={loadingId === item.id}
                  className="flex items-center gap-3 rounded-lg border border-border bg-card/60 px-4 py-2.5 text-left transition-all hover:border-amber/40 hover:bg-secondary/40 disabled:opacity-60"
                >
                  <FileJson className="w-4 h-4 shrink-0 text-amber" />
                  <span className="flex-1 truncate text-sm text-parchment">
                    {item.novelName}
                  </span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {item.hasAdventure
                      ? "冒险进行中"
                      : item.hasRepair
                        ? "已修补设定"
                        : item.hasBible
                          ? "设定圣经"
                          : "检索结果"}
                  </span>
                  {loadingId === item.id && (
                    <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin text-amber" />
                  )}
                </button>
              ))}
            </div>
          ) : (
            !loadingSaved && (
              <p className="text-xs text-muted-foreground/70">
                {"还没有存档。检索一部小说后会自动保存为 JSON 文件。"}
              </p>
            )
          )}
        </div>
      </div>
    </div>
  );
}

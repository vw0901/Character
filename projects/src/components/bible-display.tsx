"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import Link from "next/link";
import {
  BookOpen, Globe, Swords, Users, Clock, HelpCircle,
  ChevronDown, ChevronUp, Loader2, Shield, ArrowRight,
  Download, RotateCcw, CheckCircle2,
} from "lucide-react";
import { withAiConfig } from "@/lib/ai/browser";
import { errorMessage } from "@/lib/ai/error";
import { readSseText } from "@/lib/ai/sse";
import {
  SAVE_LABELS,
  normalizeBible,
  parseJsonLoose,
  type ProjectDocument,
  type SaveState,
  type SearchData,
  type SettingBible,
} from "@/lib/project";

interface BibleDisplayProps {
  project: ProjectDocument;
  saveState: SaveState;
  onBibleComplete: (bible: SettingBible) => void;
  onStartCheck: () => void;
  onExport: () => void;
  onRestart: () => void;
}

export function BibleDisplay({
  project,
  saveState,
  onBibleComplete,
  onStartCheck,
  onExport,
  onRestart,
}: BibleDisplayProps) {
  const [isGenerating, setIsGenerating] = useState(!project.bible);
  const [rawText, setRawText] = useState("");
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["worldview", "powerSystem", "characters"])
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const inFlight = useRef(false);

  const searchData: SearchData = useMemo(
    () =>
      project.search ?? {
        novelName: project.novelName,
        summary: project.bible?.synopsis ?? "",
        results: [],
      },
    [project.search, project.novelName, project.bible?.synopsis]
  );

  const parseBible = useCallback(
    (value: string): SettingBible | null => {
      const parsed = parseJsonLoose(value);
      return parsed ? normalizeBible(parsed, searchData.novelName) : null;
    },
    [searchData.novelName]
  );

  useEffect(() => {
    if (project.bible || inFlight.current) return;

    const generateBible = async () => {
      inFlight.current = true;
      setIsGenerating(true);
      setRawText("");
      setError("");

      try {
        const res = await fetch("/api/bible", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            withAiConfig({
              novelName: searchData.novelName,
              searchResults: searchData.results,
              searchSummary: searchData.summary,
            })
          ),
        });

        let accumulated = "";
        for await (const text of readSseText(res)) {
          accumulated += text;
          setRawText(accumulated);
        }

        const parsedBible = parseBible(accumulated);
        if (parsedBible) {
          onBibleComplete(parsedBible);
        } else if (!accumulated) {
          setError("AI 服务未返回内容，请检查服务配置后重试");
        } else {
          setError("AI 返回的设定圣经无法解析，请点击重试");
        }
      } catch (err) {
        console.error("Bible generation failed:", err);
        setError(errorMessage(err, "生成设定圣经失败，请检查 AI 服务配置后重试"));
      } finally {
        inFlight.current = false;
        setIsGenerating(false);
      }
    };

    void generateBible();
  }, [project.bible, attempt, parseBible, onBibleComplete, searchData]);

  const displayBible = project.bible ?? parseBible(rawText);
  const repairCount = project.repair?.appliedFixes.length ?? 0;

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const sectionIcons: Record<string, React.ReactNode> = {
    worldview: <Globe className="w-5 h-5" />,
    powerSystem: <Swords className="w-5 h-5" />,
    factions: <Users className="w-5 h-5" />,
    characters: <Users className="w-5 h-5" />,
    timeline: <Clock className="w-5 h-5" />,
    mysteries: <HelpCircle className="w-5 h-5" />,
  };

  const sectionTitles: Record<string, string> = {
    worldview: "世界观",
    powerSystem: "力量体系",
    factions: "势力阵营",
    characters: "核心人物",
    timeline: "时间线",
    mysteries: "未解之谜",
  };

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Toolbar */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
          <span
            className={
              saveState === "error" ? "text-crimson" : "text-muted-foreground"
            }
          >
            {SAVE_LABELS[saveState]}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onExport}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 transition-colors hover:border-amber/40 hover:text-parchment"
            >
              <Download className="w-3.5 h-3.5" />
              导出 JSON
            </button>
            <button
              type="button"
              onClick={onRestart}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 transition-colors hover:border-amber/40 hover:text-parchment"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              重新开始
            </button>
          </div>
        </div>

        {/* Header */}
        <div className="mb-8 animate-fade-in">
          <div className="flex items-center gap-3 mb-4">
            <BookOpen className="w-8 h-8 text-amber" />
            <h1 className="font-serif text-3xl font-bold text-parchment">
              设定圣经
            </h1>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="px-3 py-1 bg-secondary rounded-full border border-border">
              {searchData.novelName || project.novelName}
            </span>
            {displayBible && (
              <>
                <span>{displayBible.author}</span>
                <span className={`px-2 py-0.5 rounded ${displayBible.status === "完结" ? "bg-forest/20 text-forest" : "bg-amber/20 text-amber"}`}>
                  {displayBible.status}
                </span>
                <span>{displayBible.genre}</span>
              </>
            )}
          </div>
          {displayBible?.synopsis && (
            <p className="mt-4 text-muted-foreground leading-relaxed border-l-2 border-amber/30 pl-4">
              {displayBible.synopsis}
            </p>
          )}
          {repairCount > 0 && (
            <p className="mt-3 inline-flex items-center gap-2 rounded-lg border border-forest/30 bg-forest/10 px-3 py-1.5 text-xs text-forest">
              <CheckCircle2 className="w-4 h-4" />
              已按体检报告修补 {repairCount} 处设定
            </p>
          )}
        </div>

        {/* Loading state */}
        {isGenerating && !displayBible && (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-12 h-12 text-amber animate-spin mb-6" />
            <p className="text-parchment font-serif text-xl mb-2">
              正在解析小说设定...
            </p>
            <p className="text-muted-foreground text-sm">
              从搜索结果中提取世界观、人物、力量体系等结构化信息
            </p>
            {rawText && (
              <div
                ref={scrollRef}
                className="mt-8 max-w-2xl w-full bg-card border border-border rounded-xl p-4 max-h-64 overflow-y-auto"
              >
                <pre className="text-xs text-muted-foreground whitespace-pre-wrap break-words font-mono">
                  {rawText}
                </pre>
              </div>
            )}
          </div>
        )}

        {error && !displayBible && !isGenerating && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="mb-4 max-w-xl text-sm text-crimson">{error}</p>
            <div className="flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() => setAttempt((value) => value + 1)}
                className="rounded-lg border border-amber/30 px-5 py-2.5 text-sm text-parchment transition-colors hover:border-amber/60"
              >
                重试生成
              </button>
              <Link
                href="/settings/"
                className="rounded-lg border border-border px-5 py-2.5 text-sm text-muted-foreground transition-colors hover:border-amber/30 hover:text-parchment"
              >
                前往 AI 设置
              </Link>
            </div>
          </div>
        )}

        {/* Bible Content */}
        {displayBible && (
          <div className="space-y-4 animate-fade-in">
            {/* Worldview */}
            <SectionCard
              icon={sectionIcons.worldview}
              title={sectionTitles.worldview}
              expanded={expandedSections.has("worldview")}
              onToggle={() => toggleSection("worldview")}
            >
              <div className="space-y-3">
                <InfoBlock label="世界概述" value={displayBible.worldview.summary} />
                <InfoBlock label="地理环境" value={displayBible.worldview.geography} />
                <InfoBlock label="历史背景" value={displayBible.worldview.history} />
                <InfoBlock label="运行规则" value={displayBible.worldview.rules} />
              </div>
            </SectionCard>

            {/* Power System */}
            <SectionCard
              icon={sectionIcons.powerSystem}
              title={sectionTitles.powerSystem}
              expanded={expandedSections.has("powerSystem")}
              onToggle={() => toggleSection("powerSystem")}
            >
              <div className="space-y-3">
                <InfoBlock label="体系名称" value={displayBible.powerSystem.name} />
                <InfoBlock label="体系说明" value={displayBible.powerSystem.description} />
                <InfoBlock label="限制条件" value={displayBible.powerSystem.limitations} />
                <div>
                  <p className="text-sm text-muted-foreground mb-2">等级体系</p>
                  <div className="flex flex-wrap gap-2">
                    {displayBible.powerSystem.levels.map((level, i) => (
                      <span
                        key={i}
                        className="px-3 py-1 bg-secondary border border-border rounded-full text-sm text-parchment"
                      >
                        {i + 1}. {level}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </SectionCard>

            {/* Factions */}
            <SectionCard
              icon={sectionIcons.factions}
              title={sectionTitles.factions}
              expanded={expandedSections.has("factions")}
              onToggle={() => toggleSection("factions")}
            >
              <div className="grid gap-3 md:grid-cols-2">
                {displayBible.factions.map((faction, i) => (
                  <div key={i} className="bg-secondary/50 border border-border rounded-lg p-4">
                    <h4 className="text-amber font-medium mb-2">{faction.name}</h4>
                    <p className="text-sm text-muted-foreground mb-2">{faction.description}</p>
                    <p className="text-xs text-sage">目标: {faction.goal}</p>
                    {faction.keyMembers.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        核心成员: {faction.keyMembers.join("、")}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </SectionCard>

            {/* Characters */}
            <SectionCard
              icon={sectionIcons.characters}
              title={sectionTitles.characters}
              expanded={expandedSections.has("characters")}
              onToggle={() => toggleSection("characters")}
            >
              <div className="grid gap-3 md:grid-cols-2">
                {displayBible.characters.map((char, i) => (
                  <div key={i} className="bg-secondary/50 border border-border rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="text-amber font-medium">{char.name}</h4>
                      <span className="text-xs px-2 py-0.5 bg-amber/10 text-amber rounded-full">
                        {char.role}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-1">{char.personality}</p>
                    <p className="text-xs text-sage">能力: {char.abilities}</p>
                    <p className="text-xs text-muted-foreground mt-1">关系: {char.relationships}</p>
                  </div>
                ))}
              </div>
            </SectionCard>

            {/* Timeline */}
            <SectionCard
              icon={sectionIcons.timeline}
              title={sectionTitles.timeline}
              expanded={expandedSections.has("timeline")}
              onToggle={() => toggleSection("timeline")}
            >
              <div className="relative pl-6 border-l-2 border-amber/30 space-y-4">
                {displayBible.timeline.map((item, i) => (
                  <div key={i} className="relative">
                    <div className="absolute -left-[25px] top-1 w-3 h-3 rounded-full bg-amber border-2 border-card" />
                    <h4 className="text-parchment font-medium text-sm">{item.event}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                  </div>
                ))}
              </div>
            </SectionCard>

            {/* Mysteries */}
            <SectionCard
              icon={sectionIcons.mysteries}
              title={sectionTitles.mysteries}
              expanded={expandedSections.has("mysteries")}
              onToggle={() => toggleSection("mysteries")}
            >
              <div className="space-y-3">
                {displayBible.mysteries.map((mystery, i) => (
                  <div key={i} className="bg-secondary/50 border border-border rounded-lg p-4">
                    <h4 className="text-crimson font-medium mb-2 flex items-center gap-2">
                      <HelpCircle className="w-4 h-4" />
                      {mystery.question}
                    </h4>
                    <p className="text-xs text-sage mb-1">线索: {mystery.clues}</p>
                    <p className="text-xs text-muted-foreground">猜测: {mystery.theories}</p>
                  </div>
                ))}
              </div>
            </SectionCard>

            {/* Action Button */}
            <div className="flex justify-center pt-6 pb-8">
              <button
                onClick={onStartCheck}
                className="group flex items-center gap-3 px-8 py-4 bg-card border border-amber/30 rounded-xl text-parchment hover:border-amber/60 hover:glow-amber transition-all"
              >
                <Shield className="w-5 h-5 text-amber" />
                <span className="font-serif text-lg">开始漏洞体检</span>
                <ArrowRight className="w-5 h-5 text-amber group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SectionCard({
  icon,
  title,
  expanded,
  onToggle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden transition-all">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-secondary/50 transition-colors"
      >
        <span className="text-amber">{icon}</span>
        <h3 className="font-serif text-lg text-parchment flex-1 text-left">{title}</h3>
        {expanded ? (
          <ChevronUp className="w-5 h-5 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-5 h-5 text-muted-foreground" />
        )}
      </button>
      {expanded && <div className="px-5 pb-5">{children}</div>}
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      <p className="text-sm text-parchment leading-relaxed">{value}</p>
    </div>
  );
}

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import {
  BookOpen, Globe, Swords, Users, Clock, HelpCircle,
  ChevronDown, ChevronUp, Loader2, Shield, ArrowRight,
} from "lucide-react";
import { withAiConfig } from "@/lib/ai/browser";
import { readSseText } from "@/lib/ai/sse";
import type { SearchData, SettingBible } from "@/app/page";

interface BibleDisplayProps {
  searchData: SearchData;
  bible: SettingBible | null;
  onBibleComplete: (bible: SettingBible) => void;
  onStartCheck: () => void;
}

export function BibleDisplay({
  searchData,
  bible,
  onBibleComplete,
  onStartCheck,
}: BibleDisplayProps) {
  const [isGenerating, setIsGenerating] = useState(!bible);
  const [rawText, setRawText] = useState("");
  const [error, setError] = useState("");
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["worldview", "powerSystem", "characters"])
  );
  const scrollRef = useRef<HTMLDivElement>(null);

  const parseBible = useCallback((text: string): SettingBible | null => {
    try {
      const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const json = JSON.parse(cleaned);
      return json as SettingBible;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (bible) return;

    const generateBible = async () => {
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
          setError("AI 返回的设定圣经无法解析，请点击返回重试");
        }
      } catch (err) {
        console.error("Bible generation failed:", err);
        const message = err instanceof Error ? err.message : "";
        setError(
          message && message !== "Failed to fetch"
            ? message
            : "生成设定圣经失败，请检查 AI 服务配置后重试"
        );
      } finally {
        setIsGenerating(false);
      }
    };

    generateBible();
  }, [bible, searchData, onBibleComplete, parseBible]);

  const displayBible = bible || parseBible(rawText);

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
    worldview: "\u4e16\u754c\u89c2",
    powerSystem: "\u529b\u91cf\u4f53\u7cfb",
    factions: "\u52bf\u529b\u9635\u8425",
    characters: "\u6838\u5fc3\u4eba\u7269",
    timeline: "\u65f6\u95f4\u7ebf",
    mysteries: "\u672a\u89e3\u4e4b\u8c1c",
  };

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8 animate-fade-in">
          <div className="flex items-center gap-3 mb-4">
            <BookOpen className="w-8 h-8 text-amber" />
            <h1 className="font-serif text-3xl font-bold text-parchment">
              {"\u8bbe\u5b9a\u5723\u7ecf"}
            </h1>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="px-3 py-1 bg-secondary rounded-full border border-border">
              {searchData.novelName}
            </span>
            {displayBible && (
              <>
                <span>{displayBible.author}</span>
                <span className={`px-2 py-0.5 rounded ${displayBible.status === "\u5b8c\u7ed3" ? "bg-forest/20 text-forest" : "bg-amber/20 text-amber"}`}>
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
        </div>

        {/* Loading state */}
        {isGenerating && !displayBible && (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-12 h-12 text-amber animate-spin mb-6" />
            <p className="text-parchment font-serif text-xl mb-2">
              {"\u6b63\u5728\u89e3\u6790\u5c0f\u8bf4\u8bbe\u5b9a..."}
            </p>
            <p className="text-muted-foreground text-sm">
              {"\u4ece\u641c\u7d22\u7ed3\u679c\u4e2d\u63d0\u53d6\u4e16\u754c\u89c2\u3001\u4eba\u7269\u3001\u529b\u91cf\u4f53\u7cfb\u7b49\u7ed3\u6784\u5316\u4fe1\u606f"}
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
            <Link
              href="/settings/"
              className="rounded-lg border border-amber/30 px-5 py-2.5 text-sm text-parchment transition-colors hover:border-amber/60"
            >
              前往 AI 设置
            </Link>
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
                <InfoBlock label={"\u4e16\u754c\u6982\u8ff0"} value={displayBible.worldview.summary} />
                <InfoBlock label={"\u5730\u7406\u73af\u5883"} value={displayBible.worldview.geography} />
                <InfoBlock label={"\u5386\u53f2\u80cc\u666f"} value={displayBible.worldview.history} />
                <InfoBlock label={"\u8fd0\u884c\u89c4\u5219"} value={displayBible.worldview.rules} />
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
                <InfoBlock label={"\u4f53\u7cfb\u540d\u79f0"} value={displayBible.powerSystem.name} />
                <InfoBlock label={"\u4f53\u7cfb\u8bf4\u660e"} value={displayBible.powerSystem.description} />
                <InfoBlock label={"\u9650\u5236\u6761\u4ef6"} value={displayBible.powerSystem.limitations} />
                <div>
                  <p className="text-sm text-muted-foreground mb-2">{"\u7b49\u7ea7\u4f53\u7cfb"}</p>
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
                    <p className="text-xs text-sage">{"\u76ee\u6807"}: {faction.goal}</p>
                    {faction.keyMembers.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {"\u6838\u5fc3\u6210\u5458"}: {faction.keyMembers.join("\u3001")}
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
                    <p className="text-xs text-sage">{"\u80fd\u529b"}: {char.abilities}</p>
                    <p className="text-xs text-muted-foreground mt-1">{"\u5173\u7cfb"}: {char.relationships}</p>
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
                    <p className="text-xs text-sage mb-1">{"\u7ebf\u7d22"}: {mystery.clues}</p>
                    <p className="text-xs text-muted-foreground">{"\u731c\u6d4b"}: {mystery.theories}</p>
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
                <span className="font-serif text-lg">{"\u5f00\u59cb\u6f0f\u6d1e\u4f53\u68c0"}</span>
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
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      <p className="text-sm text-parchment leading-relaxed">{value}</p>
    </div>
  );
}

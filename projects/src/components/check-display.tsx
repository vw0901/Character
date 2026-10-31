"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Shield, AlertTriangle, CheckCircle2, Loader2,
  Gamepad2, ArrowRight, Zap, Wrench, SkipForward, Download,
} from "lucide-react";
import { withAiConfig } from "@/lib/ai/browser";
import { readSseText } from "@/lib/ai/sse";
import {
  normalizeCheck,
  normalizeRepair,
  parseJsonLoose,
  type CheckResult,
  type ProjectDocument,
  type RepairResult,
  type SaveState,
} from "@/lib/project";

interface CheckDisplayProps {
  project: ProjectDocument;
  saveState: SaveState;
  onCheckComplete: (result: CheckResult) => void;
  onRepairComplete: (repair: RepairResult) => void;
  onStartGame: () => void;
  onExport: () => void;
}

const SAVE_LABELS: Record<SaveState, string> = {
  idle: "未保存",
  saving: "保存中…",
  saved: "已保存到本机",
  error: "保存失败",
};

export function CheckDisplay({
  project,
  saveState,
  onCheckComplete,
  onRepairComplete,
  onStartGame,
  onExport,
}: CheckDisplayProps) {
  const [isChecking, setIsChecking] = useState(!project.check);
  const [isRepairing, setIsRepairing] = useState(false);
  const [rawText, setRawText] = useState("");
  const [repairRaw, setRepairRaw] = useState("");
  const [error, setError] = useState("");
  const [repairError, setRepairError] = useState("");
  const [checkAttempt, setCheckAttempt] = useState(0);
  const [repairAttempt, setRepairAttempt] = useState(0);
  const [skipRepair, setSkipRepair] = useState(false);

  const checkInFlight = useRef(false);
  const repairInFlight = useRef(false);

  // 第一步：漏洞体检。
  useEffect(() => {
    if (project.check || !project.bible || checkInFlight.current) return;

    const runCheck = async () => {
      checkInFlight.current = true;
      setIsChecking(true);
      setRawText("");
      setError("");

      try {
        const res = await fetch("/api/check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(withAiConfig({ bible: project.bible })),
        });

        let accumulated = "";
        for await (const text of readSseText(res)) {
          accumulated += text;
          setRawText(accumulated);
        }

        const parsed = normalizeCheck(parseJsonLoose(accumulated));
        if (parsed) {
          onCheckComplete(parsed);
        } else if (!accumulated) {
          setError("AI 服务未返回内容，请检查服务配置后重试");
        } else {
          setError("AI 返回的体检报告无法解析，请重试");
        }
      } catch (err) {
        console.error("Check failed:", err);
        const message = err instanceof Error ? err.message : "";
        setError(
          message && message !== "Failed to fetch"
            ? message
            : "漏洞体检失败，请检查 AI 服务配置后重试"
        );
      } finally {
        checkInFlight.current = false;
        setIsChecking(false);
      }
    };

    void runCheck();
  }, [project.check, project.bible, checkAttempt, onCheckComplete]);

  // 第二步：把体检结果回填进设定圣经。
  useEffect(() => {
    if (!project.check || project.repair || skipRepair || repairInFlight.current) return;

    const runRepair = async () => {
      repairInFlight.current = true;
      setIsRepairing(true);
      setRepairRaw("");
      setRepairError("");

      try {
        const res = await fetch("/api/repair", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            withAiConfig({ bible: project.bible, check: project.check })
          ),
        });

        let accumulated = "";
        for await (const text of readSseText(res)) {
          accumulated += text;
          setRepairRaw(accumulated);
        }

        const parsed = normalizeRepair(parseJsonLoose(accumulated));
        if (parsed) {
          onRepairComplete(parsed);
        } else if (!accumulated) {
          setRepairError("AI 服务未返回修补内容，可以跳过修补直接开始冒险");
        } else {
          setRepairError("修补结果无法解析，可以重试或跳过修补");
        }
      } catch (err) {
        console.error("Repair failed:", err);
        const message = err instanceof Error ? err.message : "";
        setRepairError(
          message && message !== "Failed to fetch"
            ? message
            : "修补设定失败，可以重试或跳过修补直接开始冒险"
        );
      } finally {
        repairInFlight.current = false;
        setIsRepairing(false);
      }
    };

    void runRepair();
  }, [
    project.check,
    project.bible,
    project.repair,
    repairAttempt,
    skipRepair,
    onRepairComplete,
  ]);

  const displayResult: CheckResult | null =
    project.check ?? normalizeCheck(parseJsonLoose(rawText));
  const repair = project.repair;

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "高":
        return "text-crimson bg-crimson/10 border-crimson/30";
      case "中":
        return "text-amber bg-amber/10 border-amber/30";
      case "低":
        return "text-sage bg-sage/10 border-sage/30";
      default:
        return "text-muted-foreground bg-secondary border-border";
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-forest";
    if (score >= 60) return "text-amber";
    return "text-crimson";
  };

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Toolbar */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
          <span className={saveState === "error" ? "text-crimson" : ""}>
            {SAVE_LABELS[saveState]}
          </span>
          <button
            type="button"
            onClick={onExport}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 transition-colors hover:border-amber/40 hover:text-parchment"
          >
            <Download className="w-3.5 h-3.5" />
            导出 JSON
          </button>
        </div>

        {/* Header */}
        <div className="mb-8 animate-fade-in">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="w-8 h-8 text-amber" />
            <h1 className="font-serif text-3xl font-bold text-parchment">
              漏洞体检报告
            </h1>
          </div>
          <p className="text-muted-foreground">
            对<span className="text-parchment">{project.bible?.novelName}</span>的设定圣经进行全面审计
          </p>
        </div>

        {/* Loading */}
        {isChecking && !displayResult && (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-12 h-12 text-amber animate-spin mb-6" />
            <p className="text-parchment font-serif text-xl mb-2">
              正在进行漏洞体检...
            </p>
            <p className="text-muted-foreground text-sm">
              审查世界观一致性、力量平衡、人物逻辑、时间线合理性
            </p>
            {rawText && (
              <div className="mt-8 max-w-2xl w-full bg-card border border-border rounded-xl p-4 max-h-64 overflow-y-auto">
                <pre className="text-xs text-muted-foreground whitespace-pre-wrap break-words font-mono">
                  {rawText}
                </pre>
              </div>
            )}
          </div>
        )}

        {error && !displayResult && !isChecking && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="mb-4 max-w-xl text-sm text-crimson">{error}</p>
            <div className="flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() => setCheckAttempt((value) => value + 1)}
                className="rounded-lg border border-amber/30 px-5 py-2.5 text-sm text-parchment transition-colors hover:border-amber/60"
              >
                重试体检
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

        {/* Results */}
        {displayResult && (
          <div className="space-y-6 animate-fade-in">
            {/* Score Card */}
            <div className="bg-card border border-border rounded-xl p-6 glow-amber">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">设定健康度</p>
                  <div className="flex items-baseline gap-2">
                    <span className={`font-serif text-5xl font-bold ${getScoreColor(displayResult.overallScore)}`}>
                      {displayResult.overallScore}
                    </span>
                    <span className="text-muted-foreground text-lg">/100</span>
                  </div>
                </div>
                <div className="w-20 h-20 relative">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                    <circle
                      cx="50" cy="50" r="40"
                      fill="none" stroke="var(--border)" strokeWidth="8"
                    />
                    <circle
                      cx="50" cy="50" r="40"
                      fill="none"
                      stroke={displayResult.overallScore >= 80 ? "var(--forest)" : displayResult.overallScore >= 60 ? "var(--amber)" : "var(--crimson)"}
                      strokeWidth="8"
                      strokeDasharray={`${displayResult.overallScore * 2.51} 251`}
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
              </div>
              <p className="text-parchment leading-relaxed">{displayResult.summary}</p>
            </div>

            {/* Strengths */}
            {displayResult.strengths.length > 0 && (
              <div className="bg-card border border-border rounded-xl p-5">
                <h3 className="font-serif text-lg text-forest flex items-center gap-2 mb-3">
                  <CheckCircle2 className="w-5 h-5" />
                  设定亮点
                </h3>
                <div className="flex flex-wrap gap-2">
                  {displayResult.strengths.map((s, i) => (
                    <span key={i} className="px-3 py-1.5 bg-forest/10 border border-forest/20 rounded-lg text-sm text-parchment">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Issues */}
            <div className="space-y-3">
              <h3 className="font-serif text-lg text-crimson flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                发现的漏洞 ({displayResult.issues.length})
              </h3>
              {displayResult.issues.map((issue, i) => (
                <div
                  key={i}
                  className="bg-card border border-border rounded-xl p-5 hover:border-border/80 transition-colors"
                >
                  <div className="flex items-start gap-3 mb-3">
                    <span className={`px-2 py-0.5 text-xs rounded border ${getSeverityColor(issue.severity)}`}>
                      {issue.severity || "未分级"}
                    </span>
                    <span className="text-xs text-muted-foreground px-2 py-0.5 bg-secondary rounded">
                      {issue.category}
                    </span>
                    <h4 className="text-parchment font-medium flex-1">{issue.title}</h4>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
                    {issue.description}
                  </p>
                  <div className="flex items-start gap-2 p-3 bg-forest/5 border border-forest/20 rounded-lg">
                    <Zap className="w-4 h-4 text-forest mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-forest mb-0.5">修补方案</p>
                      <p className="text-sm text-parchment">{issue.fix}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Repair status */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="font-serif text-lg text-parchment flex items-center gap-2 mb-3">
                <Wrench className="w-5 h-5 text-amber" />
                设定修补
              </h3>

              {isRepairing && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin text-amber" />
                    正在按修补方案补全设定，后续冒险会使用修补后的版本…
                  </div>
                  {repairRaw && (
                    <pre className="max-h-40 overflow-y-auto rounded-lg border border-border bg-secondary/30 p-3 text-xs text-muted-foreground whitespace-pre-wrap break-words font-mono">
                      {repairRaw}
                    </pre>
                  )}
                </div>
              )}

              {repair && (
                <div className="space-y-3">
                  <p className="flex items-center gap-2 text-sm text-forest">
                    <CheckCircle2 className="w-4 h-4" />
                    已修补 {repair.appliedFixes.length} 处，冒险将使用补全后的设定
                  </p>
                  {repair.summary && (
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {repair.summary}
                    </p>
                  )}
                  <ul className="space-y-2">
                    {repair.appliedFixes.map((fix, i) => (
                      <li key={i} className="rounded-lg border border-forest/20 bg-forest/5 p-3">
                        <p className="text-sm text-parchment">{fix.issue}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{fix.action}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {repairError && !isRepairing && (
                <div className="space-y-3">
                  <p className="text-sm text-crimson">{repairError}</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setRepairAttempt((value) => value + 1)}
                      className="rounded-lg border border-amber/30 px-4 py-2 text-xs text-parchment transition-colors hover:border-amber/60"
                    >
                      重试修补
                    </button>
                    <button
                      type="button"
                      onClick={() => setSkipRepair(true)}
                      className="rounded-lg border border-border px-4 py-2 text-xs text-muted-foreground transition-colors hover:border-amber/30 hover:text-parchment"
                    >
                      跳过修补
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Action Button */}
            <div className="flex flex-col items-center gap-3 pt-6 pb-8">
              <button
                onClick={onStartGame}
                className="group flex items-center gap-3 px-8 py-4 bg-card border border-amber/30 rounded-xl text-parchment hover:border-amber/60 hover:glow-amber transition-all"
              >
                <Gamepad2 className="w-5 h-5 text-amber" />
                <span className="font-serif text-lg">
                  {repair ? "以修补后的设定开始冒险" : "开始文字冒险"}
                </span>
                <ArrowRight className="w-5 h-5 text-amber group-hover:translate-x-1 transition-transform" />
              </button>
              {!repair && !isRepairing && !repairError && (
                <button
                  type="button"
                  onClick={() => setSkipRepair(true)}
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-parchment"
                >
                  <SkipForward className="w-3.5 h-3.5" />
                  跳过修补，直接用原始设定
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

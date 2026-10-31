"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Shield, AlertTriangle, CheckCircle2, Loader2,
  Gamepad2, ArrowRight, Zap,
} from "lucide-react";
import { withAiConfig } from "@/lib/ai/browser";
import { readSseText } from "@/lib/ai/sse";
import type { SettingBible, CheckResult } from "@/app/page";

interface CheckDisplayProps {
  bible: SettingBible;
  checkResult: CheckResult | null;
  onCheckComplete: (result: CheckResult) => void;
  onStartGame: () => void;
}

export function CheckDisplay({
  bible,
  checkResult,
  onCheckComplete,
  onStartGame,
}: CheckDisplayProps) {
  const [isChecking, setIsChecking] = useState(!checkResult);
  const [rawText, setRawText] = useState("");
  const [error, setError] = useState("");

  const parseResult = useCallback((text: string): CheckResult | null => {
    try {
      const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const json = JSON.parse(cleaned);
      return json as CheckResult;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (checkResult) return;

    const runCheck = async () => {
      setIsChecking(true);
      setRawText("");
      setError("");

      try {
        const res = await fetch("/api/check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(withAiConfig({ bible })),
        });

        let accumulated = "";
        for await (const text of readSseText(res)) {
          accumulated += text;
          setRawText(accumulated);
        }

        const parsed = parseResult(accumulated);
        if (parsed) {
          onCheckComplete(parsed);
        } else if (!accumulated) {
          setError("AI 服务未返回内容，请检查服务配置后重试");
        } else {
          setError("AI 返回的体检报告无法解析，请点击返回重试");
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
        setIsChecking(false);
      }
    };

    runCheck();
  }, [bible, checkResult, onCheckComplete, parseResult]);

  const displayResult = checkResult || parseResult(rawText);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "\u9ad8":
        return "text-crimson bg-crimson/10 border-crimson/30";
      case "\u4e2d":
        return "text-amber bg-amber/10 border-amber/30";
      case "\u4f4e":
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
        {/* Header */}
        <div className="mb-8 animate-fade-in">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="w-8 h-8 text-amber" />
            <h1 className="font-serif text-3xl font-bold text-parchment">
              {"\u6f0f\u6d1e\u4f53\u68c0\u62a5\u544a"}
            </h1>
          </div>
          <p className="text-muted-foreground">
            {"\u5bf9"}<span className="text-parchment">{bible.novelName}</span>{"\u7684\u8bbe\u5b9a\u5723\u7ecf\u8fdb\u884c\u5168\u9762\u5ba1\u8ba1"}
          </p>
        </div>

        {/* Loading */}
        {isChecking && !displayResult && (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-12 h-12 text-amber animate-spin mb-6" />
            <p className="text-parchment font-serif text-xl mb-2">
              {"\u6b63\u5728\u8fdb\u884c\u6f0f\u6d1e\u4f53\u68c0..."}
            </p>
            <p className="text-muted-foreground text-sm">
              {"\u5ba1\u67e5\u4e16\u754c\u89c2\u4e00\u81f4\u6027\u3001\u529b\u91cf\u5e73\u8861\u3001\u4eba\u7269\u903b\u8f91\u3001\u65f6\u95f4\u7ebf\u5408\u7406\u6027"}
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
            <Link
              href="/settings/"
              className="rounded-lg border border-amber/30 px-5 py-2.5 text-sm text-parchment transition-colors hover:border-amber/60"
            >
              前往 AI 设置
            </Link>
          </div>
        )}

        {/* Results */}
        {displayResult && (
          <div className="space-y-6 animate-fade-in">
            {/* Score Card */}
            <div className="bg-card border border-border rounded-xl p-6 glow-amber">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">{"\u8bbe\u5b9a\u5065\u5eb7\u5ea6"}</p>
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
                  {"\u8bbe\u5b9a\u4eae\u70b9"}
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
                {"\u53d1\u73b0\u7684\u6f0f\u6d1e"} ({displayResult.issues.length})
              </h3>
              {displayResult.issues.map((issue, i) => (
                <div
                  key={i}
                  className="bg-card border border-border rounded-xl p-5 hover:border-border/80 transition-colors"
                >
                  <div className="flex items-start gap-3 mb-3">
                    <span className={`px-2 py-0.5 text-xs rounded border ${getSeverityColor(issue.severity)}`}>
                      {issue.severity}
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
                      <p className="text-xs text-forest mb-0.5">{"\u4fee\u8865\u65b9\u6848"}</p>
                      <p className="text-sm text-parchment">{issue.fix}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Action Button */}
            <div className="flex justify-center pt-6 pb-8">
              <button
                onClick={onStartGame}
                className="group flex items-center gap-3 px-8 py-4 bg-card border border-amber/30 rounded-xl text-parchment hover:border-amber/60 hover:glow-amber transition-all"
              >
                <Gamepad2 className="w-5 h-5 text-amber" />
                <span className="font-serif text-lg">{"\u5f00\u59cb\u6587\u5b57\u5192\u9669"}</span>
                <ArrowRight className="w-5 h-5 text-amber group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

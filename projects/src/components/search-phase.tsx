"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { BookOpen, Search, Loader2 } from "lucide-react";
import { withAiConfig } from "@/lib/ai/browser";
import type { SearchData } from "@/app/page";

interface SearchPhaseProps {
  onSearchComplete: (data: SearchData) => void;
}

export function SearchPhase({ onSearchComplete }: SearchPhaseProps) {
  const [novelName, setNovelName] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSearch = async () => {
    if (!novelName.trim()) return;
    setIsSearching(true);
    setError("");

    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(withAiConfig({ novelName: novelName.trim() })),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          data && typeof data.error === "string" ? data.error : "\u641c\u7d22\u5931\u8d25\uff0c\u8bf7\u91cd\u8bd5"
        );
      }
      if (!data) {
        throw new Error("\u641c\u7d22\u670d\u52a1\u8fd4\u56de\u5185\u5bb9\u65e0\u6548");
      }

      onSearchComplete({
        novelName: data.novelName,
        summary: data.summary,
        results: data.results,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "\u641c\u7d22\u5931\u8d25\uff0c\u8bf7\u91cd\u8bd5");
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
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
          {"\u5047\u5982\u662f\u4f60"}
        </h1>
        <p className="text-muted-foreground text-lg mb-12 max-w-md mx-auto">
          {"\u8f93\u5165\u4e00\u90e8\u5c0f\u8bf4\uff0c\u751f\u6210\u5b83\u7684\u8bbe\u5b9a\u5723\u7ecf\uff0c\u518d\u4ee5\u300c\u4f60\u300d\u4e3a\u4e3b\u89d2\u8d70\u8fdb\u6545\u4e8b"}
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
              placeholder={"\u8f93\u5165\u5c0f\u8bf4\u540d\uff0c\u5982\u300a\u6597\u7f57\u5927\u9646\u300b\u300a\u4e09\u4f53\u300b\u300a\u9b4f\u4e34\u7f8e\u5c0f\u8bf4\u300b..."}
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
                  {"\u68c0\u7d22\u4e2d"}
                </>
              ) : (
                "\u68c0\u7d22"
              )}
            </button>
          </div>

          {error && (
            <p className="mt-3 text-crimson text-sm">
              {error}{" "}
              <Link href="/settings/" className="underline underline-offset-2 hover:text-amber">
                打开 AI 设置
              </Link>
            </p>
          )}
        </div>

        {/* Hints */}
        <div className="mt-12 flex flex-wrap justify-center gap-3">
          {["\u6597\u7f57\u5927\u9646", "\u4e09\u4f53", "\u5c04\u96d5\u82f1\u96c4\u4f20", "\u9b4f\u4e34\u7f8e\u5c0f\u8bf4", "\u54c8\u5229\u6ce2\u7279"].map(
            (name) => (
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
            )
          )}
        </div>
      </div>
    </div>
  );
}

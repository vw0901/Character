"use client";

import { useMemo, useState } from "react";
import {
  BookOpen, ChevronRight, Download, RotateCcw, User, UserPlus, Wand2,
} from "lucide-react";
import {
  OUTCOME_LABELS,
  characterKey,
  type AdventureState,
  type CharacterChoice,
  type SettingBible,
} from "@/lib/project";

type BibleCharacter = SettingBible["characters"][number];

interface CharacterSelectProps {
  characters: BibleCharacter[];
  books: Record<string, AdventureState>;
  repairCount: number;
  onStart: (choice: CharacterChoice) => void;
  onOpenBook: (key: string) => void;
  onExport: () => void;
  onRestart: () => void;
}

function bookSummary(book: AdventureState): string {
  return `第 ${book.timeline.currentDay}/${book.timeline.totalDays} 天 · 生命 ${book.stats.health} · ${
    OUTCOME_LABELS[book.outcome]
  }`;
}

export function CharacterSelect({
  characters,
  books,
  repairCount,
  onStart,
  onOpenBook,
  onExport,
  onRestart,
}: CharacterSelectProps) {
  const [mode, setMode] = useState<"existing" | "custom">("existing");
  const [customName, setCustomName] = useState("");
  const [customBg, setCustomBg] = useState("");
  const [customAbilities, setCustomAbilities] = useState("");
  const [customPersonality, setCustomPersonality] = useState("");

  const coreKeys = useMemo(
    () =>
      new Set(
        characters.map((item) =>
          characterKey({ mode: "existing", name: item.name, background: "" })
        )
      ),
    [characters]
  );

  const shelfBooks = useMemo(
    () => Object.entries(books).filter(([key]) => !coreKeys.has(key)),
    [books, coreKeys]
  );

  const handleSelectCharacter = (selected: BibleCharacter) => {
    const roleText = selected.role ? `身份：${selected.role}` : "";
    const abilityText = selected.abilities ? `能力：${selected.abilities}` : "";
    const relationText = selected.relationships ? `关系：${selected.relationships}` : "";
    const personalityText = selected.personality ? `性格：${selected.personality}` : "";
    onStart({
      mode: "existing",
      name: selected.name,
      background:
        [roleText, abilityText, relationText, personalityText]
          .filter(Boolean)
          .join("；") || "故事中的关键人物",
      abilities: selected.abilities,
      personality: selected.personality,
    });
  };

  const handleCreateCustom = () => {
    if (!customName.trim()) return;
    onStart({
      mode: "custom",
      name: customName.trim(),
      background: customBg.trim() || "一位刚刚踏入小说世界的旅人",
      abilities: customAbilities.trim() || undefined,
      personality: customPersonality.trim() || undefined,
    });
  };

  return (
    <div className="min-h-screen py-6 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8 animate-fade-in">
          <div className="flex items-center gap-3">
            <Wand2 className="w-6 h-6 text-amber" />
            <h1 className="font-serif text-xl font-bold text-parchment">选择你的故事书</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onExport}
              className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground hover:text-parchment border border-border rounded-lg hover:border-amber/30 transition-all"
            >
              <Download className="w-4 h-4" />
              导出存档
            </button>
            <button
              onClick={onRestart}
              className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground hover:text-parchment border border-border rounded-lg hover:border-amber/30 transition-all"
            >
              <RotateCcw className="w-4 h-4" />
              重新开始
            </button>
          </div>
        </div>

        <p className="mb-6 text-xs text-muted-foreground">
          {repairCount > 0
            ? `本次冒险使用已修补 ${repairCount} 处漏洞后的设定。每个人物都有独立的故事书。`
            : "每个人物都有独立的故事书，切换角色不会丢失当前进度。"}
        </p>

        {/* Mode switcher */}
        <div className="flex gap-2 mb-8">
          <button
            onClick={() => setMode("existing")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg border transition-all text-sm ${
              mode === "existing"
                ? "bg-amber text-ink border-amber font-medium"
                : "bg-card text-muted-foreground border-border hover:border-amber/40"
            }`}
          >
            <User className="w-4 h-4" />
            扮演故事角色
          </button>
          <button
            onClick={() => setMode("custom")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg border transition-all text-sm ${
              mode === "custom"
                ? "bg-amber text-ink border-amber font-medium"
                : "bg-card text-muted-foreground border-border hover:border-amber/40"
            }`}
          >
            <UserPlus className="w-4 h-4" />
            自创角色
          </button>
        </div>

        {mode === "existing" ? (
          <>
            <p className="text-xs text-muted-foreground mb-3">
              从小说设定中挑选一位人物，以第一人称进入属于 TA 的故事
            </p>
            {characters.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                {characters.map((item, idx) => {
                  const key = characterKey({
                    mode: "existing",
                    name: item.name,
                    background: "",
                  });
                  const book = books[key];
                  return (
                    <button
                      key={idx}
                      onClick={() => handleSelectCharacter(item)}
                      className="text-left p-5 bg-card border border-border rounded-xl hover:border-amber/40 hover:bg-secondary/50 transition-all group"
                    >
                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                          <User className="w-5 h-5 text-amber" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-serif text-lg text-parchment group-hover:text-amber-light transition-colors">
                            {item.name}
                          </p>
                          <p className="text-xs text-amber">{item.role || "关键人物"}</p>
                        </div>
                      </div>
                      {item.abilities && (
                        <p className="text-xs text-muted-foreground mb-2">
                          能力：{item.abilities}
                        </p>
                      )}
                      {item.personality && (
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {item.personality}
                        </p>
                      )}

                      {book && (
                        <div className="mt-3 space-y-1 border-t border-border/60 pt-3">
                          <p className="line-clamp-1 text-xs text-amber">
                            最终目标：{book.goal.title}
                          </p>
                          <p className="text-[11px] text-muted-foreground">{bookSummary(book)}</p>
                        </div>
                      )}

                      <span className="inline-flex items-center gap-1 mt-3 text-xs text-amber opacity-0 group-hover:opacity-100 transition-opacity">
                        {book
                          ? book.outcome === "playing"
                            ? "继续这本故事书"
                            : "回看已完结的故事"
                          : "开始新的故事书"}
                        <ChevronRight className="w-3 h-3" />
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 bg-card border border-border rounded-xl text-center text-muted-foreground">
                设定圣经中暂未提取到人物，可直接自创角色进入故事。
              </div>
            )}
          </>
        ) : (
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <p className="text-xs text-muted-foreground">
              创造一位只属于你的角色。同名角色会继续已有的故事书。
            </p>
            <div>
              <label className="block text-sm text-parchment mb-1.5">
                角色名字 <span className="text-crimson">*</span>
              </label>
              <input
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="例如：云中客"
                className="w-full px-4 py-2.5 bg-secondary border border-border rounded-lg text-parchment placeholder:text-muted-foreground/50 focus:outline-none focus:border-amber/50"
              />
            </div>
            <div>
              <label className="block text-sm text-parchment mb-1.5">角色背景</label>
              <textarea
                value={customBg}
                onChange={(e) => setCustomBg(e.target.value)}
                placeholder="例如：一位从异世界误入此处的流浪旅人，对这个世界一无所知…"
                rows={3}
                className="w-full px-4 py-2.5 bg-secondary border border-border rounded-lg text-parchment placeholder:text-muted-foreground/50 focus:outline-none focus:border-amber/50 resize-none"
              />
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-parchment mb-1.5">能力 / 特长（可选）</label>
                <input
                  value={customAbilities}
                  onChange={(e) => setCustomAbilities(e.target.value)}
                  placeholder="例如：通晓古文字、剑术"
                  className="w-full px-4 py-2.5 bg-secondary border border-border rounded-lg text-parchment placeholder:text-muted-foreground/50 focus:outline-none focus:border-amber/50"
                />
              </div>
              <div>
                <label className="block text-sm text-parchment mb-1.5">性格（可选）</label>
                <input
                  value={customPersonality}
                  onChange={(e) => setCustomPersonality(e.target.value)}
                  placeholder="例如：谨慎、好奇"
                  className="w-full px-4 py-2.5 bg-secondary border border-border rounded-lg text-parchment placeholder:text-muted-foreground/50 focus:outline-none focus:border-amber/50"
                />
              </div>
            </div>
            <button
              onClick={handleCreateCustom}
              disabled={!customName.trim()}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-amber text-ink font-medium rounded-lg hover:bg-amber-light transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <UserPlus className="w-4 h-4" />
              打开 TA 的故事书
            </button>
          </div>
        )}

        {shelfBooks.length > 0 && (
          <div className="mt-10">
            <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
              <BookOpen className="h-4 w-4" />
              书架
              <span className="text-muted-foreground/60">自创角色与不在设定中的人物</span>
            </div>
            <div className="grid gap-2">
              {shelfBooks.map(([key, book]) => (
                <button
                  key={key}
                  onClick={() => onOpenBook(key)}
                  className="flex items-center gap-3 rounded-lg border border-border bg-card/60 px-4 py-2.5 text-left transition-all hover:border-amber/40 hover:bg-secondary/40"
                >
                  <BookOpen className="h-4 w-4 shrink-0 text-amber" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-parchment">
                      {book.character.name}
                    </span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {book.goal.title}
                    </span>
                  </span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {bookSummary(book)}
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

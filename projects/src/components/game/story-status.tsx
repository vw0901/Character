import { CalendarClock, Target } from "lucide-react";
import { daysRemaining, type AdventureOutcome, type StoryGoal, type StoryTimeline } from "@/lib/project";

interface StoryStatusProps {
  goal: StoryGoal;
  timeline: StoryTimeline;
  outcome: AdventureOutcome;
}

export function StoryStatus({ goal, timeline, outcome }: StoryStatusProps) {
  const playing = outcome === "playing";
  const remaining = daysRemaining(timeline);
  // 结局之后再显示「已超时」会和「达成最终目标」自相矛盾，这里只在进行中提示超时。
  const overdue = playing && timeline.currentDay > timeline.totalDays;
  const percent = Math.min(
    100,
    Math.max(0, Math.round((timeline.currentDay / Math.max(1, timeline.totalDays)) * 100))
  );
  const urgent = playing && remaining <= 3;

  return (
    <div className="mb-6 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-[220px] flex-1">
          <p className="mb-1 flex items-center gap-1.5 text-[11px] tracking-wide text-amber">
            <Target className="h-3.5 w-3.5" />
            最终目标
          </p>
          <p className="text-sm font-medium text-parchment">{goal.title}</p>
          {goal.description && (
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {goal.description}
            </p>
          )}
        </div>

        <div className="w-full sm:w-56">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <CalendarClock className="h-3.5 w-3.5" />
              {timeline.label}
            </span>
            <span className={urgent ? "text-crimson" : ""}>
              第 {timeline.currentDay} / {timeline.totalDays} 天
            </span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                urgent ? "bg-crimson" : "bg-amber"
              }`}
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className={`mt-1 text-[11px] ${urgent || overdue ? "text-crimson" : "text-muted-foreground"}`}>
            {!playing
              ? "本局已结束"
              : overdue
                ? `已超时 ${timeline.currentDay - timeline.totalDays} 天`
                : remaining > 0
                  ? `剩余 ${remaining} 天`
                  : "最后一天"}
          </p>
        </div>
      </div>
    </div>
  );
}

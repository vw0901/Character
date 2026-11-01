import type { ReactNode } from "react";
import { Heart, Star, Zap } from "lucide-react";
import type { StatValues } from "@/lib/project";

function StatBar({
  icon,
  value,
  color,
}: {
  icon: ReactNode;
  value: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2">
      {icon}
      <div className="w-16 h-2 bg-secondary rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all duration-500`}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground w-6 text-right">{value}</span>
    </div>
  );
}

export function StatsRow({ stats }: { stats: StatValues }) {
  return (
    <div className="flex items-center gap-4">
      <StatBar icon={<Heart className="w-4 h-4 text-crimson" />} value={stats.health} color="bg-crimson" />
      <StatBar icon={<Zap className="w-4 h-4 text-amber" />} value={stats.power} color="bg-amber" />
      <StatBar icon={<Star className="w-4 h-4 text-sage" />} value={stats.reputation} color="bg-sage" />
    </div>
  );
}

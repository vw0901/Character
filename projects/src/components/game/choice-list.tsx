import { ChevronRight } from "lucide-react";
import type { Scene } from "@/lib/project";

interface ChoiceListProps {
  scene: Scene;
  onChoice: (choiceId: string, choiceText: string) => void;
}

export function ChoiceList({ scene, onChoice }: ChoiceListProps) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground mb-2">当前位置: {scene.location}</p>
      {scene.choices.map((choice) => (
        <button
          key={choice.id}
          onClick={() => onChoice(choice.id, choice.text)}
          className="w-full text-left p-4 bg-card border border-border rounded-xl hover:border-amber/40 hover:bg-secondary/50 transition-all group"
        >
          <div className="flex items-center gap-3">
            <ChevronRight className="w-4 h-4 text-amber opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="flex-1">
              <p className="text-parchment group-hover:text-amber-light transition-colors">
                {choice.text}
              </p>
              {choice.hint && (
                <p className="text-xs text-muted-foreground mt-1">{choice.hint}</p>
              )}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

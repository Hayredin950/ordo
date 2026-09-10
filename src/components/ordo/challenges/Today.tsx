import { CheckCircle2, Circle, Clock, Check } from "lucide-react";
import { getCategoryMeta } from "./categoryColors";
import type { BlockWithDay } from "./types";
import type { ChallengeStatus } from "./types";

interface Props {
  todayBlocks: BlockWithDay[];
  status: ChallengeStatus;
  onToggleBlock?: (blockId: string) => void;
}

export function ChallengeToday({ todayBlocks, status, onToggleBlock }: Props) {
  const isFinal = status === "completed";
  const isUpcoming = status === "upcoming";
  const isCancelled = status === "cancelled";

  if (isUpcoming) {
    return (
      <div className="py-2.5 px-3 rounded-lg bg-surface border border-dashed border-border text-xs text-muted-foreground flex items-center justify-between">
        <span className="font-medium">Routine begins on official start date</span>
        <span className="text-[11px] font-semibold text-primary bg-primary/10 border border-primary/25 px-2 py-0.5 rounded">
          Preview Ready
        </span>
      </div>
    );
  }

  if (isFinal) {
    return (
      <div className="py-2.5 px-3 rounded-lg bg-muted/60 border border-border text-xs text-muted-foreground flex items-center justify-between">
        <span className="font-semibold flex items-center gap-1.5 text-foreground">
          <Check className="w-4 h-4 text-primary" aria-hidden="true" />
          All routine milestones archived
        </span>
        <span className="text-[11px] font-bold text-primary">Official Results</span>
      </div>
    );
  }

  if (isCancelled) {
    return (
      <div className="py-2 px-3 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive/80 italic">
        No active tasks scheduled (Challenge cancelled).
      </div>
    );
  }

  if (todayBlocks.length === 0) {
    return (
      <div className="py-2.5 px-3 rounded-lg bg-muted/40 border border-border text-xs text-muted-foreground flex items-center justify-between">
        <span className="font-medium">No routine blocks scheduled for today.</span>
        <span className="text-[11px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded border border-border">
          Rest & Recovery
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
        <span className="uppercase tracking-wider text-[10px] text-muted-foreground">
          Today's Routine Block
        </span>
        <span className="text-[11px] text-muted-foreground font-normal">
          {todayBlocks.length} scheduled
        </span>
      </div>

      <div className="space-y-1.5">
        {todayBlocks.map((block) => {
          const catMeta = getCategoryMeta(block.category);
          return (
            <div
              key={block.id}
              onClick={(e) => {
                e.stopPropagation();
                onToggleBlock?.(block.id);
              }}
              className="flex items-center justify-between p-2 rounded-lg border transition-all cursor-pointer bg-surface border-border hover:border-primary/40 text-foreground"
            >
              <div className="flex items-center gap-2 min-w-0 pr-2">
                <button
                  type="button"
                  aria-label={`Toggle ${block.title}`}
                  className="shrink-0 text-muted-foreground hover:text-primary transition-colors"
                >
                  <Circle
                    className="w-4 h-4 text-muted-foreground hover:text-primary"
                    aria-hidden="true"
                  />
                </button>
                <div className="min-w-0">
                  <p className="text-xs font-semibold truncate text-foreground">{block.title}</p>
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-0.5">
                    <span className="flex items-center gap-1 font-mono">
                      <Clock className="w-2.5 h-2.5" aria-hidden="true" />
                      {block.start} - {block.end}
                    </span>
                    <span>•</span>
                    <span className={catMeta.textClass}>{block.category}</span>
                  </div>
                </div>
              </div>

              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 bg-muted text-muted-foreground border border-border">
                Pending
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

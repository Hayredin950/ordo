import { Users, Trophy, Zap } from "lucide-react";
import type { ChallengeStatus } from "./types";

interface Props {
  rank: number | null;
  memberCount: number;
  consistency: number | null;
  status: ChallengeStatus;
}

export function ChallengeStats({ rank, memberCount, consistency, status }: Props) {
  const isFinal = status === "completed";
  const hasConsistency = consistency !== null && consistency !== undefined;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 py-2 border-y border-border bg-surface/60 rounded-lg px-2 text-foreground">
      <div className="flex flex-col">
        <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider flex items-center gap-1">
          <Trophy className="w-3 h-3 text-primary shrink-0" aria-hidden="true" />
          {isFinal ? "Final Rank" : "Current Rank"}
        </span>
        <span className="text-sm font-bold text-foreground font-mono mt-0.5">
          {rank !== null ? `#${rank}` : "--"}
          <span className="text-[11px] font-normal text-muted-foreground">
            {" "}
            / {memberCount || 1}
          </span>
        </span>
      </div>

      <div className="flex flex-col border-l border-border pl-2">
        <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider flex items-center gap-1">
          <Users className="w-3 h-3 text-muted-foreground shrink-0" aria-hidden="true" />
          Members
        </span>
        <span className="text-sm font-bold text-foreground font-mono mt-0.5">{memberCount}</span>
      </div>

      {hasConsistency && (
        <div className="flex flex-col border-l border-border pl-2 col-span-2 sm:col-span-1">
          <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider flex items-center gap-1">
            <Zap className="w-3 h-3 text-primary shrink-0" aria-hidden="true" />
            Consistency
          </span>
          <span className="text-sm font-bold text-foreground font-mono mt-0.5">{consistency}%</span>
        </div>
      )}
    </div>
  );
}

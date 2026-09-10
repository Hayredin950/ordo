import { Award, Clock, AlertCircle } from "lucide-react";
import type { ChallengeStatus } from "./types";

interface Props {
  score: number | null;
  status: ChallengeStatus;
  startAt: string;
}

export function ChallengeScore({ score, status, startAt }: Props) {
  const isFinal = status === "completed";
  const isUpcoming = status === "upcoming";
  const isCancelled = status === "cancelled";

  if (isUpcoming) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(startAt);
    start.setHours(0, 0, 0, 0);
    const diffDays = Math.max(1, Math.ceil((start.getTime() - today.getTime()) / 86400000));

    return (
      <div className="py-2.5 px-3.5 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-between">
        <div>
          <div className="text-[11px] font-semibold text-primary/90 tracking-wide uppercase">
            Challenge Starts Soon
          </div>
          <div className="text-xl font-extrabold text-primary font-mono">
            {diffDays} {diffDays === 1 ? "day" : "days"} away
          </div>
        </div>
        <div className="w-9 h-9 rounded-lg bg-primary/20 text-primary flex items-center justify-center shrink-0">
          <Clock className="w-5 h-5" aria-hidden="true" />
        </div>
      </div>
    );
  }

  if (isCancelled) {
    return (
      <div className="py-2.5 px-3.5 rounded-xl bg-destructive/10 border border-destructive/20 flex items-center justify-between">
        <div>
          <div className="text-[11px] font-semibold text-destructive uppercase tracking-wide">
            Challenge Concluded
          </div>
          <div className="text-xs font-medium text-destructive/80 mt-0.5">
            Event cancelled by organizer
          </div>
        </div>
        <AlertCircle className="w-5 h-5 text-destructive shrink-0" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className="py-2.5 px-3.5 rounded-xl bg-surface/90 border border-border flex items-baseline justify-between">
      <div>
        <div className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
          {isFinal ? "Final Score" : "Current Score"}
        </div>
        <div className="flex items-baseline gap-1.5 mt-0.5">
          <span className="text-3xl font-extrabold text-foreground tracking-tight font-mono">
            {score !== null ? score.toFixed(1) : "--"}
          </span>
          <span className="text-xs font-semibold text-muted-foreground">/ 100</span>
        </div>
      </div>

      <div className="flex items-center gap-1.5 text-xs font-semibold text-primary bg-primary/10 border border-primary/25 px-2 py-1 rounded-md">
        <Award className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
        <span>
          {score && score >= 90 ? "Top Tier" : score && score >= 80 ? "On Track" : "In Progress"}
        </span>
      </div>
    </div>
  );
}

import type { ChallengeStatus } from "./types";

interface Props {
  currentDay: number;
  totalDays: number;
  status: ChallengeStatus;
}

export function ChallengeProgress({ currentDay, totalDays, status }: Props) {
  const isFinal = status === "completed";
  const isUpcoming = status === "upcoming";
  const isCancelled = status === "cancelled";

  const percentage = isFinal
    ? 100
    : isUpcoming || totalDays === 0
      ? 0
      : Math.min(100, Math.round((currentDay / totalDays) * 100));

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs font-semibold">
        <span className="text-muted-foreground">Timeline Progress</span>
        <span className="text-foreground font-mono">
          {isUpcoming
            ? `Day 0 / ${totalDays}`
            : isFinal
              ? `Completed (${totalDays}/${totalDays} days)`
              : isCancelled
                ? `Stopped on Day ${currentDay}/${totalDays}`
                : `Day ${currentDay} of ${totalDays} (${percentage}%)`}
        </span>
      </div>

      <div className="w-full h-2 rounded-full bg-muted overflow-hidden p-0.5 border border-border">
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${
            isCancelled ? "bg-destructive" : "bg-primary"
          }`}
          style={{ width: `${percentage}%` }}
          role="progressbar"
          aria-valuenow={percentage}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
    </div>
  );
}

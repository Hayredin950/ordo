import { Trophy, ArrowRight, UserPlus, Edit3, Lock } from "lucide-react";
import type { ChallengeStatus } from "./types";

interface Props {
  id: string;
  status: ChallengeStatus;
  routineLocked: boolean;
  isCreator: boolean;
  joined: boolean;
  hasIncompleteToday: boolean;
  onPrimaryAction: () => void;
  onSecondaryAction?: (() => void) | undefined;
  onEditRoutine?: (() => void) | undefined;
}

export function ChallengeActions({
  id,
  status,
  routineLocked,
  isCreator,
  joined,
  hasIncompleteToday,
  onPrimaryAction,
  onSecondaryAction,
  onEditRoutine,
}: Props) {
  const isUpcoming = status === "upcoming";
  const isFinal = status === "completed";
  const isCancelled = status === "cancelled";

  let primaryLabel = "View Details";
  let primaryIcon = <ArrowRight className="w-4 h-4" aria-hidden="true" />;

  if (isCancelled) {
    primaryLabel = "View Summary";
  } else if (isFinal) {
    primaryLabel = "View Final Standings";
    primaryIcon = <Trophy className="w-4 h-4 text-primary-foreground" aria-hidden="true" />;
  } else if (isUpcoming) {
    if (isCreator && !routineLocked) {
      primaryLabel = "Edit Schedule";
      primaryIcon = <Edit3 className="w-4 h-4 text-primary-foreground" aria-hidden="true" />;
    } else if (!joined) {
      primaryLabel = "Join Challenge";
      primaryIcon = <UserPlus className="w-4 h-4 text-primary-foreground" aria-hidden="true" />;
    } else {
      primaryLabel = "View Countdown";
    }
  } else if (status === "active") {
    if (hasIncompleteToday) {
      primaryLabel = "Check In Today";
    } else {
      primaryLabel = "Log Routine Progress";
    }
  }

  return (
    <div className="flex items-center gap-2 pt-1">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (isUpcoming && isCreator && !routineLocked && onEditRoutine) {
            onEditRoutine();
          } else {
            onPrimaryAction();
          }
        }}
        className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-primary-foreground font-bold text-xs tracking-wide shadow-xs transition-colors flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
      >
        <span>{primaryLabel}</span>
        {primaryIcon}
      </button>

      {isCreator && routineLocked ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEditRoutine?.();
          }}
          title="Routine is locked because members have already joined"
          className="min-h-[44px] px-3.5 py-2 rounded-xl bg-muted hover:bg-muted/80 text-muted-foreground border border-border font-semibold text-xs transition-colors flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-border"
        >
          <Lock className="w-3.5 h-3.5 text-muted-foreground" aria-hidden="true" />
          <span>Locked</span>
        </button>
      ) : isCreator && !routineLocked ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEditRoutine?.();
          }}
          className="min-h-[44px] px-3.5 py-2 rounded-xl bg-primary/15 hover:bg-primary/25 text-primary border border-primary/30 font-semibold text-xs transition-colors flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          <Edit3 className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
          <span>Edit Routine</span>
        </button>
      ) : onSecondaryAction ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSecondaryAction();
          }}
          className="min-h-[44px] px-3.5 py-2 rounded-xl bg-surface-elevated hover:bg-surface-hover text-foreground border border-border font-semibold text-xs transition-colors flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          <Trophy className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
          <span>Leaderboard</span>
        </button>
      ) : null}
    </div>
  );
}

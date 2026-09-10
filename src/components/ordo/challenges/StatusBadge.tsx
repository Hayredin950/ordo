import { Trophy } from "lucide-react";
import type { ChallengeStatus } from "./types";

interface Props {
  status: ChallengeStatus;
  className?: string;
}

export function ChallengeStatusBadge({ status, className = "" }: Props) {
  switch (status) {
    case "upcoming":
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold tracking-wide bg-muted text-muted-foreground border border-border ${className}`}
        >
          <span
            className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-pulse"
            aria-hidden="true"
          />
          <span>UPCOMING</span>
        </span>
      );
    case "active":
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold tracking-wide bg-primary/10 text-primary border border-primary/25 ${className}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-primary" aria-hidden="true" />
          <span>ACTIVE</span>
        </span>
      );
    case "completed":
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold tracking-wide bg-muted text-muted-foreground border border-border ${className}`}
        >
          <span>COMPLETED</span>
        </span>
      );
    case "cancelled":
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold tracking-wide bg-destructive/10 text-destructive border border-destructive/25 ${className}`}
        >
          <span>CANCELLED</span>
        </span>
      );
    default:
      return null;
  }
}

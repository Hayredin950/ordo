import React from 'react';
import { ChallengeStatus } from '../../types';
import { Trophy } from 'lucide-react';

interface ChallengeStatusBadgeProps {
  status: ChallengeStatus;
  className?: string;
}

export const ChallengeStatusBadge: React.FC<ChallengeStatusBadgeProps> = ({ status, className = '' }) => {
  switch (status) {
    case 'UPCOMING':
      return (
        <span
          id={`badge-upcoming`}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold tracking-wide bg-muted text-muted-foreground border border-border ${className}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-pulse" aria-hidden="true" />
          <span>● UPCOMING</span>
        </span>
      );

    case 'ACTIVE':
      return (
        <span
          id={`badge-active`}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold tracking-wide bg-primary/10 text-primary border border-primary/25 ${className}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-primary" aria-hidden="true" />
          <span>● ACTIVE</span>
        </span>
      );

    case 'COMPLETED':
      return (
        <span
          id={`badge-completed`}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold tracking-wide bg-muted text-muted-foreground border border-border ${className}`}
        >
          <span>✓ COMPLETED</span>
        </span>
      );

    case 'FINALIZED':
      return (
        <span
          id={`badge-finalized`}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold tracking-wide bg-muted text-muted-foreground border border-border ${className}`}
        >
          <Trophy className="w-3.5 h-3.5 text-primary shrink-0" aria-hidden="true" />
          <span>FINALIZED</span>
        </span>
      );

    case 'CANCELLED':
      return (
        <span
          id={`badge-cancelled`}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold tracking-wide bg-destructive/10 text-destructive border border-destructive/25 ${className}`}
        >
          <span>× CANCELLED</span>
        </span>
      );

    default:
      return null;
  }
};


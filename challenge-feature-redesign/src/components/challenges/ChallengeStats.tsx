import React from 'react';
import { ChallengeStatus } from '../../types';
import { Users, Trophy, Zap } from 'lucide-react';

interface ChallengeStatsProps {
  rank: number | null;
  memberCount: number;
  consistency: number | null;
  status: ChallengeStatus;
}

export const ChallengeStats: React.FC<ChallengeStatsProps> = ({
  rank,
  memberCount,
  consistency,
  status,
}) => {
  const isFinal = status === 'COMPLETED' || status === 'FINALIZED';
  const hasConsistency = consistency !== null && consistency !== undefined;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 py-2 border-y border-border bg-surface/60 rounded-lg px-2 text-foreground">
      {/* Stat 1: Rank */}
      <div className="flex flex-col">
        <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider flex items-center gap-1">
          <Trophy className="w-3 h-3 text-primary shrink-0" aria-hidden="true" />
          {isFinal ? 'Final Rank' : 'Current Rank'}
        </span>
        <span className="text-sm font-bold text-foreground font-['JetBrains_Mono',monospace] mt-0.5">
          {rank !== null ? `#${rank}` : '--'}
          <span className="text-[11px] font-normal text-muted-foreground"> / {memberCount || 1}</span>
        </span>
      </div>

      {/* Stat 2: Members */}
      <div className="flex flex-col border-l border-border pl-2">
        <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider flex items-center gap-1">
          <Users className="w-3 h-3 text-muted-foreground shrink-0" aria-hidden="true" />
          Members
        </span>
        <span className="text-sm font-bold text-foreground font-['JetBrains_Mono',monospace] mt-0.5">
          {memberCount}
        </span>
      </div>

      {/* Stat 3: Consistency */}
      {hasConsistency && (
        <div className="flex flex-col border-l border-border pl-2 col-span-2 sm:col-span-1">
          <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider flex items-center gap-1">
            <Zap className="w-3 h-3 text-primary shrink-0" aria-hidden="true" />
            Consistency
          </span>
          <span className="text-sm font-bold text-foreground font-['JetBrains_Mono',monospace] mt-0.5">
            {consistency}%
          </span>
        </div>
      )}
    </div>
  );
};


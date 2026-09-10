import React from 'react';
import { ChallengeCardModel } from '../../types';
import { ChallengeCardHeader } from './ChallengeCardHeader';
import { ChallengeScore } from './ChallengeScore';
import { ChallengeProgress } from './ChallengeProgress';
import { ChallengeStats } from './ChallengeStats';
import { ChallengeToday } from './ChallengeToday';
import { ChallengeActions } from './ChallengeActions';
import { ChallengeRoutinePreview } from './ChallengeRoutinePreview';
import { Lock, Info, AlertTriangle, RefreshCw } from 'lucide-react';

interface ChallengeCardProps {
  challenge?: ChallengeCardModel;
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string;
  onRetry?: () => void;
  onSelect?: (challenge: ChallengeCardModel) => void;
  onToggleTodayBlock?: (challengeId: string, blockId: string) => void;
  onOpenLeaderboard?: (challenge: ChallengeCardModel) => void;
  onEditRoutine?: (challenge: ChallengeCardModel) => void;
}

export const ChallengeCard: React.FC<ChallengeCardProps> = ({
  challenge,
  isLoading = false,
  isError = false,
  errorMessage,
  onRetry,
  onSelect,
  onToggleTodayBlock,
  onOpenLeaderboard,
  onEditRoutine,
}) => {
  // 1. Loading Skeleton State
  if (isLoading) {
    return (
      <div 
        className="w-full bg-card rounded-2xl border border-border p-5 shadow-xs flex flex-col gap-4 animate-pulse"
        aria-busy="true"
        aria-label="Loading challenge details"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-muted" />
            <div className="space-y-1.5">
              <div className="w-20 h-3 rounded bg-muted" />
              <div className="w-40 h-4 rounded bg-muted/80" />
            </div>
          </div>
          <div className="w-20 h-5 rounded-full bg-muted" />
        </div>

        <div className="h-14 rounded-xl bg-muted/60" />
        <div className="space-y-2">
          <div className="w-full h-3 rounded bg-muted/60" />
          <div className="w-full h-2 rounded bg-muted" />
        </div>
        <div className="h-12 rounded-lg bg-muted/60" />
        <div className="h-16 rounded-lg bg-muted/60" />
        <div className="h-11 rounded-xl bg-muted" />
      </div>
    );
  }

  // 2. Error State with Human-Readable Translation
  if (isError || !challenge) {
    return (
      <div 
        className="w-full bg-card rounded-2xl border border-destructive/40 p-5 shadow-xs flex flex-col justify-between gap-4"
        role="alert"
      >
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center shrink-0 border border-destructive/20">
            <AlertTriangle className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-foreground">Failed to load challenge</h4>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              {errorMessage || 'Unable to sync live challenge progress with server. Please retry.'}
            </p>
          </div>
        </div>

        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="w-full min-h-[44px] px-4 py-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground text-xs font-semibold flex items-center justify-center gap-2 transition-colors border border-border"
          >
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Try Again</span>
          </button>
        )}
      </div>
    );
  }

  const {
    id,
    name,
    category,
    status,
    startAt,
    score,
    rank,
    memberCount,
    consistency,
    currentDay,
    totalDays,
    routineLocked,
    isCreator,
    joined,
    todayBlocks,
    allWeeklyRoutine,
  } = challenge;

  const isUpcoming = status === 'UPCOMING';
  const isFinal = status === 'COMPLETED' || status === 'FINALIZED';
  const hasIncompleteToday = todayBlocks.some((b) => !b.completed);

  return (
    <div
      id={`challenge-card-${id}`}
      onClick={() => onSelect?.(challenge)}
      className="group w-full bg-card rounded-2xl border border-border hover:border-primary/50 p-5 shadow-xs hover:shadow-lg transition-all duration-200 cursor-pointer flex flex-col gap-4 relative overflow-hidden"
    >
      {/* Header: Icon, Name, Category/Duration, Status badge */}
      <ChallengeCardHeader
        id={id}
        name={name}
        category={category}
        totalDays={totalDays}
        status={status}
        routineLocked={routineLocked}
        isCreator={isCreator}
      />

      {/* Creator Context Banner (pre-first-join vs locked) */}
      {isCreator && !routineLocked && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/10 border border-primary/25 text-primary text-xs">
          <Info className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
          <span className="leading-tight">
            <strong>Routine editable</strong> — locks automatically once the first participant joins.
          </span>
        </div>
      )}

      {isCreator && routineLocked && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-muted/60 border border-border text-muted-foreground text-[11px]">
          <Lock className="w-3.5 h-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
          <span>Routine is frozen to ensure fair scoring across all participants.</span>
        </div>
      )}

      {/* Primary Metric: Score */}
      <ChallengeScore score={score} status={status} startAt={startAt} />

      {/* Timeline Progress (Separate from score!) */}
      <ChallengeProgress
        currentDay={currentDay}
        totalDays={totalDays}
        status={status}
      />

      {/* Quick Stats Row: Rank | Members | Consistency (3 max) */}
      <ChallengeStats
        rank={rank}
        memberCount={memberCount}
        consistency={consistency}
        status={status}
      />

      {/* Specific State Content: Today's Task or Routine Preview */}
      {isUpcoming ? (
        <div className="space-y-1.5">
          <ChallengeRoutinePreview routine={allWeeklyRoutine} compact={true} />
        </div>
      ) : (
        <ChallengeToday
          todayBlocks={todayBlocks}
          status={status}
          onToggleBlock={(blockId) => onToggleTodayBlock?.(id, blockId)}
        />
      )}

      {/* Actions: Primary CTA + Secondary CTA */}
      <ChallengeActions
        id={id}
        status={status}
        routineLocked={routineLocked}
        isCreator={isCreator}
        joined={joined}
        hasIncompleteToday={hasIncompleteToday}
        onPrimaryAction={() => onSelect?.(challenge)}
        onSecondaryAction={memberCount > 0 ? () => onOpenLeaderboard?.(challenge) : undefined}
        onEditRoutine={() => onEditRoutine?.(challenge)}
      />
    </div>
  );
};

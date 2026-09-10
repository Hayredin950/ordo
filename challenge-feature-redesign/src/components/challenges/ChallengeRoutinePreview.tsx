import React from 'react';
import { ChallengeRoutineBlock } from '../../types';
import { getCategoryMeta } from '../../categoryColors';

interface ChallengeRoutinePreviewProps {
  routine: ChallengeRoutineBlock[];
  compact?: boolean;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const ChallengeRoutinePreview: React.FC<ChallengeRoutinePreviewProps> = ({
  routine,
  compact = true,
}) => {
  const activeDays = new Set(routine.map((b) => b.dayOfWeek));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
        <span className="uppercase tracking-wider text-[10px] text-muted-foreground">Weekly Schedule</span>
        <span className="text-[11px] text-muted-foreground font-normal">
          {activeDays.size} {activeDays.size === 1 ? 'day' : 'days'} / week
        </span>
      </div>

      {/* Weekday indicator chips */}
      <div className="grid grid-cols-7 gap-1">
        {DAYS.map((day, idx) => {
          const isActive = activeDays.has(idx);
          return (
            <div
              key={day}
              className={`text-center py-1.5 rounded-md text-[11px] font-semibold transition-colors ${
                isActive
                  ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                  : 'bg-muted/60 text-muted-foreground border border-border/60'
              }`}
            >
              {day}
            </div>
          );
        })}
      </div>

      {!compact && routine.length > 0 && (
        <div className="mt-2 space-y-1.5 max-h-48 overflow-y-auto pr-1">
          {routine.map((b) => {
            const catMeta = getCategoryMeta(b.category);
            return (
              <div
                key={b.id}
                className="text-xs p-2 rounded-md bg-surface border border-border flex items-center justify-between"
              >
                <div className="min-w-0 pr-2">
                  <p className="font-semibold text-foreground truncate">{b.title}</p>
                  <p className="text-[10px] text-muted-foreground">{DAYS[b.dayOfWeek]} · {b.startTime} - {b.endTime}</p>
                </div>
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded border shrink-0 ${catMeta.badgeClass}`}>
                  {b.category}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};


import React from 'react';
import { 
  Dumbbell, 
  Footprints, 
  Code, 
  Brain, 
  Heart, 
  Compass, 
  Lock, 
  Sparkles,
  BookOpen,
  Calendar,
  Briefcase,
  DollarSign
} from 'lucide-react';
import { ChallengeStatus } from '../../types';
import { ChallengeStatusBadge } from './ChallengeStatusBadge';
import { getCategoryMeta } from '../../categoryColors';

interface ChallengeCardHeaderProps {
  id: string;
  name: string;
  category: string;
  totalDays: number;
  status: ChallengeStatus;
  routineLocked: boolean;
  isCreator?: boolean;
}

const getCategoryIcon = (category: string) => {
  const normalized = category.toLowerCase();
  if (normalized.includes('fit') || normalized.includes('core') || normalized.includes('strength')) {
    return <Dumbbell className="w-5 h-5 text-cat-health" aria-hidden="true" />;
  }
  if (normalized.includes('run') || normalized.includes('trail')) {
    return <Footprints className="w-5 h-5 text-cat-health" aria-hidden="true" />;
  }
  if (normalized.includes('code') || normalized.includes('tech')) {
    return <Code className="w-5 h-5 text-cat-study" aria-hidden="true" />;
  }
  if (normalized.includes('work') || normalized.includes('career') || normalized.includes('project')) {
    return <Briefcase className="w-5 h-5 text-cat-work" aria-hidden="true" />;
  }
  if (normalized.includes('finan') || normalized.includes('money')) {
    return <DollarSign className="w-5 h-5 text-cat-finance" aria-hidden="true" />;
  }
  if (normalized.includes('mind') || normalized.includes('breath') || normalized.includes('meditat') || normalized.includes('spirit')) {
    return <Brain className="w-5 h-5 text-cat-spiritual" aria-hidden="true" />;
  }
  if (normalized.includes('well') || normalized.includes('sleep') || normalized.includes('health')) {
    return <Heart className="w-5 h-5 text-cat-health" aria-hidden="true" />;
  }
  if (normalized.includes('read') || normalized.includes('study')) {
    return <BookOpen className="w-5 h-5 text-cat-study" aria-hidden="true" />;
  }
  if (normalized.includes('outdoor') || normalized.includes('relat')) {
    return <Compass className="w-5 h-5 text-cat-relationships" aria-hidden="true" />;
  }
  return <Sparkles className="w-5 h-5 text-primary" aria-hidden="true" />;
};

export const ChallengeCardHeader: React.FC<ChallengeCardHeaderProps> = ({
  id,
  name,
  category,
  totalDays,
  status,
  routineLocked,
  isCreator,
}) => {
  const catMeta = getCategoryMeta(category);

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-muted/60 flex items-center justify-center border border-border shrink-0 shadow-2xs">
            {getCategoryIcon(category)}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground flex-wrap">
              <span className={`inline-flex items-center gap-1 font-semibold ${catMeta.textClass}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${catMeta.dotClass}`} aria-hidden="true" />
                {category}
              </span>
              <span className="text-border-subtle">•</span>
              <span className="flex items-center gap-1 font-['JetBrains_Mono',monospace]">
                <Calendar className="w-3.5 h-3.5 text-muted-foreground" aria-hidden="true" />
                {totalDays}d
              </span>
              {routineLocked ? (
                <span 
                  title="Routine is locked"
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border text-[10px] font-medium"
                >
                  <Lock className="w-2.5 h-2.5" aria-hidden="true" />
                  Locked
                </span>
              ) : isCreator ? (
                <span 
                  title="Routine editable before first member joins"
                  className="inline-flex items-center px-1.5 py-0.5 rounded bg-primary/15 text-primary border border-primary/30 text-[10px] font-semibold"
                >
                  Editable
                </span>
              ) : null}
            </div>
            <h3 
              id={`challenge-title-${id}`}
              className="font-bold text-foreground text-base leading-snug truncate group-hover:text-primary transition-colors mt-0.5"
            >
              {name}
            </h3>
          </div>
        </div>

        <div className="shrink-0 pt-0.5">
          <ChallengeStatusBadge status={status} />
        </div>
      </div>
    </div>
  );
};


import React, { useState } from 'react';
import { ChallengeDraft, ChallengeCardModel, ChallengeRoutineBlock } from '../../types';
import { ChallengeBasicsStep } from './steps/ChallengeBasicsStep';
import { ChallengeScheduleStep } from './steps/ChallengeScheduleStep';
import { ChallengeReviewStep } from './steps/ChallengeReviewStep';
import { ChallengeCreatedSuccess } from './steps/ChallengeCreatedSuccess';
import { X, ArrowLeft, ArrowRight, Check } from 'lucide-react';

interface CreateChallengeWizardProps {
  onClose: () => void;
  onCreateChallenge: (newChallenge: ChallengeCardModel) => void;
  onOpenCardDetail: (challenge: ChallengeCardModel) => void;
}

const INITIAL_DRAFT: ChallengeDraft = {
  name: '',
  category: 'Health',
  durationDays: 30,
  startDate: new Date('2026-09-15').toISOString().split('T')[0],
  schedule: [
    {
      dayOfWeek: 1, // Mon
      blocks: [
        {
          id: 'b-init-1',
          title: 'Foundation Session',
          startTime: '07:00',
          endTime: '07:45',
          category: 'Health',
        },
      ],
    },
    {
      dayOfWeek: 3, // Wed
      blocks: [
        {
          id: 'b-init-2',
          title: 'Core Stability Intervals',
          startTime: '07:00',
          endTime: '07:45',
          category: 'Health',
        },
      ],
    },
  ],
};

export const CreateChallengeWizard: React.FC<CreateChallengeWizardProps> = ({
  onClose,
  onCreateChallenge,
  onOpenCardDetail,
}) => {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);
  const [draft, setDraft] = useState<ChallengeDraft>(INITIAL_DRAFT);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [createdChallenge, setCreatedChallenge] = useState<ChallengeCardModel | null>(null);

  const handleUpdateDraft = (updated: Partial<ChallengeDraft>) => {
    setDraft((prev) => ({ ...prev, ...updated }));
    // Clear errors on change
    setErrors({});
  };

  const validateStep1 = () => {
    const errs: Record<string, string> = {};
    if (!draft.name.trim()) {
      errs.name = 'Challenge title is required';
    } else if (draft.name.trim().length < 4) {
      errs.name = 'Title should be at least 4 characters long';
    }

    if (!draft.category) {
      errs.category = 'Please select a category';
    }

    if (!draft.durationDays || draft.durationDays < 7 || draft.durationDays > 90) {
      errs.duration = 'Duration must be between 7 and 90 days';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateStep2 = () => {
    const errs: Record<string, string> = {};
    const totalBlocks = draft.schedule.reduce((acc, s) => acc + s.blocks.length, 0);

    if (totalBlocks === 0) {
      errs.schedule = 'Please add at least one routine time block to the schedule';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNext = () => {
    if (currentStep === 1) {
      if (validateStep1()) setCurrentStep(2);
    } else if (currentStep === 2) {
      if (validateStep2()) setCurrentStep(3);
    }
  };

  const handleBack = () => {
    if (currentStep === 2) setCurrentStep(1);
    if (currentStep === 3) setCurrentStep(2);
  };

  const handleCreate = () => {
    // Flatten schedule into ChallengeRoutineBlock array
    const allWeeklyRoutine: ChallengeRoutineBlock[] = [];
    draft.schedule.forEach((day) => {
      day.blocks.forEach((block) => {
        allWeeklyRoutine.push({
          id: block.id,
          dayOfWeek: day.dayOfWeek,
          startTime: block.startTime,
          endTime: block.endTime,
          title: block.title,
          category: block.category || draft.category,
          completed: false,
        });
      });
    });

    const endDate = (() => {
      const d = new Date(draft.startDate);
      d.setDate(d.getDate() + draft.durationDays);
      return d.toISOString().split('T')[0];
    })();

    const newChallenge: ChallengeCardModel = {
      id: `ch-custom-${Date.now()}`,
      name: draft.name.trim(),
      category: draft.category,
      status: 'UPCOMING',
      startAt: draft.startDate,
      endAt: endDate,
      score: null,
      rank: null,
      memberCount: 0,
      completion: null,
      consistency: null,
      participation: null,
      currentDay: 0,
      totalDays: draft.durationDays,
      routineLocked: false,
      isCreator: true,
      joined: true,
      todayBlocks: [],
      allWeeklyRoutine,
      leaderboard: [],
    };

    onCreateChallenge(newChallenge);
    setCreatedChallenge(newChallenge);
    setCurrentStep(4); // Success screen
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-wizard-title"
    >
      <div 
        className="bg-surface rounded-2xl w-full max-w-xl max-h-[92vh] flex flex-col shadow-2xl border border-border overflow-hidden text-foreground"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Wizard Header */}
        <div className="p-5 border-b border-border flex items-center justify-between bg-surface-elevated/70">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              New Challenge Flow
            </span>
            <h2 id="create-wizard-title" className="text-lg font-bold text-foreground">
              {currentStep === 4 ? 'Challenge Created' : 'Create a Commitment Rulebook'}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close creation wizard"
            className="w-8 h-8 rounded-full bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors border border-border"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* 3-Step Indicator (steps 1-3) */}
        {currentStep < 4 && (
          <div className="px-5 py-3 border-b border-border bg-surface grid grid-cols-3 gap-2">
            {[
              { num: 1, label: 'Basics' },
              { num: 2, label: 'Schedule' },
              { num: 3, label: 'Review' },
            ].map((s) => {
              const isActive = currentStep === s.num;
              const isPast = currentStep > s.num;
              return (
                <div key={s.num} className="flex items-center gap-2">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-xs'
                        : isPast
                        ? 'bg-primary/20 text-primary border border-primary/30'
                        : 'bg-muted text-muted-foreground border border-border'
                    }`}
                  >
                    {isPast ? <Check className="w-3.5 h-3.5" /> : s.num}
                  </div>
                  <span className={`text-xs font-semibold truncate ${
                    isActive ? 'text-foreground font-bold' : isPast ? 'text-primary' : 'text-muted-foreground'
                  }`}>
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Wizard Step Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {currentStep === 1 && (
            <ChallengeBasicsStep
              draft={draft}
              onChange={handleUpdateDraft}
              errors={errors}
            />
          )}

          {currentStep === 2 && (
            <ChallengeScheduleStep
              draft={draft}
              onChange={handleUpdateDraft}
              errors={errors}
            />
          )}

          {currentStep === 3 && (
            <ChallengeReviewStep draft={draft} />
          )}

          {currentStep === 4 && createdChallenge && (
            <ChallengeCreatedSuccess
              createdChallenge={createdChallenge}
              onOpenCardDetail={onOpenCardDetail}
              onDone={onClose}
            />
          )}
        </div>

        {/* Wizard Footer Controls */}
        {currentStep < 4 && (
          <div className="p-4 border-t border-border bg-surface-elevated/70 flex items-center justify-between">
            {currentStep > 1 ? (
              <button
                type="button"
                onClick={handleBack}
                className="min-h-[44px] px-4 py-2 rounded-xl border border-border hover:bg-muted text-foreground text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                <span>Back</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="min-h-[44px] px-4 py-2 rounded-xl border border-border hover:bg-muted text-foreground text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
            )}

            {currentStep < 3 ? (
              <button
                type="button"
                onClick={handleNext}
                className="min-h-[44px] px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover active:bg-amber-600 text-primary-foreground text-xs font-bold flex items-center gap-2 shadow-xs transition-colors"
              >
                <span>Continue</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleCreate}
                className="min-h-[44px] px-6 py-2.5 rounded-xl bg-primary hover:bg-primary-hover active:bg-amber-600 text-primary-foreground text-xs font-bold flex items-center gap-2 shadow-xs transition-colors"
              >
                <span>Publish Challenge</span>
                <Check className="w-4 h-4" aria-hidden="true" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

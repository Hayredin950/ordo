import React, { useState } from 'react';
import { ChallengeCardModel, ChallengeRoutineBlock } from '../../types';
import { Lock, Plus, Trash2, X, Check, AlertCircle, Sparkles } from 'lucide-react';
import { CATEGORY_LIST, getCategoryMeta } from '../../categoryColors';

interface ChallengeRoutineEditorProps {
  challenge: ChallengeCardModel;
  onClose: () => void;
  onSaveRoutine: (challengeId: string, updatedRoutine: ChallengeRoutineBlock[]) => void;
  onSimulateMemberJoin?: (challengeId: string) => void;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const ChallengeRoutineEditor: React.FC<ChallengeRoutineEditorProps> = ({
  challenge,
  onClose,
  onSaveRoutine,
  onSimulateMemberJoin,
}) => {
  const [blocks, setBlocks] = useState<ChallengeRoutineBlock[]>(challenge.allWeeklyRoutine);
  const [selectedDay, setSelectedDay] = useState<number>(1); // default Monday
  const [newTitle, setNewTitle] = useState('');
  const [newStart, setNewStart] = useState('07:00');
  const [newEnd, setNewEnd] = useState('07:45');
  const [newCategory, setNewCategory] = useState(challenge.category || 'Health');
  const [validationError, setValidationError] = useState<string | null>(null);

  const isLocked = challenge.routineLocked;

  const handleAddBlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked) return;

    if (!newTitle.trim()) {
      setValidationError('Please enter a routine block name');
      return;
    }

    if (newStart >= newEnd) {
      setValidationError('Start time must be before end time');
      return;
    }

    // Check overlap on the same day
    const dayBlocks = blocks.filter((b) => b.dayOfWeek === selectedDay);
    const hasOverlap = dayBlocks.some(
      (b) =>
        (newStart >= b.startTime && newStart < b.endTime) ||
        (newEnd > b.startTime && newEnd <= b.endTime) ||
        (newStart <= b.startTime && newEnd >= b.endTime)
    );

    if (hasOverlap) {
      setValidationError('This time block overlaps with an existing routine block on this day');
      return;
    }

    setValidationError(null);
    const newBlock: ChallengeRoutineBlock = {
      id: `block-${Date.now()}`,
      dayOfWeek: selectedDay,
      startTime: newStart,
      endTime: newEnd,
      title: newTitle.trim(),
      category: newCategory,
      completed: false,
    };

    setBlocks([...blocks, newBlock]);
    setNewTitle('');
  };

  const handleRemoveBlock = (blockId: string) => {
    if (isLocked) return;
    setBlocks(blocks.filter((b) => b.id !== blockId));
  };

  const handleSave = () => {
    if (isLocked) return;
    onSaveRoutine(challenge.id, blocks);
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="routine-editor-title"
    >
      <div 
        className="bg-surface rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl border border-border overflow-hidden text-foreground"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-border flex items-start justify-between gap-4 bg-surface-elevated/70">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Routine Editor</span>
              {isLocked ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground border border-border">
                  <Lock className="w-3 h-3 text-muted-foreground" aria-hidden="true" />
                  Locked
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-primary/15 text-primary border border-primary/30">
                  <Sparkles className="w-3 h-3 text-primary" aria-hidden="true" />
                  Editable (0 members joined)
                </span>
              )}
            </div>
            <h3 id="routine-editor-title" className="text-lg font-bold text-foreground mt-1">
              {challenge.name}
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close editor"
            className="w-8 h-8 rounded-full bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors border border-border"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {isLocked ? (
            <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-2">
              <div className="flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-muted text-muted-foreground flex items-center justify-center shrink-0 mt-0.5 border border-border">
                  <Lock className="w-4 h-4" aria-hidden="true" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-foreground">Schedule Rules Locked</h4>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    This routine is now locked because participants have already enrolled ({challenge.memberCount} members). Modifying time blocks after start would invalidate competitive ranking parity.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-primary/10 border border-primary/25 space-y-2">
              <p className="text-xs text-primary leading-relaxed">
                <strong>Routine is currently open for modification:</strong> You can add or adjust workout and practice time blocks freely. The moment another member joins, the routine will permanently lock.
              </p>
              {onSimulateMemberJoin && challenge.memberCount === 0 && (
                <button
                  type="button"
                  onClick={() => {
                    onSimulateMemberJoin(challenge.id);
                  }}
                  className="mt-1 text-xs font-bold text-primary hover:text-primary-hover underline underline-offset-2 flex items-center gap-1"
                >
                  <Lock className="w-3.5 h-3.5" aria-hidden="true" />
                  Simulate first member joining (test locked state)
                </button>
              )}
            </div>
          )}

          {/* Form to add block if unlocked */}
          {!isLocked && (
            <form onSubmit={handleAddBlock} className="p-4 rounded-xl bg-surface-elevated/60 border border-border space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Add New Time Block</h4>
              
              {validationError && (
                <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 border border-destructive/20 p-2 rounded-lg">
                  <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>{validationError}</span>
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="col-span-2 sm:col-span-4">
                  <label htmlFor="block-title" className="block text-xs font-semibold text-muted-foreground mb-1">Block Activity Name</label>
                  <input
                    id="block-title"
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g. Tabata Core Circuit / Deep Focus Block"
                    className="w-full text-xs px-3 py-2 rounded-lg border border-border bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="col-span-2">
                  <label htmlFor="block-day" className="block text-xs font-semibold text-muted-foreground mb-1">Day of Week</label>
                  <select
                    id="block-day"
                    value={selectedDay}
                    onChange={(e) => setSelectedDay(Number(e.target.value))}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-border bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {DAYS.map((name, idx) => (
                      <option key={name} value={idx}>{name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="block-start" className="block text-xs font-semibold text-muted-foreground mb-1">Start Time</label>
                  <input
                    id="block-start"
                    type="time"
                    value={newStart}
                    onChange={(e) => setNewStart(e.target.value)}
                    className="w-full text-xs px-2.5 py-2 rounded-lg border border-border bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary font-['JetBrains_Mono',monospace]"
                  />
                </div>

                <div>
                  <label htmlFor="block-end" className="block text-xs font-semibold text-muted-foreground mb-1">End Time</label>
                  <input
                    id="block-end"
                    type="time"
                    value={newEnd}
                    onChange={(e) => setNewEnd(e.target.value)}
                    className="w-full text-xs px-2.5 py-2 rounded-lg border border-border bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary font-['JetBrains_Mono',monospace]"
                  />
                </div>

                {/* Category Selector with explicit tokens */}
                <div className="col-span-2 sm:col-span-4">
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                    Category Color Token
                  </label>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                    {CATEGORY_LIST.map((cat) => {
                      const isSelected = newCategory.toLowerCase().includes(cat.id.toLowerCase());
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setNewCategory(cat.id)}
                          className={`px-2 py-1.5 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1.5 transition-all ${
                            isSelected
                              ? `${cat.chipClass} ring-1 ring-primary`
                              : 'bg-surface border-border text-muted-foreground hover:border-border/80'
                          }`}
                        >
                          <span className={`w-2 h-2 rounded-full ${cat.dotClass}`} aria-hidden="true" />
                          <span className="truncate">{cat.id}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-primary-foreground font-bold text-xs transition-colors flex items-center gap-1.5 shadow-xs"
                >
                  <Plus className="w-4 h-4" aria-hidden="true" />
                  <span>Add Block to Schedule</span>
                </button>
              </div>
            </form>
          )}

          {/* Current Routine List */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Active Routine Schedule ({blocks.length} blocks)
            </h4>

            {blocks.length === 0 ? (
              <p className="text-xs text-muted-foreground italic py-4 text-center">
                No routine blocks defined yet. Add at least one above.
              </p>
            ) : (
              <div className="space-y-2">
                {blocks.map((block) => {
                  const catMeta = getCategoryMeta(block.category);
                  return (
                    <div
                      key={block.id}
                      className="p-3 rounded-xl border border-border bg-surface flex items-center justify-between gap-3 shadow-xs"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-foreground truncate">{block.title}</p>
                        <div className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="font-semibold text-foreground">{DAYS[block.dayOfWeek]}</span>
                          <span>•</span>
                          <span className="font-['JetBrains_Mono',monospace]">{block.startTime} - {block.endTime}</span>
                          <span>•</span>
                          <span className={`inline-flex items-center gap-1 font-semibold ${catMeta.textClass}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${catMeta.dotClass}`} />
                            {block.category}
                          </span>
                        </div>
                      </div>

                      {!isLocked && (
                        <button
                          type="button"
                          onClick={() => handleRemoveBlock(block.id)}
                          className="p-2 text-muted-foreground hover:text-destructive rounded-lg transition-colors"
                          aria-label={`Remove block ${block.title}`}
                        >
                          <Trash2 className="w-4 h-4" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-surface-elevated/70 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-4 py-2 rounded-xl border border-border text-foreground text-xs font-semibold hover:bg-muted transition-colors"
          >
            {isLocked ? 'Close' : 'Cancel'}
          </button>
          {!isLocked && (
            <button
              type="button"
              onClick={handleSave}
              className="min-h-[44px] px-5 py-2 rounded-xl bg-primary hover:bg-primary-hover text-primary-foreground text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors"
            >
              <Check className="w-4 h-4" aria-hidden="true" />
              <span>Save Routine Changes</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

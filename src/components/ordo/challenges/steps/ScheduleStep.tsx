import { useState } from "react";
import { Plus, Trash2, AlertCircle } from "lucide-react";
import { getCategoryMeta } from "../categoryColors";
import type { ChallengeDraft } from "../types";

const DAYS = [
  { index: 1, label: "Mon", full: "Monday" },
  { index: 2, label: "Tue", full: "Tuesday" },
  { index: 3, label: "Wed", full: "Wednesday" },
  { index: 4, label: "Thu", full: "Thursday" },
  { index: 5, label: "Fri", full: "Friday" },
  { index: 6, label: "Sat", full: "Saturday" },
  { index: 0, label: "Sun", full: "Sunday" },
];

interface Props {
  draft: ChallengeDraft;
  onChange: (updated: Partial<ChallengeDraft>) => void;
  errors: Record<string, string>;
}

export function ChallengeScheduleStep({ draft, onChange, errors }: Props) {
  const [activeDay, setActiveDay] = useState<number>(1);
  const [newTitle, setNewTitle] = useState("");
  const [newStart, setNewStart] = useState("07:00");
  const [newEnd, setNewEnd] = useState("07:45");
  const [blockError, setBlockError] = useState<string | null>(null);

  const daySchedule: {
    dayOfWeek: number;
    blocks: { id: string; title: string; startTime: string; endTime: string; category: string }[];
  } = draft.schedule.find((s) => s.dayOfWeek === activeDay) ?? {
    dayOfWeek: activeDay,
    blocks: [],
  };

  const catMeta = getCategoryMeta(draft.category);

  const handleAddBlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      setBlockError("Enter a routine block title");
      return;
    }

    if (newStart >= newEnd) {
      setBlockError("Start time must precede end time");
      return;
    }

    const hasOverlap = daySchedule.blocks.some(
      (b) =>
        (newStart >= b.startTime && newStart < b.endTime) ||
        (newEnd > b.startTime && newEnd <= b.endTime) ||
        (newStart <= b.startTime && newEnd >= b.endTime),
    );

    if (hasOverlap) {
      setBlockError("Time block overlaps with an existing schedule for this day");
      return;
    }

    setBlockError(null);

    const newBlock = {
      id: `block-${Date.now()}`,
      title: newTitle.trim(),
      startTime: newStart,
      endTime: newEnd,
      category: draft.category || "health",
    };

    const existingDayIndex = draft.schedule.findIndex((s) => s.dayOfWeek === activeDay);
    const updatedSchedule = [...draft.schedule];

    if (existingDayIndex >= 0) {
      const existing = updatedSchedule[existingDayIndex];
      if (existing) {
        updatedSchedule[existingDayIndex] = {
          ...existing,
          blocks: [...existing.blocks, newBlock],
        };
      }
    } else {
      updatedSchedule.push({ dayOfWeek: activeDay, blocks: [newBlock] });
    }

    onChange({ schedule: updatedSchedule });
    setNewTitle("");
  };

  const handleRemoveBlock = (dayOfWeek: number, blockId: string) => {
    const updatedSchedule = draft.schedule
      .map((day) => {
        if (day.dayOfWeek === dayOfWeek) {
          return { ...day, blocks: day.blocks.filter((b) => b.id !== blockId) };
        }
        return day;
      })
      .filter((day) => day.blocks.length > 0);

    onChange({ schedule: updatedSchedule });
  };

  const totalBlocks = draft.schedule.reduce((acc, s) => acc + s.blocks.length, 0);

  return (
    <div className="space-y-5 text-foreground">
      <div>
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            Weekly Routine Schedule <span className="text-destructive">*</span>
          </label>
          <span className="text-xs font-semibold text-primary font-mono">
            {totalBlocks} total blocks scheduled
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          Define the specific recurring time commitments expected from participants.
        </p>
      </div>

      {errors["schedule"] && (
        <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-xs text-destructive flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>{errors["schedule"]}</span>
        </div>
      )}

      <div className="grid grid-cols-7 gap-1.5">
        {DAYS.map((d) => {
          const count = draft.schedule.find((s) => s.dayOfWeek === d.index)?.blocks.length || 0;
          const isSelected = activeDay === d.index;
          return (
            <button
              type="button"
              key={d.index}
              onClick={() => setActiveDay(d.index)}
              className={`p-2 rounded-xl text-center flex flex-col items-center gap-1 transition-all ${
                isSelected
                  ? "bg-primary text-primary-foreground font-bold shadow-xs"
                  : count > 0
                    ? "bg-primary/10 text-primary border border-primary/30"
                    : "bg-surface-elevated hover:bg-muted text-muted-foreground border border-border"
              }`}
            >
              <span className="text-xs font-bold">{d.label}</span>
              <span
                className={`text-[10px] font-semibold px-1.5 rounded-full ${
                  isSelected
                    ? "bg-amber-600 text-primary-foreground"
                    : count > 0
                      ? "bg-primary/20 text-primary"
                      : "text-muted-foreground"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <form
        onSubmit={handleAddBlock}
        className="p-4 rounded-xl bg-surface-elevated border border-border space-y-3"
      >
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
            Add Block for {DAYS.find((d) => d.index === activeDay)?.full}
          </h4>
          <span
            className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${catMeta.badgeClass}`}
          >
            {draft.category}
          </span>
        </div>

        {blockError && (
          <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 p-2 rounded-lg flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>{blockError}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-6 gap-2">
          <div className="sm:col-span-3">
            <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
              Activity Title
            </label>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g. 45-min Interval Training"
              className="w-full text-xs px-3 py-2 rounded-lg border border-border bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="sm:col-span-1.5">
            <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
              Start
            </label>
            <input
              type="time"
              value={newStart}
              onChange={(e) => setNewStart(e.target.value)}
              className="w-full text-xs px-2 py-2 rounded-lg border border-border bg-surface text-foreground font-mono focus:ring-primary focus:outline-none"
            />
          </div>

          <div className="sm:col-span-1.5">
            <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
              End
            </label>
            <input
              type="time"
              value={newEnd}
              onChange={(e) => setNewEnd(e.target.value)}
              className="w-full text-xs px-2 py-2 rounded-lg border border-border bg-surface text-foreground font-mono focus:ring-primary focus:outline-none"
            />
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <button
            type="submit"
            className="min-h-[40px] px-3.5 py-1.5 rounded-lg bg-primary hover:bg-primary-hover text-primary-foreground font-bold text-xs flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>Add to {DAYS.find((d) => d.index === activeDay)?.label}</span>
          </button>
        </div>
      </form>

      <div className="space-y-2">
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Live Routine Schedule Preview
        </h4>

        <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
          {draft.schedule.length === 0 ? (
            <p className="text-xs text-muted-foreground italic text-center py-4 border border-dashed border-border rounded-xl">
              No time blocks added yet. Add at least one above to proceed.
            </p>
          ) : (
            draft.schedule.map((day) => (
              <div
                key={day.dayOfWeek}
                className="p-2.5 rounded-xl border border-border bg-surface-elevated space-y-1.5"
              >
                <div className="flex items-center justify-between text-xs font-bold text-foreground border-b border-border/60 pb-1">
                  <span>{DAYS.find((d) => d.index === day.dayOfWeek)?.full}</span>
                  <span className="text-[11px] text-muted-foreground font-normal">
                    {day.blocks.length} block{day.blocks.length > 1 ? "s" : ""}
                  </span>
                </div>
                <div className="space-y-1">
                  {day.blocks.map((b) => (
                    <div
                      key={b.id}
                      className="flex items-center justify-between text-xs p-1.5 rounded bg-surface border border-border/60"
                    >
                      <div className="min-w-0 pr-2">
                        <span className="font-semibold text-foreground">{b.title}</span>
                        <span className="text-muted-foreground text-[10px] ml-2 font-mono">
                          {b.startTime} - {b.endTime}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveBlock(day.dayOfWeek, b.id)}
                        className="text-muted-foreground hover:text-destructive p-1 transition-colors"
                        aria-label="Remove block"
                      >
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

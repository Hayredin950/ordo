import { Dumbbell, BookOpen, Briefcase, DollarSign, Sparkles, Heart } from "lucide-react";
import { getCategoryMeta } from "../categoryColors";
import type { ChallengeDraft } from "../types";

const CATEGORY_CARDS = [
  { id: "health", label: "Health", icon: Dumbbell, desc: "Fitness, workouts & vitality" },
  { id: "study", label: "Study", icon: BookOpen, desc: "Learning, reading & research" },
  { id: "work", label: "Work", icon: Briefcase, desc: "Deep focus, projects & craft" },
  { id: "finance", label: "Finance", icon: DollarSign, desc: "Saving, investing & budgeting" },
  { id: "spiritual", label: "Spiritual", icon: Sparkles, desc: "Mindfulness, meditation & peace" },
  {
    id: "relationships",
    label: "Relationships",
    icon: Heart,
    desc: "Family, community & presence",
  },
];

const PRESET_DURATIONS = [7, 14, 21, 30, 60];

interface Props {
  draft: ChallengeDraft;
  onChange: (updated: Partial<ChallengeDraft>) => void;
  errors: Record<string, string>;
}

export function ChallengeBasicsStep({ draft, onChange, errors }: Props) {
  return (
    <div className="space-y-5 text-foreground">
      <div>
        <label
          htmlFor="challenge-name-input"
          className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5"
        >
          Challenge Title <span className="text-destructive">*</span>
        </label>
        <input
          id="challenge-name-input"
          type="text"
          value={draft.name}
          maxLength={60}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="e.g. 30-Day Morning Kettlebell & Core"
          className={`w-full px-3.5 py-2.5 rounded-xl border text-sm bg-surface-elevated text-foreground transition-all focus:outline-none focus:ring-2 focus:ring-primary ${
            errors["name"] ? "border-destructive bg-destructive/10" : "border-border"
          }`}
        />
        <div className="flex justify-between items-center mt-1">
          {errors["name"] ? (
            <span className="text-xs text-destructive font-medium">{errors["name"]}</span>
          ) : (
            <span className="text-[11px] text-muted-foreground">
              A clear, motivating commitment name.
            </span>
          )}
          <span className="text-[11px] text-muted-foreground font-mono">
            {draft.name.length}/60
          </span>
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
          Visibility <span className="text-destructive">*</span>
        </label>
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => onChange({ visibility: "public" })}
            className={`p-3 rounded-xl border text-left transition-all ${
              draft.visibility === "public"
                ? "border-primary bg-primary/10 shadow-xs ring-1 ring-primary"
                : "border-border bg-surface-elevated hover:border-border/80 text-foreground"
            }`}
          >
            <div className="text-xs font-bold text-foreground">Public</div>
            <div className="text-[10px] mt-0.5 text-muted-foreground">
              Anyone in the community can discover and join
            </div>
          </button>
          <button
            type="button"
            onClick={() => onChange({ visibility: "private" })}
            className={`p-3 rounded-xl border text-left transition-all ${
              draft.visibility === "private"
                ? "border-primary bg-primary/10 shadow-xs ring-1 ring-primary"
                : "border-border bg-surface-elevated hover:border-border/80 text-foreground"
            }`}
          >
            <div className="text-xs font-bold text-foreground">Private</div>
            <div className="text-[10px] mt-0.5 text-muted-foreground">
              Invite code only — share to let people in
            </div>
          </button>
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
          Category Color Palette <span className="text-destructive">*</span>
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {CATEGORY_CARDS.map((cat) => {
            const Icon = cat.icon;
            const meta = getCategoryMeta(cat.id);
            const isSelected = draft.category.toLowerCase().includes(cat.id.toLowerCase());
            return (
              <button
                type="button"
                key={cat.id}
                onClick={() => onChange({ category: cat.id })}
                className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all ${
                  isSelected
                    ? "border-primary bg-primary/10 shadow-xs ring-1 ring-primary"
                    : "border-border bg-surface-elevated hover:border-border/80 text-foreground"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center ${meta.badgeClass}`}
                  >
                    <Icon className="w-4 h-4" aria-hidden="true" />
                  </div>
                  <span className={`w-2.5 h-2.5 rounded-full ${meta.dotClass}`} />
                </div>
                <div>
                  <div className="text-xs font-bold text-foreground">{cat.label}</div>
                  <div className="text-[10px] mt-0.5 text-muted-foreground line-clamp-1">
                    {cat.desc}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
        {errors["category"] && (
          <p className="text-xs text-destructive font-medium mt-1">{errors["category"]}</p>
        )}
      </div>

      <div>
        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
          Duration <span className="text-destructive">*</span>
        </label>
        <div className="flex flex-wrap items-center gap-2">
          {PRESET_DURATIONS.map((days) => (
            <button
              type="button"
              key={days}
              onClick={() => onChange({ durationDays: days })}
              className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                draft.durationDays === days
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-surface-elevated hover:bg-muted text-muted-foreground hover:text-foreground border border-border"
              }`}
            >
              {days} Days
            </button>
          ))}
          <div className="flex items-center gap-1.5 ml-1">
            <span className="text-xs text-muted-foreground">Custom:</span>
            <input
              type="number"
              min={7}
              max={90}
              value={draft.durationDays}
              onChange={(e) => onChange({ durationDays: Math.max(1, Number(e.target.value)) })}
              className="w-16 px-2 py-1 text-xs text-center border border-border rounded-lg bg-surface-elevated text-foreground font-mono focus:ring-primary focus:outline-none"
            />
            <span className="text-xs text-muted-foreground">days</span>
          </div>
        </div>

        <div className="mt-3 p-3 rounded-xl bg-surface-elevated border border-border text-xs text-muted-foreground flex items-center justify-between">
          <span>Derived Program Timeline:</span>
          <span className="font-bold text-primary font-mono">
            {draft.durationDays} days · {draft.startDate} →{" "}
            {(() => {
              const d = new Date(draft.startDate);
              d.setDate(d.getDate() + draft.durationDays);
              return d.toISOString().split("T")[0];
            })()}
          </span>
        </div>
        {errors["duration"] && (
          <p className="text-xs text-destructive font-medium mt-1">{errors["duration"]}</p>
        )}
      </div>
    </div>
  );
}

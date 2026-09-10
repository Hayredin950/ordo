import { AlertTriangle, ShieldCheck } from "lucide-react";
import { getCategoryMeta } from "../categoryColors";
import type { ChallengeDraft } from "../types";

const FULL_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface Props {
  draft: ChallengeDraft;
}

export function ChallengeReviewStep({ draft }: Props) {
  const endDate = (() => {
    const d = new Date(draft.startDate);
    d.setDate(d.getDate() + draft.durationDays);
    return d.toISOString().split("T")[0];
  })();

  const totalBlocks = draft.schedule.reduce((acc, s) => acc + s.blocks.length, 0);
  const catMeta = getCategoryMeta(draft.category);

  return (
    <div className="space-y-4 text-foreground">
      <div className="p-4 rounded-2xl bg-surface-elevated border border-border text-foreground shadow-xs space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold border ${catMeta.badgeClass}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${catMeta.dotClass}`} />
              {draft.category} Challenge
            </span>
            <h3 className="text-lg font-bold text-foreground mt-1.5">{draft.name}</h3>
          </div>
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-primary text-primary-foreground shadow-xs shrink-0">
            {draft.durationDays} Days
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border text-xs">
          <div>
            <span className="text-muted-foreground block text-[10px] uppercase">
              Schedule Period
            </span>
            <span className="font-semibold font-mono text-foreground">
              {draft.startDate} → {endDate}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground block text-[10px] uppercase">Weekly Load</span>
            <span className="font-semibold text-primary font-mono">
              {totalBlocks} routine blocks / week
            </span>
          </div>
        </div>
      </div>

      <div className="p-3.5 rounded-xl bg-primary/10 border border-primary/25 text-primary flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-primary shrink-0 mt-0.5" aria-hidden="true" />
        <div className="text-xs space-y-1">
          <p className="font-bold text-foreground">Important Routine Immutability Rule</p>
          <p className="text-muted-foreground leading-relaxed">
            <strong className="text-primary">
              "This routine becomes locked when the first member joins."
            </strong>{" "}
            Once another participant enrolls, schedule rules cannot be edited, ensuring mathematical
            parity in leaderboard scoring.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-primary" aria-hidden="true" />
          <span>Full Weekly Commitment Rulebook</span>
        </h4>

        <div className="border border-border rounded-xl overflow-hidden divide-y divide-border bg-surface">
          {draft.schedule.map((day) => (
            <div key={day.dayOfWeek} className="p-3 flex items-start justify-between text-xs">
              <span className="font-bold text-foreground w-28 shrink-0">
                {FULL_DAYS[day.dayOfWeek]}
              </span>
              <div className="flex-1 space-y-1">
                {day.blocks.map((b) => (
                  <div
                    key={b.id}
                    className="flex items-center justify-between text-foreground bg-surface-elevated px-2.5 py-1.5 rounded-md border border-border/60"
                  >
                    <span className="font-medium">{b.title}</span>
                    <span className="text-[11px] text-muted-foreground font-mono">
                      {b.startTime} - {b.endTime}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

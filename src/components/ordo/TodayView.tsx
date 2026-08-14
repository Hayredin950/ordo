import { useMemo, useState } from "react";
import {
  addDays,
  blocksFor,
  dateKey,
  dayScore,
  missedDebt,
  streak,
  type OrdoState,
} from "@/lib/ordo";
import { CategoryPill, Panel, PanelTitle, Ring, Stat } from "./primitives";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ChevronLeft, ChevronRight, Flame, AlertTriangle, Bell } from "lucide-react";
import { toast } from "sonner";

const STEPS = [0, 25, 50, 75, 100];

export function TodayView({
  state,
  update,
}: {
  state: OrdoState;
  update: (fn: (s: OrdoState) => OrdoState) => void;
}) {
  const [offset, setOffset] = useState(0);
  const day = addDays(new Date(), offset);
  const key = dateKey(day);
  const blocks = blocksFor(state, day);
  const entries = state.log[key] ?? {};
  const score = dayScore(state, day) ?? 0;
  const s = useMemo(() => streak(state), [state]);
  const debt = useMemo(() => missedDebt(state), [state]);

  const setPct = (blockId: string, pct: number) =>
    update((prev) => ({
      ...prev,
      log: { ...prev.log, [key]: { ...(prev.log[key] ?? {}), [blockId]: pct } },
    }));

  return (
    <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
      <Panel>
        <PanelTitle
          title={day.toLocaleDateString(undefined, {
            weekday: "long",
            month: "short",
            day: "numeric",
          })}
          hint={`${blocks.length} time blocks planned${state.overrides[key] ? " · custom day" : ""}`}
          action={
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" aria-label="Previous day" onClick={() => setOffset((o) => o - 1)}>
                <ChevronLeft className="size-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setOffset(0)}>
                Today
              </Button>
              <Button variant="ghost" size="icon" aria-label="Next day" onClick={() => setOffset((o) => o + 1)}>
                <ChevronRight className="size-4" />
              </Button>
            </div>
          }
        />

        <div className="space-y-2">
          {blocks.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Nothing scheduled. Build a routine in the Routine tab.
            </p>
          ) : null}
          {blocks.map((blk) => {
            const pct = entries[blk.id] ?? 0;
            return (
              <div
                key={blk.id}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-background/40 p-3"
              >
                <div className="w-24 shrink-0 font-display text-sm tabular-nums text-muted-foreground">
                  {blk.start}–{blk.end}
                </div>
                <div className="min-w-40 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={pct >= 100 ? "line-through opacity-60" : ""}>{blk.title}</span>
                    {blk.priority === "must" ? (
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                        must
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1">
                    <CategoryPill id={blk.category} />
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {STEPS.map((v) => (
                    <button
                      key={v}
                      onClick={() => setPct(blk.id, v)}
                      className={`h-7 rounded-md px-2 text-xs font-medium transition-colors ${
                        pct === v
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-accent"
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-5">
          <PanelTitle title="Reflection" hint="One honest line about today — fuels better suggestions." />
          <Textarea
            value={state.journal[key] ?? ""}
            onChange={(e) =>
              update((prev) => ({ ...prev, journal: { ...prev.journal, [key]: e.target.value } }))
            }
            placeholder="What worked, what slipped, and why…"
            rows={3}
          />
        </div>
      </Panel>

      <div className="space-y-5">
        <Panel className="flex items-center gap-5">
          <Ring value={score} label="today" />
          <div className="space-y-1">
            <div className="flex items-center gap-2 font-display text-lg font-semibold">
              <Flame className="size-4 text-primary" /> {s.current}-day streak
            </div>
            <p className="text-sm text-muted-foreground">Best ever: {s.best} days</p>
            <p className="text-xs text-muted-foreground">Counted when a day closes above 70%.</p>
          </div>
        </Panel>

        <div className="grid grid-cols-2 gap-3">
          <Stat value={`${blocks.filter((x) => (entries[x.id] ?? 0) >= 100).length}/${blocks.length}`} label="Blocks cleared" />
          <Stat value={`${debt.length}`} label="Missed-task debt" />
        </div>

        <Panel>
          <PanelTitle title="Debt & catch-up" hint="Skipped must-do blocks from the last 14 days." />
          <div className="space-y-2">
            {debt.length === 0 ? (
              <p className="text-sm text-muted-foreground">Clean slate. Nothing owed.</p>
            ) : (
              debt.map(({ date, block }, i) => (
                <div key={`${date}-${block.id}-${i}`} className="flex items-center gap-2 text-sm">
                  <AlertTriangle className="size-3.5 shrink-0 text-primary" />
                  <span className="flex-1 truncate">{block.title}</span>
                  <span className="text-xs text-muted-foreground">{date.slice(5)}</span>
                </div>
              ))
            )}
          </div>
          {debt.length > 0 ? (
            <Button
              variant="secondary"
              size="sm"
              className="mt-4 w-full"
              onClick={() =>
                toast("Redistribution proposed", {
                  description: `Fit ${debt.length} missed block${debt.length > 1 ? "s" : ""} into the next 4 evenings without touching your must-do mornings.`,
                })
              }
            >
              Propose a catch-up plan
            </Button>
          ) : null}
        </Panel>

        <Panel>
          <PanelTitle title="Nudges" hint="Telegram-first, one shared notification service." />
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>· 10 min before every must-do block</p>
            <p>· Nag when a block's window closes unlogged</p>
            <p>· Morning brief + evening check-in</p>
          </div>
          <Button
            size="sm"
            className="mt-4 w-full"
            onClick={() => toast.success("Test nudge queued", { description: "Evening check-in: “How did the study session go?”" })}
          >
            <Bell className="mr-2 size-4" /> Send a test nudge
          </Button>
        </Panel>
      </div>
    </div>
  );
}

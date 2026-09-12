import { useMemo, useState } from "react";
import {
  addDays,
  blocksFor,
  dateKey,
  dayScore,
  formatTimeRange,
  hourFormatOf,
  missedDebt,
  streak,
  type OrdoState,
} from "@/lib/ordo";
import { CategoryPill, Panel, PanelTitle, Ring, Stat } from "./primitives";
import { reconcileDebtForDate, tasksForDate, debtBalance } from "@/lib/domain";
import type { LinkedItem } from "./FocusTimer";
import { FocusTimer } from "./FocusTimer";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ChevronLeft, ChevronRight, Flame, AlertTriangle, Play, MoonStar } from "lucide-react";
import { toast } from "sonner";
import { TelegramPanel } from "./TelegramPanel";
import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api";

const STEPS = [0, 25, 50, 75, 100];

export function TodayView({
  state,
  update,
}: {
  state: OrdoState;
  update: (fn: (s: OrdoState) => OrdoState) => void;
}) {
  const { user } = useAuth();
  const [offset, setOffset] = useState(0);
  const [focusReq, setFocusReq] = useState<{
    linked: LinkedItem;
    minutes: number;
    nonce: number;
  } | null>(null);
  const day = addDays(new Date(), offset);
  const key = dateKey(day);
  const blocks = blocksFor(state, day);
  const dayTasks = tasksForDate(state, day).filter((t) => t.status !== "cancelled");
  const entries = state.log[key] ?? {};
  const score = dayScore(state, day) ?? 0;
  const s = useMemo(() => streak(state), [state]);
  const debt = useMemo(() => missedDebt(state), [state]);
  const hourFormat = hourFormatOf(state);

  const proposeCatchUp = async () => {
    if (!user) {
      toast("Redistribution proposed", {
        description: `Fit ${debt.length} missed block${debt.length > 1 ? "s" : ""} into the next 4 evenings without touching your must-do mornings.`,
      });
      return;
    }
    try {
      const res = await apiFetch<{ proposal: string }>("/api/coach/catchup");
      toast("Catch-up proposal", { description: res.proposal.replace(/<[^>]+>/g, "") });
    } catch {
      toast.error("Could not generate a proposal");
    }
  };

  const setPct = (blockId: string, pct: number) =>
    update((prev) => {
      // One atomic transition: the log entry plus the debt-ledger
      // reconciliation it implies (§9.4) — never a computed field drifting.
      const next = {
        ...prev,
        log: { ...prev.log, [key]: { ...(prev.log[key] ?? {}), [blockId]: pct } },
      };
      return reconcileDebtForDate(next, day);
    });

  /** §5.5 entry point 1: start a focus session attached to this item. */
  const startFocus = (item: LinkedItem, minutes = 25) =>
    setFocusReq((prev) => ({ linked: item, minutes, nonce: (prev?.nonce ?? 0) + 1 }));

  return (
    <div className="grid gap-4 sm:gap-5 lg:grid-cols-[1.6fr_1fr]">
      <Panel>
        <PanelTitle
          title={day.toLocaleDateString(undefined, {
            weekday: "long",
            month: "short",
            day: "numeric",
          })}
          hint={`${blocks.length} time blocks planned${state.overrides[key] ? " · custom day" : ""}`}
          action={
            <div className="flex w-full items-center justify-between gap-1 sm:w-auto sm:justify-end">
              <Button
                variant="ghost"
                size="icon"
                className="tap"
                aria-label="Previous day"
                onClick={() => setOffset((o) => o - 1)}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button variant="ghost" size="sm" className="tap" onClick={() => setOffset(0)}>
                Today
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="tap"
                aria-label="Next day"
                onClick={() => setOffset((o) => o + 1)}
              >
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
            const done = pct >= 100;
            return (
              <div
                key={blk.id}
                className={`rounded-lg border p-3 transition-colors sm:flex sm:flex-wrap sm:items-center sm:gap-3 ${
                  done ? "border-primary/30 bg-primary/5" : "border-border bg-background/40"
                }`}
              >
                {/* The AM/PM form is roughly twice as wide as "09:00–10:30", so
                    the column widens with the preference rather than wrapping. */}
                <div
                  className={`font-display text-sm tabular-nums text-muted-foreground sm:shrink-0 ${
                    hourFormat === "12h" ? "sm:w-40" : "sm:w-24"
                  }`}
                >
                  {formatTimeRange(blk.start, blk.end, hourFormat)}
                </div>
                <div className="mt-1 min-w-0 sm:mt-0 sm:flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className={done ? "line-through opacity-60" : ""}>{blk.title}</span>
                    {blk.priority === "must" ? (
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                        must
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1">
                    <CategoryPill id={blk.category} icon />
                  </div>
                </div>
                {/* Full-width segmented control on a phone (each target ≥44px),
                    a compact inline group once there is room beside the title. */}
                <div className="flex items-center gap-1 sm:order-last">
                  <button
                    type="button"
                    aria-label={`Focus on ${blk.title}`}
                    title="Focus on this block"
                    onClick={() => startFocus({ id: blk.id, title: blk.title, type: "routine" })}
                    className="tap flex size-10 items-center justify-center rounded-md bg-muted text-muted-foreground hover:bg-accent sm:size-7 sm:px-2"
                  >
                    <Play className="size-3.5" />
                  </button>
                  <div
                    className="grid flex-1 grid-cols-5 gap-1 sm:flex sm:shrink-0"
                    role="group"
                    aria-label={`Completion for ${blk.title}`}
                  >
                  {STEPS.map((v) => (
                    <button
                      key={v}
                      type="button"
                      aria-pressed={pct === v}
                      onClick={() => setPct(blk.id, v)}
                      className={`tap h-10 rounded-md text-xs font-medium transition-colors sm:h-7 sm:px-2 ${
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
              </div>
            );
          })}
        </div>

        {dayTasks.length > 0 ? (
          <div className="mt-4 space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Scheduled tasks
            </p>
            {dayTasks.map((t) => {
              const pct = entries[t.id] ?? 0;
              const done = t.status === "done" || pct >= 100;
              return (
                <div
                  key={t.id}
                  className={`rounded-lg border p-3 sm:flex sm:flex-wrap sm:items-center sm:gap-3 ${
                    done ? "border-primary/30 bg-primary/5" : "border-border bg-background/40"
                  }`}
                >
                  <div className="font-display text-sm tabular-nums text-muted-foreground sm:w-24 sm:shrink-0">
                    {t.scheduledStart
                      ? formatTimeRange(
                          t.scheduledStart,
                          t.scheduledEnd ?? t.scheduledStart,
                          hourFormat,
                        )
                      : "Any time"}
                  </div>
                  <div className="mt-1 min-w-0 sm:mt-0 sm:flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className={done ? "line-through opacity-60" : ""}>{t.title}</span>
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                        task
                      </span>
                      {t.priority === "must" ? (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                          must
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      aria-label={`Focus on ${t.title}`}
                      title="Focus on this task"
                      onClick={() => startFocus({ id: t.id, title: t.title, type: "task" })}
                      className="tap flex size-10 items-center justify-center rounded-md bg-muted text-muted-foreground hover:bg-accent sm:size-7 sm:px-2"
                    >
                      <Play className="size-3.5" />
                    </button>
                    <div
                      className="grid grid-cols-5 gap-1 sm:flex sm:shrink-0"
                      role="group"
                      aria-label={`Completion for ${t.title}`}
                    >
                      {STEPS.map((v) => (
                        <button
                          key={v}
                          type="button"
                          aria-pressed={pct === v}
                          onClick={() => setPct(t.id, v)}
                          className={`tap h-10 rounded-md text-xs font-medium transition-colors sm:h-7 sm:px-2 ${
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
                </div>
              );
            })}
          </div>
        ) : null}

        <div className="mt-5">
          <PanelTitle
            title="Reflection"
            hint="One honest line about today — fuels better suggestions."
          />
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

      {/* On a tablet the sidebar panels sit two-up instead of stretching to full
          width; from `lg` they return to a single column beside the day. */}
      <div className="grid items-start gap-4 sm:gap-5 md:grid-cols-2 lg:grid-cols-1">
        <Panel className="flex items-center gap-4 sm:gap-5">
          <Ring value={score} label="today" />
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2 font-display text-base font-semibold sm:text-lg">
              <Flame className="size-4 shrink-0 text-primary" /> {s.current}-day streak
            </div>
            <p className="text-sm text-muted-foreground">Best ever: {s.best} days</p>
            <p className="text-xs text-muted-foreground">Counted when a day closes above 70%.</p>
          </div>
        </Panel>

        <div className="grid grid-cols-2 gap-3">
          <Stat
            value={`${blocks.filter((x) => (entries[x.id] ?? 0) >= 100).length}/${blocks.length}`}
            label="Blocks cleared"
          />
          {/* §9.4: the balance comes from the append-only ledger, not a recount. */}
          <Stat value={`${debtBalance(state)}`} label="Open debt" />
        </div>

        <DailyClose state={state} onLog={setPct} />

        <Panel>
          <PanelTitle
            title="Debt & catch-up"
            hint="Skipped must-do blocks from the last 14 days."
          />
          <div className="space-y-2">
            {debt.length === 0 ? (
              <p className="text-sm text-muted-foreground">Clean slate. Nothing owed.</p>
            ) : (
              debt.map(({ date, block }, i) => (
                <div key={`${date}-${block.id}-${i}`} className="flex items-center gap-2 text-sm">
                  <AlertTriangle className="size-3.5 shrink-0 text-primary" />
                  <span className="flex-1 truncate">{block.title}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{date.slice(5)}</span>
                </div>
              ))
            )}
          </div>
          {debt.length > 0 ? (
            <Button
              variant="secondary"
              size="sm"
              className="tap mt-4 w-full"
              onClick={() => void proposeCatchUp()}
            >
              Propose a catch-up plan
            </Button>
          ) : null}
        </Panel>

        <TelegramPanel hourFormat={hourFormat} />

        <FocusTimer state={state} update={update} startRequest={focusReq} />
      </div>
    </div>
  );
}

/**
 * §5.7 Daily Close — a UI composition, not a new domain. Surfaces unfinished
 * must items, tomorrow's preview and the reflection in one place so the
 * end-of-day ritual is a single pass instead of three notifications.
 */
function DailyClose({
  state,
  onLog,
}: {
  state: OrdoState;
  onLog: (blockId: string, pct: number) => void;
}) {
  const today = new Date();
  const key = dateKey(today);
  const blocks = blocksFor(state, today);
  const entries = state.log[key] ?? {};
  const unfinished = blocks.filter((b) => (entries[b.id] ?? 0) < 100);
  const tomorrow = blocksFor(state, addDays(today, 1));

  if (unfinished.length === 0 && tomorrow.length === 0) return null;

  return (
    <Panel>
      <PanelTitle
        title="Daily close"
        hint="Finish the day in one pass — log what's left, peek at tomorrow."
      />
      {unfinished.length > 0 ? (
        <div className="space-y-1.5">
          {unfinished.map((b) => (
            <div key={b.id} className="flex items-center gap-2 text-sm">
              <MoonStar className="size-3.5 shrink-0 text-primary" />
              <span className="min-w-0 flex-1 truncate">
                {b.title}
                {b.priority === "must" ? (
                  <span className="ml-1.5 rounded bg-muted px-1 py-0.5 text-[9px] uppercase tracking-wide text-muted-foreground">
                    must
                  </span>
                ) : null}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="tap shrink-0"
                onClick={() => onLog(b.id, 100)}
              >
                Log done
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Everything logged. Nothing left to close out.
        </p>
      )}
      {tomorrow.length > 0 ? (
        <div className="mt-3 border-t border-border pt-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Tomorrow · {tomorrow.length} blocks
          </p>
          <p className="mt-1 truncate text-sm text-muted-foreground">
            {tomorrow
              .slice(0, 3)
              .map((b) => b.title)
              .join(", ")}
            {tomorrow.length > 3 ? ` +${tomorrow.length - 3} more` : ""}
          </p>
        </div>
      ) : null}
    </Panel>
  );
}

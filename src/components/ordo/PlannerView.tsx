import { useMemo, useState } from "react";
import {
  addDays,
  blocksFor,
  dateKey,
  formatTimeRange,
  hourFormatOf,
  type Block,
  type OrdoState,
} from "@/lib/ordo";
import { newTask, tasksForDate, type Task } from "@/lib/domain";
import { CategoryPill, Panel, PanelTitle } from "./primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CalendarDays, ChevronLeft, ChevronRight, Inbox, Trash2 } from "lucide-react";
import { toast } from "sonner";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** One row in the planner timeline — a routine instance or a scheduled task. */
type Entry =
  | { kind: "routine"; start: string; end: string; block: Block }
  | { kind: "task"; start: string; end: string; task: Task };

export function PlannerView({
  state,
  update,
}: {
  state: OrdoState;
  update: (fn: (s: OrdoState) => OrdoState) => void;
}) {
  const hourFormat = hourFormatOf(state);
  const [offset, setOffset] = useState(0);
  const [inboxTitle, setInboxTitle] = useState("");
  const day = addDays(new Date(), offset);
  const key = dateKey(day);

  const tasks = state.tasks ?? [];
  const inbox = tasks.filter((t) => t.status === "todo" && !t.scheduledDate);

  const entries: Entry[] = useMemo(() => {
    const list: Entry[] = blocksFor(state, day).map((b) => ({
      kind: "routine" as const,
      start: b.start,
      end: b.end,
      block: b,
    }));
    for (const t of tasksForDate(state, day)) {
      list.push({
        kind: "task",
        start: t.scheduledStart ?? "23:59",
        end: t.scheduledEnd ?? "23:59",
        task: t,
      });
    }
    return list.sort((a, b) => a.start.localeCompare(b.start));
  }, [state, day]);

  const addTask = () => {
    const title = inboxTitle.trim();
    if (!title) return;
    update((prev) => ({ ...prev, tasks: [...(prev.tasks ?? []), newTask(title)] }));
    setInboxTitle("");
  };

  const patchTask = (id: string, p: Partial<Task>) =>
    update((prev) => ({
      ...prev,
      tasks: (prev.tasks ?? []).map((t) =>
        t.id === id ? { ...t, ...p, updatedAt: new Date().toISOString() } : t,
      ),
    }));

  const removeTask = (id: string) =>
    update((prev) => ({ ...prev, tasks: (prev.tasks ?? []).filter((t) => t.id !== id) }));

  const scheduleTo = (t: Task, dateK: string) =>
    patchTask(t.id, { scheduledDate: dateK, updatedAt: new Date().toISOString() });

  return (
    <div className="grid gap-4 sm:gap-5 lg:grid-cols-[1.6fr_1fr]">
      <Panel>
        <PanelTitle
          title={day.toLocaleDateString(undefined, {
            weekday: "long",
            month: "short",
            day: "numeric",
          })}
          hint="Routine blocks and time-blocked tasks, side by side."
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
          {entries.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Nothing planned. Schedule a task from the inbox or build a routine.
            </p>
          ) : null}
          {entries.map((e) =>
            e.kind === "routine" ? (
              <div
                key={`r-${e.block.id}`}
                className="flex items-center gap-3 rounded-lg border border-border bg-background/40 p-3"
              >
                <span className="w-24 shrink-0 font-display text-sm tabular-nums text-muted-foreground">
                  {formatTimeRange(e.start, e.end, hourFormat)}
                </span>
                <span className="min-w-0 flex-1 truncate">{e.block.title}</span>
                <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                  Routine
                </span>
                <CategoryPill id={e.block.category} icon />
              </div>
            ) : (
              <div
                key={`t-${e.task.id}`}
                className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3"
              >
                <span className="w-24 shrink-0 font-display text-sm tabular-nums text-muted-foreground">
                  {e.task.scheduledStart ? formatTimeRange(e.start, e.end, hourFormat) : "—"}
                </span>
                <span className="min-w-0 flex-1 truncate">{e.task.title}</span>
                <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                  Task
                </span>
                {e.task.priority === "must" ? (
                  <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                    must
                  </span>
                ) : null}
                <Button
                  variant="ghost"
                  size="icon"
                  className="tap shrink-0"
                  aria-label={`Unschedule ${e.task.title}`}
                  onClick={() =>
                    update((prev) => ({
                      ...prev,
                      tasks: (prev.tasks ?? []).map((t) => {
                        if (t.id !== e.task.id) return t;
                        const {
                          scheduledDate: _d,
                          scheduledStart: _s,
                          scheduledEnd: _e,
                          ...rest
                        } = t;
                        return { ...rest, updatedAt: new Date().toISOString() };
                      }),
                    }))
                  }
                >
                  <CalendarDays className="size-4" />
                </Button>
              </div>
            ),
          )}
        </div>
      </Panel>

      <div className="grid items-start gap-4 sm:gap-5 md:grid-cols-2 lg:grid-cols-1">
        <Panel>
          <PanelTitle title="Inbox" hint="One-off tasks with no time slot yet." />
          <div className="flex gap-2">
            <Input
              value={inboxTitle}
              placeholder="e.g. Finish database assignment"
              aria-label="New task title"
              onChange={(e) => setInboxTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addTask()}
            />
            <Button size="sm" className="tap shrink-0" onClick={addTask}>
              <Inbox className="size-4" />
              <span className="sm:hidden">Add</span>
            </Button>
          </div>
          <div className="mt-3 space-y-2">
            {inbox.length === 0 ? (
              <p className="text-sm text-muted-foreground">Inbox zero.</p>
            ) : null}
            {inbox.map((t) => (
              <div
                key={t.id}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-2 text-sm"
              >
                <span className="min-w-0 flex-1 truncate">{t.title}</span>
                <select
                  value={t.priority}
                  aria-label={`Priority for ${t.title}`}
                  onChange={(e) => patchTask(t.id, { priority: e.target.value as "must" | "nice" })}
                  className="h-8 rounded-md border border-input bg-background px-1.5 text-xs"
                >
                  <option value="must">must</option>
                  <option value="nice">nice</option>
                </select>
                <select
                  value=""
                  aria-label={`Schedule ${t.title} to`}
                  onChange={(e) => {
                    if (!e.target.value) return;
                    scheduleTo(t, e.target.value);
                    toast.success("Scheduled");
                  }}
                  className="h-8 rounded-md border border-input bg-background px-1.5 text-xs"
                >
                  <option value="">Schedule to…</option>
                  {DAYS.map((d, i) => (
                    <option key={d} value={dateKey(addDays(new Date(), i))}>
                      {i === 0 ? "Today" : d} · {dateKey(addDays(new Date(), i)).slice(5)}
                    </option>
                  ))}
                </select>
                <Button
                  variant="ghost"
                  size="icon"
                  className="tap shrink-0"
                  aria-label={`Delete ${t.title}`}
                  onClick={() => removeTask(t.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        </Panel>

        <Panel>
          <PanelTitle title="Scheduled tasks" hint="Everything time-blocked in the next 7 days." />
          <div className="space-y-2">
            {tasks.filter((t) => t.scheduledDate && t.status === "todo").length === 0 ? (
              <p className="text-sm text-muted-foreground">No scheduled tasks this week.</p>
            ) : null}
            {tasks
              .filter((t) => t.scheduledDate && t.status === "todo")
              .sort((a, b) => (a.scheduledDate ?? "").localeCompare(b.scheduledDate ?? ""))
              .map((t) => (
                <div key={t.id} className="flex items-center gap-2 text-sm">
                  <span className="w-14 shrink-0 text-xs text-muted-foreground">
                    {(t.scheduledDate ?? "").slice(5)}
                  </span>
                  <span className="flex-1 truncate">{t.title}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {t.scheduledStart ?? ""}
                  </span>
                </div>
              ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

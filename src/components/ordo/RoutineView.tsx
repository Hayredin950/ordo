import { useState } from "react";
import {
  addDays,
  blocksFor,
  cloneBlocks,
  dateKey,
  formatTime,
  hourFormatOf,
  newBlock,
  startOfWeek,
  type Block,
  type CategoryId,
  type OrdoState,
} from "@/lib/ordo";
import {
  applyRoutineSource,
  applyTemplateToDays,
  deleteTemplate,
  saveTemplate,
  templateBlockCount,
  templateDayCount,
  templateDays,
} from "@/lib/domain";
import { categoryColor, useCategories } from "@/lib/categories";
import { CategoryPill, Panel, PanelTitle, SegButton } from "./primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Copy, Save, Globe } from "lucide-react";
import { toast } from "sonner";
import { PublicTemplates } from "./PublicTemplates";
import { useAuth } from "@/lib/auth-context";
import * as db from "@/lib/db";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function RoutineView({
  state,
  update,
}: {
  state: OrdoState;
  update: (fn: (s: OrdoState) => OrdoState) => void;
}) {
  const { user } = useAuth();
  const { categories } = useCategories();
  const hourFormat = hourFormatOf(state);
  const [dayIdx, setDayIdx] = useState(new Date().getDay());
  const [templateName, setTemplateName] = useState("");
  const [rangeDays, setRangeDays] = useState(30);
  const [publishing, setPublishing] = useState(false);
  const [dupTargets, setDupTargets] = useState<number[]>([]);
  const [dupMode, setDupMode] = useState<"replace" | "merge">("replace");
  const [tplDays, setTplDays] = useState<number[]>([new Date().getDay()]);

  const publishDay = async () => {
    if (!user) {
      toast.info("Sign in to publish templates");
      return;
    }
    const blocks = state.routine[dayIdx] ?? [];
    if (!blocks.length) {
      toast.error("This day has no blocks to publish");
      return;
    }
    const name = templateName.trim() || `${DAYS[dayIdx]} routine`;
    setPublishing(true);
    try {
      await db.publishTemplate(name, cloneBlocks(blocks));
      toast.success(`Published “${name}” to the shared library`);
      setTemplateName("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not publish");
    } finally {
      setPublishing(false);
    }
  };
  const blocks = [...(state.routine[dayIdx] ?? [])].sort((a, b) => a.start.localeCompare(b.start));

  const setBlocks = (fn: (b: Block[]) => Block[]) =>
    update((prev) => ({
      ...prev,
      routine: { ...prev.routine, [dayIdx]: fn(prev.routine[dayIdx] ?? []) },
    }));

  const patch = (id: string, p: Partial<Block>) =>
    setBlocks((bs) => bs.map((b) => (b.id === id ? { ...b, ...p } : b)));

  const applyWeekdays = () =>
    update((prev) => {
      const next = { ...prev.routine };
      for (const d of [1, 2, 3, 4, 5]) next[d] = cloneBlocks(prev.routine[dayIdx] ?? []);
      return { ...prev, routine: next };
    });

  const applyRange = () =>
    update((prev) => {
      const overrides = { ...prev.overrides };
      for (let i = 0; i < rangeDays; i++) {
        overrides[dateKey(addDays(new Date(), i))] = cloneBlocks(prev.routine[dayIdx] ?? []);
      }
      return { ...prev, overrides };
    });

  return (
    <div className="grid gap-4 sm:gap-5 lg:grid-cols-[1.6fr_1fr]">
      <Panel>
        <PanelTitle
          title="Default routine"
          hint="The plan. What actually happened lives in the daily log."
          action={
            <Button
              size="sm"
              className="tap w-full sm:w-auto"
              onClick={() => setBlocks((bs) => [...bs, newBlock()])}
            >
              <Plus className="size-4" /> Block
            </Button>
          }
        />

        {/* Seven equal columns fit a 320px phone; the labels are already 3 chars. */}
        <div className="mb-4 grid grid-cols-7 gap-1" role="group" aria-label="Day of week">
          {DAYS.map((d, i) => (
            <SegButton key={d} active={i === dayIdx} className="px-0" onClick={() => setDayIdx(i)}>
              {d}
            </SegButton>
          ))}
        </div>

        <div className="space-y-2">
          {blocks.map((b) => (
            /* One line from `sm` up; on a phone it becomes three stacked rows —
               times side by side, then the title, then category/priority/delete. */
            <div
              key={b.id}
              className="grid gap-2 rounded-lg border border-border bg-background/40 p-3 sm:flex sm:flex-wrap sm:items-center"
            >
              {/* Wide enough for the widest thing a browser draws in here:
                  "05:30 AM" plus the picker icon. The control is rendered from
                  the OS locale, not from the app's clock preference, so it has
                  to fit the 12-hour form even for a 24-hour reader. */}
              <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
                <Input
                  value={b.start}
                  type="time"
                  className="sm:w-[8.5rem]"
                  aria-label="Start time"
                  onChange={(e) => patch(b.id, { start: e.target.value })}
                />
                <Input
                  value={b.end}
                  type="time"
                  className="sm:w-[8.5rem]"
                  aria-label="End time"
                  onChange={(e) => patch(b.id, { end: e.target.value })}
                />
              </div>
              <Input
                value={b.title}
                className="sm:min-w-40 sm:flex-1"
                aria-label="Block title"
                onChange={(e) => patch(b.id, { title: e.target.value })}
              />
              <div className="flex items-center gap-2 sm:contents">
                <select
                  value={b.category}
                  aria-label="Category"
                  onChange={(e) => patch(b.id, { category: e.target.value as CategoryId })}
                  className="h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-sm sm:h-9 sm:flex-none"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                  {/* An id from a category that has since been deleted would
                      otherwise silently reset the block to the first option. */}
                  {categories.some((c) => c.id === b.category) ? null : (
                    <option value={b.category}>{b.category}</option>
                  )}
                </select>
                <button
                  type="button"
                  aria-label={`Priority: ${b.priority}. Tap to toggle.`}
                  onClick={() => patch(b.id, { priority: b.priority === "must" ? "nice" : "must" })}
                  className="tap h-10 shrink-0 rounded-md bg-muted px-2.5 text-[11px] uppercase tracking-wide text-muted-foreground hover:bg-accent sm:h-9"
                >
                  {b.priority}
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="tap shrink-0"
                  aria-label="Delete block"
                  onClick={() => setBlocks((bs) => bs.filter((x) => x.id !== b.id))}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))}
          {blocks.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No blocks on {DAYS[dayIdx]} yet.
            </p>
          ) : null}
        </div>
      </Panel>

      <div className="grid items-start gap-4 sm:gap-5 md:grid-cols-2 lg:grid-cols-1">
        <Panel>
          <PanelTitle
            title="Duplicate this day"
            hint={`Copy ${DAYS[dayIdx]}'s schedule to other days in one action.`}
          />
          <div
            className="mb-2 grid grid-cols-3 gap-1 sm:flex sm:flex-wrap"
            role="group"
            aria-label="Target days"
          >
            {DAYS.map((d, i) =>
              i === dayIdx ? null : (
                <label
                  key={d}
                  className={`tap flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-2 text-sm sm:py-1.5 ${
                    dupTargets.includes(i)
                      ? "bg-primary/10 text-foreground"
                      : "bg-muted text-muted-foreground hover:bg-accent"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="accent-primary"
                    checked={dupTargets.includes(i)}
                    onChange={(e) =>
                      setDupTargets((prev) =>
                        e.target.checked ? [...prev, i] : prev.filter((x) => x !== i),
                      )
                    }
                  />
                  {d}
                </label>
              ),
            )}
          </div>
          {dupTargets.length > 0 && dupMode === "replace" ? (
            <p className="mb-2 rounded-md bg-destructive/10 px-2 py-1.5 text-xs text-destructive">
              {dupTargets
                .filter((i) => (state.routine[i] ?? []).length > 0)
                .map((i) => DAYS[i])
                .join(", ") || "No days"}{" "}
              {dupTargets.filter((i) => (state.routine[i] ?? []).length > 0).length === 1
                ? "already has blocks — they will be replaced."
                : "already have blocks — they will be replaced."}
            </p>
          ) : null}
          <div className="mb-3 flex items-center justify-between gap-2 text-sm">
            <label className="flex cursor-pointer items-center gap-2 text-muted-foreground">
              <input
                type="checkbox"
                className="accent-primary"
                checked={dupMode === "merge"}
                onChange={(e) => setDupMode(e.target.checked ? "merge" : "replace")}
              />
              Merge instead of replace
            </label>
            <Button
              size="sm"
              className="tap"
              disabled={!dupTargets.length || !(state.routine[dayIdx] ?? []).length}
              onClick={() => {
                const names = dupTargets.map((i) => DAYS[i]).join(", ");
                update(
                  (prev) =>
                    applyRoutineSource(
                      prev,
                      { kind: "day", dayOfWeek: dayIdx },
                      dupTargets,
                      dupMode,
                    ).state,
                );
                setDupTargets([]);
                toast.success(`Copied to ${names}`);
              }}
            >
              <Copy className="size-4" /> Copy to {dupTargets.length || 0} day
              {dupTargets.length === 1 ? "" : "s"}
            </Button>
          </div>
          <Button
            variant="secondary"
            size="sm"
            className="tap w-full"
            onClick={() => {
              applyWeekdays();
              toast.success("Applied to Mon–Fri");
            }}
          >
            Apply to every weekday
          </Button>
          <div className="mt-3 flex items-center gap-2">
            <Input
              type="number"
              min={1}
              max={365}
              value={rangeDays}
              aria-label="Days in range"
              onChange={(e) => setRangeDays(Number(e.target.value) || 1)}
              className="w-20 shrink-0"
            />
            <Button
              variant="secondary"
              size="sm"
              className="tap flex-1"
              onClick={() => {
                applyRange();
                toast.success(`Applied across the next ${rangeDays} days`);
              }}
            >
              Apply to date range
            </Button>
          </div>
        </Panel>

        <Panel>
          <PanelTitle
            title="Template library"
            hint="Snapshot any set of days, reapply them any time — or share one."
          />
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={templateName}
              placeholder="e.g. Exam week"
              onChange={(e) => setTemplateName(e.target.value)}
              aria-label="Template name"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                className="tap flex-1 sm:flex-none"
                disabled={!templateName.trim() || !tplDays.length}
                onClick={() => {
                  if (!templateName.trim()) return;
                  update((prev) => saveTemplate(prev, templateName.trim(), tplDays).state);
                  setTemplateName("");
                  toast.success(
                    `Template saved (${tplDays.length} day${tplDays.length === 1 ? "" : "s"})`,
                  );
                }}
              >
                <Save className="size-4" />
                <span className="sm:hidden">Save</span>
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="tap flex-1 sm:flex-none"
                disabled={publishing}
                onClick={() => void publishDay()}
              >
                <Globe className="size-4" /> Publish
              </Button>
            </div>
          </div>
          <div
            className="mt-2 flex flex-wrap gap-1"
            role="group"
            aria-label="Days to include in template"
          >
            {DAYS.map((d, i) => (
              <label
                key={d}
                className={`tap cursor-pointer rounded-md px-2.5 py-1 text-xs ${
                  tplDays.includes(i)
                    ? "bg-primary/10 text-foreground"
                    : "bg-muted text-muted-foreground hover:bg-accent"
                }`}
              >
                <input
                  type="checkbox"
                  className="mr-1 accent-primary"
                  checked={tplDays.includes(i)}
                  onChange={(e) =>
                    setTplDays((prev) =>
                      e.target.checked ? [...prev, i] : prev.filter((x) => x !== i),
                    )
                  }
                />
                {d}
              </label>
            ))}
          </div>
          <div className="mt-3 space-y-2">
            {state.templates.length === 0 ? (
              <p className="text-sm text-muted-foreground">No templates saved yet.</p>
            ) : null}
            {state.templates.map((t) => {
              const dayCount = templateDayCount(t);
              const blocks = templateBlockCount(t);
              return (
                <div
                  key={t.id}
                  className="flex items-center gap-2 rounded-lg border border-border p-2 text-sm"
                >
                  <span className="min-w-0 flex-1 truncate">{t.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {dayCount > 0 ? `${dayCount} day${dayCount === 1 ? "" : "s"} · ` : ""}
                    {blocks} blocks
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="tap shrink-0"
                    onClick={() => {
                      const targets = dayCount > 0 ? [] : [dayIdx];
                      const willReplace = (
                        dayCount > 0
                          ? Object.keys(templateDays(t))
                              .map(Number)
                              .filter((d) => d >= 0)
                          : targets
                      ).some((d) => (state.routine[d] ?? []).length > 0);
                      if (
                        willReplace &&
                        !confirm(
                          `Apply “${t.name}”? Existing blocks on the target days will be replaced.`,
                        )
                      ) {
                        return;
                      }
                      update((prev) => applyTemplateToDays(prev, t.id, targets, "replace").state);
                      toast.success(
                        dayCount > 0
                          ? `Applied “${t.name}” to its saved days`
                          : `Applied “${t.name}” to ${DAYS[dayIdx]}`,
                      );
                    }}
                  >
                    Apply
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="tap shrink-0"
                    aria-label={`Delete template ${t.name}`}
                    onClick={() => {
                      update((prev) => deleteTemplate(prev, t.id));
                      toast.success(`Deleted “${t.name}”`);
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        </Panel>

        <PublicTemplates
          dayIdx={dayIdx}
          onApply={(blocks) => {
            update((prev) => ({ ...prev, routine: { ...prev.routine, [dayIdx]: blocks } }));
          }}
        />

        <Panel>
          <PanelTitle title="Week at a glance" hint="One bar per block, coloured by category." />
          <div className="grid grid-cols-7 gap-1 text-center">
            {DAYS.map((d, i) => {
              const list = blocksFor(state, addDays(startOfWeek(new Date()), i));
              return (
                <div key={d} className="rounded-md border border-border p-1 sm:p-2">
                  <div className="text-[11px] text-muted-foreground">{d}</div>
                  <div className="mt-1 flex min-h-6 flex-col items-center gap-1">
                    {list.slice(0, 5).map((b) => (
                      <span
                        key={b.id}
                        title={`${formatTime(b.start, hourFormat)} ${b.title}`}
                        className="h-1.5 w-full rounded-full"
                        style={{ backgroundColor: categoryColor(categories, b.category) }}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap gap-1">
            {categories.map((c) => (
              <CategoryPill key={c.id} id={c.id} icon />
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

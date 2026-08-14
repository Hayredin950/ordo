import { useState } from "react";
import {
  CATEGORIES,
  addDays,
  blocksFor,
  cloneBlocks,
  dateKey,
  newBlock,
  newId,
  startOfWeek,
  type Block,
  type CategoryId,
  type OrdoState,
} from "@/lib/ordo";
import { CategoryPill, Panel, PanelTitle } from "./primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Copy, Save } from "lucide-react";
import { toast } from "sonner";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function RoutineView({
  state,
  update,
}: {
  state: OrdoState;
  update: (fn: (s: OrdoState) => OrdoState) => void;
}) {
  const [dayIdx, setDayIdx] = useState(new Date().getDay());
  const [templateName, setTemplateName] = useState("");
  const [rangeDays, setRangeDays] = useState(30);
  const blocks = [...(state.routine[dayIdx] ?? [])].sort((a, b) => a.start.localeCompare(b.start));

  const setBlocks = (fn: (b: Block[]) => Block[]) =>
    update((prev) => ({ ...prev, routine: { ...prev.routine, [dayIdx]: fn(prev.routine[dayIdx] ?? []) } }));

  const patch = (id: string, p: Partial<Block>) =>
    setBlocks((bs) => bs.map((b) => (b.id === id ? { ...b, ...p } : b)));

  const copyTo = (target: number) =>
    update((prev) => ({ ...prev, routine: { ...prev.routine, [target]: cloneBlocks(prev.routine[dayIdx] ?? []) } }));

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
    <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
      <Panel>
        <PanelTitle
          title="Default routine"
          hint="The plan. What actually happened lives in the daily log."
          action={
            <Button size="sm" onClick={() => setBlocks((bs) => [...bs, newBlock()])}>
              <Plus className="mr-1 size-4" /> Block
            </Button>
          }
        />

        <div className="mb-4 flex flex-wrap gap-1">
          {DAYS.map((d, i) => (
            <button
              key={d}
              onClick={() => setDayIdx(i)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                i === dayIdx ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"
              }`}
            >
              {d}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          {blocks.map((b) => (
            <div key={b.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-background/40 p-3">
              <Input
                value={b.start}
                type="time"
                className="w-28"
                aria-label="Start time"
                onChange={(e) => patch(b.id, { start: e.target.value })}
              />
              <Input
                value={b.end}
                type="time"
                className="w-28"
                aria-label="End time"
                onChange={(e) => patch(b.id, { end: e.target.value })}
              />
              <Input
                value={b.title}
                className="min-w-40 flex-1"
                aria-label="Block title"
                onChange={(e) => patch(b.id, { title: e.target.value })}
              />
              <select
                value={b.category}
                aria-label="Category"
                onChange={(e) => patch(b.id, { category: e.target.value as CategoryId })}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
              <button
                onClick={() => patch(b.id, { priority: b.priority === "must" ? "nice" : "must" })}
                className="rounded-md bg-muted px-2 py-1.5 text-[11px] uppercase tracking-wide text-muted-foreground hover:bg-accent"
              >
                {b.priority}
              </button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Delete block"
                onClick={() => setBlocks((bs) => bs.filter((x) => x.id !== b.id))}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          {blocks.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No blocks on {DAYS[dayIdx]} yet.</p>
          ) : null}
        </div>
      </Panel>

      <div className="space-y-5">
        <Panel>
          <PanelTitle title="Duplicate this day" hint={`Copy ${DAYS[dayIdx]}'s schedule elsewhere.`} />
          <div className="mb-3 flex flex-wrap gap-1">
            {DAYS.map((d, i) =>
              i === dayIdx ? null : (
                <button
                  key={d}
                  onClick={() => {
                    copyTo(i);
                    toast.success(`Copied to ${d}`);
                  }}
                  className="rounded-md bg-muted px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent"
                >
                  <Copy className="mr-1 inline size-3.5" />
                  {d}
                </button>
              ),
            )}
          </div>
          <Button
            variant="secondary"
            size="sm"
            className="w-full"
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
              className="w-24"
            />
            <Button
              variant="secondary"
              size="sm"
              className="flex-1"
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
          <PanelTitle title="Template library" hint="Save any day, reuse it any time." />
          <div className="flex gap-2">
            <Input
              value={templateName}
              placeholder="e.g. Exam week"
              onChange={(e) => setTemplateName(e.target.value)}
            />
            <Button
              size="sm"
              onClick={() => {
                if (!templateName.trim()) return;
                update((prev) => ({
                  ...prev,
                  templates: [
                    ...prev.templates,
                    { id: newId(), name: templateName.trim(), blocks: cloneBlocks(prev.routine[dayIdx] ?? []) },
                  ],
                }));
                setTemplateName("");
                toast.success("Template saved");
              }}
            >
              <Save className="size-4" />
            </Button>
          </div>
          <div className="mt-3 space-y-2">
            {state.templates.map((t) => (
              <div key={t.id} className="flex items-center gap-2 rounded-lg border border-border p-2 text-sm">
                <span className="flex-1 truncate">{t.name}</span>
                <span className="text-xs text-muted-foreground">{t.blocks.length} blocks</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    update((prev) => ({ ...prev, routine: { ...prev.routine, [dayIdx]: cloneBlocks(t.blocks) } }));
                    toast.success(`Applied “${t.name}” to ${DAYS[dayIdx]}`);
                  }}
                >
                  Apply
                </Button>
              </div>
            ))}
          </div>
        </Panel>

        <Panel>
          <PanelTitle title="Week at a glance" />
          <div className="grid grid-cols-7 gap-1 text-center">
            {DAYS.map((d, i) => {
              const list = blocksFor(state, addDays(startOfWeek(new Date()), i));
              return (
                <div key={d} className="rounded-md border border-border p-2">
                  <div className="text-[11px] text-muted-foreground">{d}</div>
                  <div className="mt-1 flex flex-col items-center gap-1">
                    {list.slice(0, 5).map((b) => (
                      <span
                        key={b.id}
                        className="h-1.5 w-full rounded-full"
                        style={{ backgroundColor: `var(--cat-${b.category})` }}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap gap-1">
            {CATEGORIES.map((c) => (
              <CategoryPill key={c.id} id={c.id} />
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

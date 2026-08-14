import { useState } from "react";
import {
  CATEGORIES,
  addDays,
  newId,
  rangeScore,
  startOfWeek,
  type CategoryId,
  type Goal,
  type OrdoState,
} from "@/lib/ordo";
import { CategoryPill, Panel, PanelTitle } from "./primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Plus, Trash2 } from "lucide-react";

const PERIODS: Goal["period"][] = ["year", "semester", "month", "week", "day"];

const periodScore = (state: OrdoState, period: Goal["period"]) => {
  const today = new Date();
  switch (period) {
    case "day":
      return rangeScore(state, today, 1);
    case "week":
      return rangeScore(state, startOfWeek(today), 7);
    case "month":
      return rangeScore(state, addDays(today, -29), 30);
    case "semester":
      return rangeScore(state, addDays(today, -119), 120);
    default:
      return rangeScore(state, addDays(today, -179), 180);
  }
};

export function GoalsView({
  state,
  update,
}: {
  state: OrdoState;
  update: (fn: (s: OrdoState) => OrdoState) => void;
}) {
  const [title, setTitle] = useState("");
  const [period, setPeriod] = useState<Goal["period"]>("week");
  const [category, setCategory] = useState<CategoryId>("study");

  const add = () => {
    if (!title.trim()) return;
    update((prev) => ({
      ...prev,
      goals: [...prev.goals, { id: newId(), title: title.trim(), period, category, target: 80 }],
    }));
    setTitle("");
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
      <Panel>
        <PanelTitle title="Goal hierarchy" hint="Year rolls down to the day; the day rolls back up." />
        <div className="space-y-6">
          {PERIODS.map((p) => {
            const goals = state.goals.filter((g) => g.period === p);
            const actual = periodScore(state, p);
            return (
              <div key={p}>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="font-display text-sm uppercase tracking-widest text-muted-foreground">{p}</h3>
                  <span className="text-xs text-muted-foreground">rollup {actual}%</span>
                </div>
                <div className="space-y-2">
                  {goals.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No {p} goal set.</p>
                  ) : null}
                  {goals.map((g) => (
                    <div key={g.id} className="rounded-lg border border-border bg-background/40 p-3">
                      <div className="flex items-center gap-2">
                        <span className="flex-1">{g.title}</span>
                        <CategoryPill id={g.category} />
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Delete goal"
                          onClick={() =>
                            update((prev) => ({ ...prev, goals: prev.goals.filter((x) => x.id !== g.id) }))
                          }
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                      <div className="mt-2 flex items-center gap-3">
                        <Progress value={Math.min(100, (actual / g.target) * 100)} className="h-2 flex-1" />
                        <span className="w-24 text-right text-xs tabular-nums text-muted-foreground">
                          {actual}% / {g.target}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Panel>

      <div className="space-y-5">
        <Panel>
          <PanelTitle title="New goal" />
          <div className="space-y-2">
            <Input value={title} placeholder="What do you want to be true?" onChange={(e) => setTitle(e.target.value)} />
            <div className="flex gap-2">
              <select
                value={period}
                aria-label="Period"
                onChange={(e) => setPeriod(e.target.value as Goal["period"])}
                className="h-9 flex-1 rounded-md border border-input bg-background px-2 text-sm"
              >
                {PERIODS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <select
                value={category}
                aria-label="Category"
                onChange={(e) => setCategory(e.target.value as CategoryId)}
                className="h-9 flex-1 rounded-md border border-input bg-background px-2 text-sm"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <Button className="w-full" onClick={add}>
              <Plus className="mr-1 size-4" /> Add goal
            </Button>
          </div>
        </Panel>

        <Panel>
          <PanelTitle title="Future-self letter" hint="Sealed until the year goal's deadline." />
          <p className="text-sm text-muted-foreground">
            Written on Jan 1 · unlocks Dec 31. The bot delivers it the day the goal closes — win or lose.
          </p>
        </Panel>
      </div>
    </div>
  );
}

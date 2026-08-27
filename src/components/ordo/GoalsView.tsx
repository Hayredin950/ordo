import { useCallback, useEffect, useState } from "react";
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
import { useAuth } from "@/lib/auth-context";
import * as db from "@/lib/db";
import type { FutureLetter } from "@/lib/db";
import { CategoryPill, Panel, PanelTitle } from "./primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Plus, Trash2, Mail, Lock, Loader2 } from "lucide-react";
import { toast } from "sonner";

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
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [period, setPeriod] = useState<Goal["period"]>("week");
  const [category, setCategory] = useState<CategoryId>("study");

  // Future-self letters
  const [letters, setLetters] = useState<FutureLetter[] | null>(null);
  const [letterTitle, setLetterTitle] = useState("");
  const [letterDeadline, setLetterDeadline] = useState("");
  const [letterBody, setLetterBody] = useState("");
  const [letterBusy, setLetterBusy] = useState(false);

  const loadLetters = useCallback(async () => {
    if (!user) return;
    try {
      setLetters(await db.listLetters());
    } catch {
      setLetters([]);
    }
  }, [user]);

  useEffect(() => {
    void loadLetters();
  }, [loadLetters]);

  const saveLetter = async () => {
    if (!user || !letterTitle.trim() || !letterDeadline || !letterBody.trim()) return;
    setLetterBusy(true);
    try {
      await db.createLetter({
        goal_title: letterTitle.trim(),
        body: letterBody.trim(),
        deadline: letterDeadline,
        userId: user.id,
      });
      toast.success("Letter sealed — the bot delivers it on the deadline.");
      setLetterTitle("");
      setLetterDeadline("");
      setLetterBody("");
      void loadLetters();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save letter");
    } finally {
      setLetterBusy(false);
    }
  };

  const deleteLetter = async (id: string) => {
    try {
      await db.deleteLetter(id);
      setLetters((ls) => (ls ? ls.filter((l) => l.id !== id) : ls));
      toast.success("Letter deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete letter");
    }
  };

  const add = () => {
    if (!title.trim()) return;
    update((prev) => ({
      ...prev,
      goals: [...prev.goals, { id: newId(), title: title.trim(), period, category, target: 80 }],
    }));
    setTitle("");
  };

  return (
    <div className="grid gap-4 sm:gap-5 lg:grid-cols-[1.6fr_1fr]">
      <Panel>
        <PanelTitle
          title="Goal hierarchy"
          hint="Year rolls down to the day; the day rolls back up."
        />
        <div className="space-y-6">
          {PERIODS.map((p) => {
            const goals = state.goals.filter((g) => g.period === p);
            const actual = periodScore(state, p);
            return (
              <div key={p}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="font-display text-sm uppercase tracking-widest text-muted-foreground">
                    {p}
                  </h3>
                  <span className="shrink-0 text-xs text-muted-foreground">rollup {actual}%</span>
                </div>
                <div className="space-y-2">
                  {goals.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No {p} goal set.</p>
                  ) : null}
                  {goals.map((g) => (
                    <div
                      key={g.id}
                      className="rounded-lg border border-border bg-background/40 p-3"
                    >
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="break-words text-sm sm:text-base">{g.title}</p>
                          <div className="mt-1.5">
                            <CategoryPill id={g.category} />
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="tap -mr-1 shrink-0"
                          aria-label={`Delete goal: ${g.title}`}
                          onClick={() =>
                            update((prev) => ({
                              ...prev,
                              goals: prev.goals.filter((x) => x.id !== g.id),
                            }))
                          }
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                      <div className="mt-2 flex items-center gap-3">
                        <Progress
                          value={Math.min(100, (actual / g.target) * 100)}
                          className="h-2 flex-1"
                        />
                        <span className="shrink-0 text-right text-xs tabular-nums text-muted-foreground">
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

      <div className="grid items-start gap-4 sm:gap-5 md:grid-cols-2 lg:grid-cols-1">
        <Panel>
          <PanelTitle title="New goal" />
          <div className="space-y-2">
            <Input
              value={title}
              placeholder="What do you want to be true?"
              onChange={(e) => setTitle(e.target.value)}
            />
            <div className="flex gap-2">
              <select
                value={period}
                aria-label="Period"
                onChange={(e) => setPeriod(e.target.value as Goal["period"])}
                className="h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-sm sm:h-9"
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
                className="h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-sm sm:h-9"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <Button className="tap w-full" onClick={add}>
              <Plus className="size-4" /> Add goal
            </Button>
          </div>
        </Panel>

        <Panel>
          <PanelTitle
            title="Future-self letter"
            hint="Sealed until the deadline, delivered by the bot — win or lose."
          />
          {!user ? (
            <p className="text-sm text-muted-foreground">
              Sign in to write a letter to your future self. It stays sealed until the deadline you
              set, then the bot delivers it — win or lose.
            </p>
          ) : (
            <div className="space-y-3">
              <div className="space-y-2">
                <Input
                  value={letterTitle}
                  placeholder="Sealed for which goal? e.g. Ship Ordo"
                  onChange={(e) => setLetterTitle(e.target.value)}
                />
                <Input
                  value={letterDeadline}
                  type="date"
                  aria-label="Delivery date"
                  onChange={(e) => setLetterDeadline(e.target.value)}
                />
                <Textarea
                  value={letterBody}
                  placeholder="What do you want to tell the person who reaches that day?"
                  rows={4}
                  onChange={(e) => setLetterBody(e.target.value)}
                />
                <Button
                  className="tap w-full"
                  disabled={
                    letterBusy || !letterTitle.trim() || !letterDeadline || !letterBody.trim()
                  }
                  onClick={() => void saveLetter()}
                >
                  {letterBusy ? (
                    <Loader2 className="mr-1 size-4 animate-spin" />
                  ) : (
                    <Lock className="mr-1 size-4" />
                  )}
                  Seal the letter
                </Button>
              </div>
              <div className="space-y-2 border-t border-border pt-3">
                {!letters?.length ? (
                  <p className="text-sm text-muted-foreground">No letters sealed yet.</p>
                ) : (
                  letters.map((l) => (
                    <div
                      key={l.id}
                      className="flex items-start gap-2 rounded-lg border border-border p-3 text-sm"
                    >
                      <Mail className="mt-0.5 size-4 shrink-0 text-primary" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{l.goal_title}</div>
                        <div className="text-xs text-muted-foreground">
                          delivers {l.deadline} · {l.delivered ? "delivered ✓" : "sealed"}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="tap -mr-1 shrink-0"
                        aria-label={`Delete letter: ${l.goal_title}`}
                        onClick={() => void deleteLetter(l.id)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

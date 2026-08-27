import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import * as db from "@/lib/db";
import type { OrdoState } from "@/lib/ordo";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Circle } from "lucide-react";

const STEPS = [
  {
    key: "goal_set",
    label: "Set your first goal",
    hint: "Goals tab → add a goal at any time scale.",
  },
  { key: "routine_set", label: "Build a routine", hint: "Routine tab → add blocks to your week." },
  {
    key: "telegram_linked",
    label: "Connect a notification channel",
    hint: "Today tab → Telegram (or Slack) panel.",
  },
] as const;

type StepKey = (typeof STEPS)[number]["key"];

export function OnboardingChecklist({ state }: { state: OrdoState }) {
  const { user } = useAuth();
  const [telegramLinked, setTelegramLinked] = useState(false);

  const goalSet = state.goals.length > 0;
  const routineSet = Object.values(state.routine).some((list) => list.length > 0);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      try {
        setTelegramLinked(Boolean(await db.telegramLink()));
      } catch {
        setTelegramLinked(false);
      }
    })();
  }, [user]);

  const done: Record<StepKey, boolean> = {
    goal_set: goalSet,
    routine_set: routineSet,
    telegram_linked: telegramLinked,
  };
  const completed = STEPS.filter((s) => done[s.key]).length;

  // Record newly-completed steps; set_onboarding only ever flips flags to true.
  useEffect(() => {
    if (!user || completed === 0) return;
    const payload: Partial<Record<StepKey, boolean>> = {};
    for (const s of STEPS) if (done[s.key]) payload[s.key] = true;
    void db.setOnboarding(payload).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, goalSet, routineSet, telegramLinked]);

  if (!user || completed === STEPS.length) return null;

  return (
    <div className="panel ordo-grain mb-4 p-4 sm:mb-5 sm:p-5">
      {/* The bar drops under the copy on a phone: a 160px bar and two lines of
          text cannot share a 320px row. */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <div className="min-w-0">
          <p className="font-display text-sm font-semibold">Getting started</p>
          <p className="text-xs text-muted-foreground">
            {completed}/{STEPS.length} done — the last one is what makes the nagging work.
          </p>
        </div>
        <div className="w-full sm:w-40 sm:shrink-0">
          <Progress value={(completed / STEPS.length) * 100} className="h-2" />
        </div>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {STEPS.map((s) =>
          done[s.key] ? (
            <div
              key={s.key}
              className="flex items-center gap-2 rounded-md bg-primary/10 px-3 py-2 text-xs font-medium text-primary"
            >
              <CheckCircle2 className="size-4 shrink-0" /> {s.label}
            </div>
          ) : (
            <div
              key={s.key}
              className="flex items-start gap-2 rounded-md border border-border px-3 py-2 text-xs text-muted-foreground"
            >
              <Circle className="mt-0.5 size-4 shrink-0" />
              <div className="min-w-0">
                <div className="font-medium text-foreground">{s.label}</div>
                <div className="mt-0.5 text-[10px] leading-snug">{s.hint}</div>
              </div>
            </div>
          ),
        )}
      </div>
    </div>
  );
}

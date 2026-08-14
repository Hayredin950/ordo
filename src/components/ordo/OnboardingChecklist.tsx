import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import type { OrdoState } from "@/lib/ordo";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Circle } from "lucide-react";

const STEPS = [
  { key: "goal_set", label: "Set your first goal", hint: "Goals tab → add a goal at any time scale." },
  { key: "routine_set", label: "Build a routine", hint: "Routine tab → add blocks to your week." },
  { key: "telegram_linked", label: "Connect a notification channel", hint: "Today tab → Telegram (or Slack) panel." },
] as const;

type StepKey = (typeof STEPS)[number]["key"];

export function OnboardingChecklist({ state }: { state: OrdoState }) {
  const { user } = useAuth();
  const [telegramLinked, setTelegramLinked] = useState(false);

  const goalSet = state.goals.length > 0;
  const routineSet = Object.values(state.routine).some((list) => list.length > 0);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const res = await apiFetch<{ linked: unknown }>("/api/telegram/status");
        setTelegramLinked(Boolean(res.linked));
      } catch {
        setTelegramLinked(false);
      }
    })();
  }, [user]);

  const done: Record<StepKey, boolean> = { goal_set: goalSet, routine_set: routineSet, telegram_linked: telegramLinked };
  const completed = STEPS.filter((s) => done[s.key]).length;

  // Report newly-completed steps to the server (merges true values only).
  useEffect(() => {
    if (!user || completed === 0) return;
    const payload: Partial<Record<StepKey, boolean>> = {};
    for (const s of STEPS) if (done[s.key]) payload[s.key] = true;
    void apiFetch("/api/onboarding", { method: "POST", json: payload }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, goalSet, routineSet, telegramLinked]);

  if (!user || completed === STEPS.length) return null;

  return (
    <div className="panel ordo-grain mb-5 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-display text-sm font-semibold">Getting started</p>
          <p className="text-xs text-muted-foreground">
            {completed}/{STEPS.length} done — the last one is what makes the nagging work.
          </p>
        </div>
        <div className="w-40">
          <Progress value={(completed / STEPS.length) * 100} className="h-2" />
        </div>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {STEPS.map((s) =>
          done[s.key] ? (
            <div key={s.key} className="flex items-center gap-2 rounded-md bg-primary/10 px-3 py-2 text-xs font-medium text-primary">
              <CheckCircle2 className="size-4 shrink-0" /> {s.label}
            </div>
          ) : (
            <div key={s.key} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs text-muted-foreground">
              <Circle className="size-4 shrink-0" /> <span>{s.label}</span>
              <span className="ml-auto hidden text-[10px] sm:inline">{s.hint}</span>
            </div>
          ),
        )}
      </div>
    </div>
  );
}

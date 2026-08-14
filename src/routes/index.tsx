import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useOrdo, rangeScore, startOfWeek } from "@/lib/ordo";
import { TodayView } from "@/components/ordo/TodayView";
import { RoutineView } from "@/components/ordo/RoutineView";
import { GoalsView } from "@/components/ordo/GoalsView";
import { InsightsView } from "@/components/ordo/InsightsView";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { RotateCcw, Compass } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ordo — Personal Accountability & Goal Tracking" },
      {
        name: "description",
        content:
          "Ordo turns goals into time blocks, logs what actually happened, and holds you accountable with streaks, heatmaps and honest weekly reviews.",
      },
      { property: "og:title", content: "Ordo — Personal Accountability & Goal Tracking" },
      {
        property: "og:description",
        content:
          "Plan your year down to the hour, log reality, and let the data do the nagging. Routines, streaks, heatmaps and coach reviews.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OrdoApp,
});

const TABS = ["Today", "Routine", "Goals", "Insights"] as const;

function OrdoApp() {
  const { state, update, reset } = useOrdo();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Today");

  if (!state) {
    return <div className="min-h-screen" aria-busy="true" />;
  }

  const week = rangeScore(state, startOfWeek(new Date()), 7);

  return (
    <div className="min-h-screen">
      <Toaster />
      <header className="border-b border-border/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Compass className="size-5" />
            </span>
            <div>
              <h1 className="font-display text-xl font-bold leading-none">Ordo</h1>
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                discipline, measured
              </p>
            </div>
          </div>

          <nav className="ml-auto flex flex-wrap gap-1">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  tab === t
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                {t}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-3 border-l border-border pl-4">
            <div className="text-right">
              <div className="font-display text-lg font-bold leading-none">{week}%</div>
              <div className="text-[11px] text-muted-foreground">this week</div>
            </div>
            <Button variant="ghost" size="icon" aria-label="Reset demo data" onClick={reset}>
              <RotateCcw className="size-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-6">
        {tab === "Today" ? <TodayView state={state} update={update} /> : null}
        {tab === "Routine" ? <RoutineView state={state} update={update} /> : null}
        {tab === "Goals" ? <GoalsView state={state} update={update} /> : null}
        {tab === "Insights" ? <InsightsView state={state} /> : null}
      </main>

      <footer className="mx-auto max-w-6xl px-5 pb-10 text-xs text-muted-foreground">
        Phase 1: routines, logging, rollups, streaks, heatmap, catch-up. Auth, Telegram bot and AI reviews come next.
      </footer>
    </div>
  );
}

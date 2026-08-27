import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { rangeScore, startOfWeek } from "@/lib/ordo";
import { useOrdoCloud } from "@/lib/ordo-cloud";
import { useAuth } from "@/lib/auth";
import { undoState } from "@/lib/db";
import { downloadExport, type ExportKind } from "@/lib/export";
import { TodayView } from "@/components/ordo/TodayView";
import { RoutineView } from "@/components/ordo/RoutineView";
import { GoalsView } from "@/components/ordo/GoalsView";
import { InsightsView } from "@/components/ordo/InsightsView";
import { CommunityView } from "@/components/ordo/CommunityView";
import { OnboardingChecklist } from "@/components/ordo/OnboardingChecklist";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { RotateCcw, Undo2, LogIn, LogOut, Download, Bell } from "lucide-react";
import { toast } from "sonner";

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
      { property: "og:image", content: "/preview.png" },
      { property: "og:image:type", content: "image/png" },
      { property: "og:image:width", content: "1731" },
      { property: "og:image:height", content: "909" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "/preview.png" },
    ],
  }),
  component: OrdoApp,
});

const TABS = ["Today", "Routine", "Goals", "Insights", "Community"] as const;

function OrdoApp() {
  const { state, update, reset } = useOrdoCloud();
  const { user, logout, health } = useAuth();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Today");
  const [undoBusy, setUndoBusy] = useState(false);

  const undo = async () => {
    if (!user) return;
    setUndoBusy(true);
    try {
      const restored = await undoState();
      update(() => restored);
      toast.success("Last change undone");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Nothing to undo");
    } finally {
      setUndoBusy(false);
    }
  };

  const handleExport = (kind: ExportKind) => {
    if (!state) return;
    try {
      downloadExport(kind, state, user);
      toast.success("Export downloaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    }
  };

  if (!state) {
    return <div className="min-h-screen" aria-busy="true" />;
  }

  const week = rangeScore(state, startOfWeek(new Date()), 7);

  return (
    <div className="min-h-screen">
      <Toaster />
      <header className="border-b border-border/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-5 py-4">
          <a href="/" className="flex items-center gap-2.5">
            <img src="/logo-icon.png" alt="Ordo logo" className="h-11 w-11" />
            <span className="font-display text-xl font-bold tracking-tight">Ordo</span>
          </a>

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
            {user ? (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Undo last change"
                  title="Undo last change"
                  disabled={undoBusy}
                  onClick={() => void undo()}
                >
                  <Undo2 className={`size-4 ${undoBusy ? "animate-pulse" : ""}`} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Reset my data"
                  title="Reset my data"
                  onClick={reset}
                >
                  <RotateCcw className="size-4" />
                </Button>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleExport("json")}
                    className="inline-flex items-center rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent"
                    title="Export JSON"
                  >
                    <Download className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExport("csv")}
                    className="inline-flex items-center rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent"
                    title="Export CSV"
                  >
                    <span className="text-[10px] font-semibold">CSV</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExport("ical")}
                    className="inline-flex items-center rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent"
                    title="Export iCal"
                  >
                    <span className="text-[10px] font-semibold">iCal</span>
                  </button>
                </div>
                <div className="hidden text-right sm:block">
                  <div className="max-w-32 truncate text-sm font-medium">{user.name || user.email}</div>
                  <div className="text-[11px] text-muted-foreground">{user.provider}</div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => void logout()}>
                  <LogOut className="mr-1 size-3.5" /> Sign out
                </Button>
              </>
            ) : (
              <Link to="/login">
                <Button size="sm" variant="outline">
                  <LogIn className="mr-1 size-3.5" /> Sign in
                </Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-6">
        <OnboardingChecklist state={state} />
        {tab === "Today" ? <TodayView state={state} update={update} /> : null}
        {tab === "Routine" ? <RoutineView state={state} update={update} /> : null}
        {tab === "Goals" ? <GoalsView state={state} update={update} /> : null}
        {tab === "Insights" ? <InsightsView state={state} /> : null}
        {tab === "Community" ? <CommunityView /> : null}
      </main>

      <footer className="mx-auto max-w-6xl px-5 pb-10 text-xs text-muted-foreground">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span>Ordo — all data syncs per-user when you're signed in.</span>
          <span className="flex items-center gap-1">
            <Bell className="size-3" /> Telegram bot: {health?.telegram ? "active" : "not configured"}
          </span>
          <span>AI coach: {health?.anthropic ? "Claude" : "rule-based"}</span>
          {!user ? <span>Signed out — data stays in this browser.</span> : null}
        </div>
      </footer>
    </div>
  );
}

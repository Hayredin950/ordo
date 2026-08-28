import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import {
  DEFAULT_SETTINGS,
  hourFormatOf,
  rangeScore,
  startOfWeek,
  type HourFormat,
} from "@/lib/ordo";
import { useOrdoCloud } from "@/lib/ordo-cloud";
import { useAuth } from "@/lib/auth-context";
import { undoState } from "@/lib/db";
import { downloadExport, type ExportKind } from "@/lib/export";
import { AppShell, type TabId } from "@/components/ordo/AppShell";
import { TodayView } from "@/components/ordo/TodayView";
import { RoutineView } from "@/components/ordo/RoutineView";
import { GoalsView } from "@/components/ordo/GoalsView";
import { InsightsView } from "@/components/ordo/InsightsView";
import { CommunityView } from "@/components/ordo/CommunityView";
import { PreferencesPanel } from "@/components/ordo/PreferencesPanel";
import { AnnouncementBanner } from "@/components/ordo/AnnouncementBanner";
import { OnboardingChecklist } from "@/components/ordo/OnboardingChecklist";
import { Toaster } from "@/components/ui/sonner";
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

function OrdoApp() {
  const { state, update, reset } = useOrdoCloud();
  const { user } = useAuth();
  const [tab, setTab] = useState<TabId>("Today");
  const [undoBusy, setUndoBusy] = useState(false);

  /**
   * Switching section from the bottom bar leaves the viewport wherever the last
   * section was scrolled to, which reads as a broken tap. Reset it.
   */
  const changeTab = useCallback((next: TabId) => {
    setTab(next);
    window.scrollTo({ top: 0, behavior: "auto" });
  }, []);

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

  const setHourFormat = (hourFormat: HourFormat) => {
    update((prev) => ({
      ...prev,
      settings: { ...DEFAULT_SETTINGS, ...prev.settings, hourFormat },
    }));
    toast.success(hourFormat === "24h" ? "Times now show as 24-hour" : "Times now show as AM/PM");
  };

  if (!state) {
    return <div className="min-h-dvh" aria-busy="true" />;
  }

  const week = rangeScore(state, startOfWeek(new Date()), 7);

  return (
    <>
      <Toaster />
      <AppShell
        tab={tab}
        onTab={changeTab}
        week={week}
        undoBusy={undoBusy}
        onUndo={() => void undo()}
        onReset={reset}
        onExport={handleExport}
        hourFormat={hourFormatOf(state)}
        onHourFormat={setHourFormat}
      >
        <AnnouncementBanner />
        <OnboardingChecklist state={state} />
        {tab === "Today" ? <TodayView state={state} update={update} /> : null}
        {tab === "Routine" ? <RoutineView state={state} update={update} /> : null}
        {tab === "Goals" ? <GoalsView state={state} update={update} /> : null}
        {tab === "Insights" ? <InsightsView state={state} /> : null}
        {tab === "Community" ? (
          <div className="space-y-4 sm:space-y-5">
            <PreferencesPanel state={state} update={update} />
            <CommunityView />
          </div>
        ) : null}
      </AppShell>
    </>
  );
}

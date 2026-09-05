import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { DEFAULT_SETTINGS, settingsOf } from "@/lib/ordo";
import { useOrdoCloud } from "@/lib/ordo-cloud";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import {
  AlarmClock,
  AlarmClockOff,
  ArrowLeft,
  ChevronRight,
  Clock,
  Info,
  RotateCcw,
  type LucideIcon,
} from "lucide-react";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Ordo" },
      // One person's preferences; nothing here belongs in a search index.
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: SettingsPage,
});

/**
 * The web twin of the Flutter app's `SettingsScreen` — same four sections, same
 * tiles, same order. It reads and writes the same synced settings the header's
 * clock shortcut and the Community → Preferences panel do.
 */
function SettingsPage() {
  const { state, update, reset } = useOrdoCloud();
  const [confirmReset, setConfirmReset] = useState(false);

  if (!state) return <div className="min-h-dvh" aria-busy="true" />;

  const { hourFormat, soundEnabled } = settingsOf(state);

  const toggleHourFormat = () => {
    const next = hourFormat === "24h" ? "12h" : "24h";
    update((prev) => ({
      ...prev,
      settings: { ...DEFAULT_SETTINGS, ...prev.settings, hourFormat: next },
    }));
    toast.success(next === "24h" ? "Times now show as 24-hour" : "Times now show as AM/PM");
  };

  const toggleSound = () => {
    update((prev) => ({
      ...prev,
      settings: { ...DEFAULT_SETTINGS, ...prev.settings, soundEnabled: !soundEnabled },
    }));
    toast.success(soundEnabled ? "Alarm sounds off" : "Alarm sounds on");
  };

  return (
    <>
      <Toaster />
      <div className="flex min-h-dvh flex-col">
        <header className="pt-safe sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-md">
          <div className="mx-auto flex h-14 w-full max-w-2xl items-center gap-1 px-3 sm:h-16 sm:px-5">
            <Link
              to="/"
              aria-label="Back to Ordo"
              className="tap -ml-1 inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <ArrowLeft className="size-5" />
            </Link>
            <h1 className="font-display text-lg font-bold tracking-tight sm:text-xl">Settings</h1>
          </div>
        </header>

        <main className="mx-auto w-full max-w-2xl flex-1 space-y-7 px-3 py-5 sm:px-5 sm:py-6">
          <Section title="Appearance">
            <SettingsTile
              icon={Clock}
              title="Time Format"
              subtitle={hourFormat === "12h" ? "12-hour (AM/PM)" : "24-hour"}
              onClick={toggleHourFormat}
            />
          </Section>

          <Section title="Focus">
            <SettingsTile
              icon={soundEnabled ? AlarmClock : AlarmClockOff}
              title="Timer Alarm"
              subtitle={soundEnabled ? "Beep when a session ends" : "Off"}
              onClick={toggleSound}
            />
          </Section>

          <Section title="Data">
            <SettingsTile
              icon={RotateCcw}
              title="Reset All Data"
              subtitle="Restore to default state with sample data"
              onClick={() => setConfirmReset(true)}
              destructive
            />
          </Section>

          <Section title="About">
            <SettingsTile icon={Info} title="Ordo" subtitle="Personal Accountability App" />
          </Section>
        </main>
      </div>

      <AlertDialog open={confirmReset} onOpenChange={setConfirmReset}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset Data</AlertDialogTitle>
            <AlertDialogDescription>
              This erases your routine, goals and log and restores the sample data. Your preferences
              are kept. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                reset();
                toast.success("Data reset to the sample state");
              }}
            >
              Reset
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="font-display text-sm font-semibold text-primary">{title}</h2>
      {children}
    </section>
  );
}

/**
 * A row from the Flutter screen: glyph, title, current value, chevron. Rendered
 * as a plain div when there is nothing to tap, so About does not advertise an
 * action it does not have.
 */
function SettingsTile({
  icon: Icon,
  title,
  subtitle,
  onClick,
  destructive = false,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  onClick?: () => void;
  destructive?: boolean;
}) {
  const body = (
    <>
      <Icon
        className={cn("size-[22px] shrink-0", destructive ? "text-destructive" : "text-foreground")}
      />
      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-sm font-semibold", destructive && "text-destructive")}>
          {title}
        </p>
        <p
          className={cn(
            "mt-0.5 text-xs",
            destructive ? "text-destructive/70" : "text-muted-foreground",
          )}
        >
          {subtitle}
        </p>
      </div>
      {onClick ? <ChevronRight className="size-5 shrink-0 text-muted-foreground" /> : null}
    </>
  );

  const shell = "flex w-full items-center gap-4 rounded-xl border border-border bg-card p-4";
  if (!onClick) return <div className={shell}>{body}</div>;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(shell, "tap text-left transition-colors hover:bg-accent/40")}
    >
      {body}
    </button>
  );
}

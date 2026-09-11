import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { DEFAULT_SETTINGS, settingsOf, type AlarmSound } from "@/lib/ordo";
import { useOrdoCloud } from "@/lib/ordo-cloud";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
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
  LogOut,
  RotateCcw,
  Volume2,
  Vibrate,
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
 * tiles, same order — plus the account controls that used to sit in a "Settings
 * & data" panel at the bottom of the Community tab, which is a strange place to
 * keep a delete button. It reads and writes the same synced settings the
 * header's clock shortcut and the Community → Preferences panel do.
 */
function SettingsPage() {
  const { state, update, reset } = useOrdoCloud();
  const { user, logout } = useAuth();
  const [confirmReset, setConfirmReset] = useState(false);

  if (!state) return <div className="min-h-dvh" aria-busy="true" />;

  const { hourFormat, soundEnabled, alarmSound, alarmVibrate } = settingsOf(state);

  const updateSetting = <K extends keyof typeof DEFAULT_SETTINGS>(
    key: K,
    value: (typeof DEFAULT_SETTINGS)[K],
  ) => {
    update((prev) => ({
      ...prev,
      settings: { ...DEFAULT_SETTINGS, ...prev.settings, [key]: value },
    }));
  };

  const toggleHourFormat = () => {
    const next = hourFormat === "24h" ? "12h" : "24h";
    updateSetting("hourFormat", next);
    toast.success(next === "24h" ? "Times now show as 24-hour" : "Times now show as AM/PM");
  };

  const toggleSound = () => {
    updateSetting("soundEnabled", !soundEnabled);
    toast.success(soundEnabled ? "Alarm sounds off" : "Alarm sounds on");
  };

  const setAlarmSound = (sound: AlarmSound) => {
    updateSetting("alarmSound", sound);
    toast.success(`Alarm sound: ${sound}`);
  };

  const toggleVibrate = () => {
    updateSetting("alarmVibrate", !alarmVibrate);
    toast.success(alarmVibrate ? "Vibration off" : "Vibration on");
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
            <SettingsRow
              icon={Clock}
              title="Time Format"
              subtitle={hourFormat === "12h" ? "12-hour (AM/PM)" : "24-hour"}
            >
              <Switch
                checked={hourFormat === "24h"}
                onCheckedChange={toggleHourFormat}
              />
            </SettingsRow>
          </Section>

          <Section title="Focus">
            <SettingsRow
              icon={soundEnabled ? AlarmClock : AlarmClockOff}
              title="Timer Alarm"
              subtitle={soundEnabled ? "Sound when a session ends" : "Off"}
            >
              <Switch
                checked={soundEnabled}
                onCheckedChange={toggleSound}
              />
            </SettingsRow>
            {soundEnabled && (
              <>
                <div className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-center gap-4">
                    <Volume2 className="size-[22px] shrink-0 text-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">Alarm Sound</p>
                      <p className="mt-0.5 text-xs capitalize text-muted-foreground">
                        {alarmSound}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-4 gap-2">
                    {(["chime", "bell", "beep", "soft"] as AlarmSound[]).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setAlarmSound(s)}
                        className={cn(
                          "tap rounded-lg border px-3 py-2 text-xs font-medium capitalize transition-colors",
                          alarmSound === s
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border hover:bg-accent/40",
                        )}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                <SettingsRow
                  icon={Vibrate}
                  title="Vibrate"
                  subtitle={alarmVibrate ? "Vibrate on finish" : "Off"}
                >
                  <Switch
                    checked={alarmVibrate}
                    onCheckedChange={toggleVibrate}
                  />
                </SettingsRow>
              </>
            )}
          </Section>

          <Section
            title="Data"
            hint="Everything is exportable (JSON, CSV, iCal) from the profile menu. Version history keeps the last 30 snapshots — Undo steps back through them."
          >
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="flex w-full items-center gap-4 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:bg-accent/40"
            >
              <RotateCcw className="size-[22px] shrink-0 text-destructive" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-destructive">Reset All Data</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Restore to default state with sample data</p>
              </div>
              <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
            </button>
          </Section>

          {user ? (
            <Section title="Account" hint={user.email}>
              <button
                type="button"
                onClick={() => void logout()}
                className="flex w-full items-center gap-4 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:bg-accent/40"
              >
                <LogOut className="size-[22px] shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">Sign Out</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Your data stays synced to your other devices</p>
                </div>
                <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
              </button>
            </Section>
          ) : null}

          <Section title="About">
            <Link to="/about" className="tap">
              <div className="flex w-full items-center gap-4 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:bg-accent/40">
                <Info className="size-[22px] shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">Ordo</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Personal Accountability App</p>
                </div>
                <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
              </div>
            </Link>
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

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="font-display text-sm font-semibold text-primary">{title}</h2>
        {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      {children}
    </section>
  );
}

/**
 * A settings row with icon, title, subtitle, and an optional action element
 * (switch, button, etc.) on the right side.
 */
function SettingsRow({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex w-full items-center gap-4 rounded-xl border border-border bg-card p-4">
      <Icon className="size-[22px] shrink-0 text-foreground" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

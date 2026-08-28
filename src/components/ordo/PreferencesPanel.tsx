import {
  DEFAULT_SETTINGS,
  blocksFor,
  formatTimeRange,
  hourFormatOf,
  type HourFormat,
  type OrdoState,
} from "@/lib/ordo";
import { Panel, PanelTitle, SegButton } from "./primitives";
import { Clock } from "lucide-react";
import { toast } from "sonner";

const OPTIONS: { id: HourFormat; label: string; hint: string }[] = [
  { id: "24h", label: "24-hour", hint: "09:00 – 17:30" },
  { id: "12h", label: "12-hour", hint: "9:00 AM – 5:30 PM" },
];

/**
 * The clock-format choice. It lives in the synced document, so it follows the
 * account to every device rather than sitting in this browser's storage.
 *
 * Note about `<input type="time">`: the block editors in Routine are rendered by
 * the browser from the operating system's locale, so this preference cannot reach
 * them. Everywhere the app prints a time itself, it obeys.
 */
export function PreferencesPanel({
  state,
  update,
}: {
  state: OrdoState;
  update: (fn: (s: OrdoState) => OrdoState) => void;
}) {
  const format = hourFormatOf(state);
  // A real block from the plan makes the preview concrete; the fallback keeps
  // the panel meaningful on a day with nothing scheduled.
  const sample = blocksFor(state, new Date())[0];
  const start = sample?.start ?? "09:00";
  const end = sample?.end ?? "10:30";

  const choose = (next: HourFormat) => {
    if (next === format) return;
    update((prev) => ({
      ...prev,
      settings: { ...DEFAULT_SETTINGS, ...prev.settings, hourFormat: next },
    }));
    toast.success(next === "24h" ? "Times now show as 24-hour" : "Times now show as AM/PM");
  };

  return (
    <Panel>
      <PanelTitle title="Preferences" hint="How Ordo writes the clock. Synced to your account." />
      <div className="space-y-3">
        <div>
          <p className="mb-2 text-sm font-medium">Time format</p>
          <div className="grid grid-cols-2 gap-2" role="group" aria-label="Time format">
            {OPTIONS.map((o) => (
              <SegButton
                key={o.id}
                active={format === o.id}
                onClick={() => choose(o.id)}
                className="flex flex-col items-center gap-0.5 py-2.5"
              >
                <span>{o.label}</span>
                <span className="text-[11px] font-normal opacity-70">{o.hint}</span>
              </SegButton>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-border bg-background/40 p-3">
          <Clock className="size-4 shrink-0 text-primary" />
          <div className="min-w-0">
            <p className="truncate font-display text-sm font-semibold tabular-nums">
              {formatTimeRange(start, end, format)}
            </p>
            <p className="text-xs text-muted-foreground">
              {sample ? `“${sample.title}” today` : "Example block"}
            </p>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          The time pickers when you edit a block are drawn by your browser and follow your device's
          locale — that part is out of Ordo's hands.
        </p>
      </div>
    </Panel>
  );
}

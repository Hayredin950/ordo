import { useEffect, useRef, useState } from "react";
import { Panel, PanelTitle, ScrollRow, SegButton } from "./primitives";
import { Button } from "@/components/ui/button";
import { Play, Pause, RotateCcw, Timer, Plus, X } from "lucide-react";
import type { OrdoState } from "@/lib/ordo";

interface TimerPreset {
  id: string;
  label: string;
  minutes: number;
}

const PRESETS: TimerPreset[] = [
  { id: "deep", label: "Deep work", minutes: 50 },
  { id: "standard", label: "Standard", minutes: 25 },
  { id: "short", label: "Short", minutes: 15 },
];

const CUSTOM_PRESETS_KEY = "ordo.focus-presets.v1";

function loadCustomPresets(): TimerPreset[] {
  try {
    const raw = localStorage.getItem(CUSTOM_PRESETS_KEY);
    return raw ? (JSON.parse(raw) as TimerPreset[]) : [];
  } catch {
    return [];
  }
}

function saveCustomPresets(presets: TimerPreset[]) {
  localStorage.setItem(CUSTOM_PRESETS_KEY, JSON.stringify(presets));
}

const uid = () => Math.random().toString(36).slice(2, 10);

function playAlarm() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.15);
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.3);
    osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.45);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.6);
  } catch {
    /* audio not available */
  }
}

const DEFAULT_TOTAL = 25 * 60;

export function FocusTimer({ state }: { state: OrdoState | null }) {
  const [total, setTotal] = useState(DEFAULT_TOTAL);
  const [secondsLeft, setSecondsLeft] = useState(DEFAULT_TOTAL);
  const [running, setRunning] = useState(false);
  const [customPresets, setCustomPresets] = useState<TimerPreset[]>(loadCustomPresets);
  const [showAdd, setShowAdd] = useState(false);
  const [newMinutes, setNewMinutes] = useState("25");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const soundEnabled = state?.settings?.soundEnabled ?? true;

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setSecondsLeft((s) => {
          if (s <= 1) {
            setRunning(false);
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running]);

  useEffect(() => {
    if (!running && secondsLeft === 0 && total > 0) {
      if (soundEnabled) {
        playAlarm();
      }
    }
  }, [secondsLeft, running, total, soundEnabled]);

  const select = (minutes: number) => {
    setRunning(false);
    setTotal(minutes * 60);
    setSecondsLeft(minutes * 60);
  };

  const addPreset = () => {
    const minutes = parseInt(newMinutes, 10);
    if (isNaN(minutes) || minutes <= 0) return;
    const preset: TimerPreset = { id: uid(), label: `Custom ${customPresets.length + 1}`, minutes };
    const updated = [...customPresets, preset];
    setCustomPresets(updated);
    saveCustomPresets(updated);
    setNewMinutes("25");
    setShowAdd(false);
  };

  const removePreset = (id: string) => {
    const updated = customPresets.filter((p) => p.id !== id);
    setCustomPresets(updated);
    saveCustomPresets(updated);
  };

  const mm = Math.floor(secondsLeft / 60)
    .toString()
    .padStart(2, "0");
  const ss = (secondsLeft % 60).toString().padStart(2, "0");
  const elapsed = total > 0 ? 1 - secondsLeft / total : 0;
  const r = 64;
  const circumference = 2 * Math.PI * r;

  return (
    <Panel>
      <PanelTitle title="Focus timer" />
      <ScrollRow className="sm:justify-end">
        {PRESETS.map((p) => (
          <SegButton
            key={p.id}
            active={total === p.minutes * 60}
            className="px-2.5 py-1.5 text-[11px] sm:py-1"
            onClick={() => select(p.minutes)}
          >
            {p.label}
          </SegButton>
        ))}
        {customPresets.map((p) => (
          <span key={p.id} className="inline-flex items-center gap-0.5 rounded-md bg-muted px-1.5 py-1 text-[11px]">
            <SegButton
              active={total === p.minutes * 60}
              className="px-2 py-1.5 text-[11px] sm:py-1"
              onClick={() => select(p.minutes)}
            >
              {p.label}
            </SegButton>
            <button
              type="button"
              onClick={() => removePreset(p.id)}
              className="ml-0.5 rounded-full hover:bg-accent hover:text-foreground"
              aria-label={`Remove ${p.label} preset`}
            >
              <X className="size-2.5" />
            </button>
          </span>
        ))}
        <SegButton
          active={false}
          className="px-2 py-1.5 text-[11px] sm:py-1"
          onClick={() => setShowAdd(!showAdd)}
        >
          <Plus className="mr-0.5 size-3 inline" /> Customize
        </SegButton>
      </ScrollRow>
      {showAdd && (
        <div className="flex flex-col gap-2 py-2 sm:flex-row sm:items-center">
          <input
            type="number"
            placeholder="Minutes"
            value={newMinutes}
            onChange={(e) => setNewMinutes(e.target.value)}
            min={1}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring sm:w-20"
          />
          <Button size="sm" onClick={addPreset}>
            <Plus className="mr-1 size-3" /> Save
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>
            <X className="size-3" />
          </Button>
        </div>
      )}
      <div className="flex flex-col items-center gap-3 py-2">
        <div className="relative flex size-32 items-center justify-center sm:size-36">
          <svg viewBox="0 0 144 144" className="size-full -rotate-90" aria-hidden>
            <circle cx={72} cy={72} r={r} fill="none" stroke="var(--border)" strokeWidth={8} />
            <circle
              cx={72}
              cy={72}
              r={r}
              fill="none"
              stroke="var(--primary)"
              strokeWidth={8}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * Math.min(1, Math.max(0, elapsed))}
              style={{ transition: "stroke-dashoffset 1s linear" }}
            />
          </svg>
          <div
            className="absolute font-display text-3xl font-bold tabular-nums"
            role="timer"
            aria-live="off"
          >
            {mm}:{ss}
          </div>
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <Button
            size="sm"
            className="tap flex-1 sm:flex-none"
            onClick={() => setRunning((on) => !on)}
          >
            {running ? <Pause className="mr-1 size-4" /> : <Play className="mr-1 size-4" />}
            {running ? "Pause" : secondsLeft === 0 ? "Restart" : "Start"}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="tap flex-1 sm:flex-none"
            onClick={() => {
              setRunning(false);
              setSecondsLeft(total);
            }}
          >
            <RotateCcw className="mr-1 size-4" /> Reset
          </Button>
        </div>
        <p className="flex items-center gap-1.5 text-center text-xs text-muted-foreground">
          <Timer className="size-3.5 shrink-0" /> Log the linked block when it's done.
        </p>
      </div>
    </Panel>
  );
}
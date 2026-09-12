import { useEffect, useRef, useState } from "react";
import { Panel, PanelTitle, ScrollRow, SegButton } from "./primitives";
import { Button } from "@/components/ui/button";
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
import { Play, Pause, RotateCcw, Timer, Plus, X, Link2 } from "lucide-react";
import { dateKey, settingsOf, type AlarmSound, type OrdoState } from "@/lib/ordo";
import { reconcileDebtForDate } from "@/lib/domain";

/* ------------------------------------------------------------------ */
/*  Alarm sound generators (Web Audio API – no asset files needed)     */
/* ------------------------------------------------------------------ */

type AlarmFn = (ctx: AudioContext) => void;

const alarmChime: AlarmFn = (ctx) => {
  const t = ctx.currentTime;
  [523, 659, 784, 1047].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.25, t + i * 0.18);
    gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.18 + 0.4);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t + i * 0.18);
    osc.stop(t + i * 0.18 + 0.4);
  });
};

const alarmBell: AlarmFn = (ctx) => {
  const t = ctx.currentTime;
  [880, 1175, 880].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.3, t + i * 0.25);
    gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.25 + 0.35);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t + i * 0.25);
    osc.stop(t + i * 0.25 + 0.35);
  });
};

const alarmBeep: AlarmFn = (ctx) => {
  const t = ctx.currentTime;
  for (let i = 0; i < 3; i++) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = 1000;
    gain.gain.setValueAtTime(0.2, t + i * 0.3);
    gain.gain.setValueAtTime(0.001, t + i * 0.3 + 0.15);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t + i * 0.3);
    osc.stop(t + i * 0.3 + 0.15);
  }
};

const alarmSoft: AlarmFn = (ctx) => {
  const t = ctx.currentTime;
  [440, 554, 659, 880].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.2, t + i * 0.2 + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.2 + 0.5);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t + i * 0.2);
    osc.stop(t + i * 0.2 + 0.5);
  });
};

const ALARM_FNS: Record<AlarmSound, AlarmFn> = {
  chime: alarmChime,
  bell: alarmBell,
  beep: alarmBeep,
  soft: alarmSoft,
};

function playAlarmSound(sound: AlarmSound) {
  try {
    const ctx = new (
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    )();
    ALARM_FNS[sound](ctx);
  } catch {
    /* audio not available */
  }
}

function vibrate(pattern: number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* not available */
  }
}

/* ------------------------------------------------------------------ */
/*  Timer persistence (survives tab switches)                          */
/* ------------------------------------------------------------------ */

/** §5.5: the block or task a session is "for" — a chip, not a mode switch. */
export type LinkedItem = { id: string; title: string; type: "routine" | "task" };

/** A contextual start coming from a Today timeline row (§5.5 entry point 1). */
export type FocusStartRequest = { linked: LinkedItem; minutes: number; nonce: number };

interface TimerSnapshot {
  total: number;
  secondsLeft: number;
  running: boolean;
  savedAt: number;
  linked?: LinkedItem;
}

const TIMER_KEY = "ordo.focus-timer.v1";
const DEFAULT_TOTAL = 25 * 60;

function loadTimer(): TimerSnapshot {
  try {
    const raw = localStorage.getItem(TIMER_KEY);
    if (!raw)
      return { total: DEFAULT_TOTAL, secondsLeft: DEFAULT_TOTAL, running: false, savedAt: 0 };
    const snap = JSON.parse(raw) as TimerSnapshot;
    if (snap.running && snap.savedAt > 0) {
      const elapsedSec = Math.floor((Date.now() - snap.savedAt) / 1000);
      snap.secondsLeft = Math.max(0, snap.secondsLeft - elapsedSec);
      if (snap.secondsLeft <= 0) {
        snap.secondsLeft = 0;
        snap.running = false;
      }
    }
    return snap;
  } catch {
    return { total: DEFAULT_TOTAL, secondsLeft: DEFAULT_TOTAL, running: false, savedAt: 0 };
  }
}

function saveTimer(snap: TimerSnapshot) {
  localStorage.setItem(TIMER_KEY, JSON.stringify({ ...snap, savedAt: Date.now() }));
}

/* ------------------------------------------------------------------ */
/*  Custom presets (localStorage)                                      */
/* ------------------------------------------------------------------ */

interface TimerPreset {
  id: string;
  label: string;
  minutes: number;
}

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

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

const BUILTINS: TimerPreset[] = [
  { id: "deep", label: "Deep work", minutes: 50 },
  { id: "standard", label: "Standard", minutes: 25 },
  { id: "short", label: "Short", minutes: 15 },
];

export function FocusTimer({
  state,
  update,
  startRequest,
}: {
  state: OrdoState | null;
  /** Present whenever the timer is mounted inside a view that can log completions. */
  update?: (fn: (s: OrdoState) => OrdoState) => void;
  startRequest?: FocusStartRequest | null;
}) {
  const settings = settingsOf(state);
  const { soundEnabled, alarmSound, alarmVibrate } = settings;

  const initial = loadTimer();
  const [total, setTotal] = useState(initial.total);
  const [secondsLeft, setSecondsLeft] = useState(initial.secondsLeft);
  const [running, setRunning] = useState(initial.running);
  const [linked, setLinked] = useState<LinkedItem | undefined>(initial.linked);
  const [justFinished, setJustFinished] = useState<LinkedItem | null>(null);
  const [customPresets, setCustomPresets] = useState<TimerPreset[]>(loadCustomPresets);
  const [showCustomize, setShowCustomize] = useState(false);
  const [customMinutes, setCustomMinutes] = useState(25);
  const [alarmActive, setAlarmActive] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const alarmIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const alarmStartRef = useRef<number>(0);
  const wasRunningRef = useRef(initial.running);

  /* ---- persist timer on every change ---- */
  useEffect(() => {
    const snap: TimerSnapshot = {
      total,
      secondsLeft,
      running,
      savedAt: Date.now(),
    };
    if (linked) snap.linked = linked;
    saveTimer(snap);
  }, [total, secondsLeft, running, linked]);

  /* ---- contextual start from a Today row (§5.5) ---- */
  useEffect(() => {
    if (!startRequest) return;
    stopAlarm();
    setTotal(startRequest.minutes * 60);
    setSecondsLeft(startRequest.minutes * 60);
    setLinked(startRequest.linked);
    setRunning(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startRequest?.nonce]);

  /* ---- trigger alarm if timer finished while user was away ---- */
  useEffect(() => {
    if (wasRunningRef.current && !running && secondsLeft === 0 && total > 0) {
      if (soundEnabled) {
        playAlarmSound(alarmSound);
        alarmStartRef.current = Date.now();
        setAlarmActive(true);
        alarmIntervalRef.current = setInterval(() => {
          const elapsed = Date.now() - alarmStartRef.current;
          if (elapsed >= 60_000) {
            clearInterval(alarmIntervalRef.current!);
            setAlarmActive(false);
            return;
          }
          playAlarmSound(alarmSound);
        }, 4000);
      }
      if (alarmVibrate) {
        vibrate([200, 100, 200, 100, 200]);
      }
    }
    wasRunningRef.current = running;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---- timer tick ---- */
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

  /* ---- trigger alarm when timer hits zero ---- */
  useEffect(() => {
    if (!running && secondsLeft === 0 && total > 0) {
      // §5.5: a session that ran to zero is offerable to the linked item.
      if (linked) setJustFinished(linked);
      if (soundEnabled) {
        playAlarmSound(alarmSound);
        alarmStartRef.current = Date.now();
        setAlarmActive(true);
        alarmIntervalRef.current = setInterval(() => {
          const elapsed = Date.now() - alarmStartRef.current;
          if (elapsed >= 60_000) {
            clearInterval(alarmIntervalRef.current!);
            setAlarmActive(false);
            return;
          }
          playAlarmSound(alarmSound);
        }, 4000);
      }
      if (alarmVibrate) {
        vibrate([200, 100, 200, 100, 200]);
      }
    }
  }, [secondsLeft, running, total, linked, soundEnabled, alarmSound, alarmVibrate]);

  /** §5.5: one tap feeds the linked block/task's completion control (100%). */
  const logToLinked = () => {
    const item = justFinished;
    if (!item || !update) return;
    const key = dateKey(new Date());
    update((prev) =>
      reconcileDebtForDate(
        {
          ...prev,
          log: { ...prev.log, [key]: { ...(prev.log[key] ?? {}), [item.id]: 100 } },
        },
        new Date(),
      ),
    );
    setJustFinished(null);
    setLinked(undefined);
    setTotal(DEFAULT_TOTAL);
    setSecondsLeft(DEFAULT_TOTAL);
  };

  useEffect(() => {
    return () => {
      if (alarmIntervalRef.current) clearInterval(alarmIntervalRef.current);
    };
  }, []);

  const stopAlarm = () => {
    if (alarmIntervalRef.current) clearInterval(alarmIntervalRef.current);
    setAlarmActive(false);
  };

  const select = (minutes: number) => {
    setRunning(false);
    stopAlarm();
    setTotal(minutes * 60);
    setSecondsLeft(minutes * 60);
  };

  const startCustom = () => {
    const minutes = Math.min(180, Math.max(1, customMinutes));
    setTotal(minutes * 60);
    setSecondsLeft(minutes * 60);
    setRunning(true);
    setShowCustomize(false);
  };

  const saveAsPreset = () => {
    const minutes = customMinutes;
    if (minutes <= 0) return;
    if (customPresets.find((p) => p.minutes === minutes)) {
      select(minutes);
      setShowCustomize(false);
      return;
    }
    const preset: TimerPreset = { id: uid(), label: `${minutes}m`, minutes };
    const updated = [...customPresets, preset].sort((a, b) => a.minutes - b.minutes);
    setCustomPresets(updated);
    saveCustomPresets(updated);
    setShowCustomize(false);
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
    <>
      <Panel>
        <PanelTitle title="Focus timer" />
        <p className="text-xs text-muted-foreground px-1">
          One block at a time — the timer is the task.
        </p>
        {linked ? (
          <div className="mb-2 flex items-center justify-center gap-1.5 px-1">
            <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs text-primary">
              <Link2 className="size-3 shrink-0" />
              <span className="truncate">{linked.title}</span>
            </span>
          </div>
        ) : null}
        <ScrollRow>
          {BUILTINS.map((p) => (
            <SegButton
              key={p.id}
              active={total === p.minutes * 60 && !running}
              className="px-2.5 py-1.5 text-[11px] sm:py-1 sm:first:ml-auto"
              onClick={() => select(p.minutes)}
            >
              {p.label}
            </SegButton>
          ))}
          {customPresets.map((p) => (
            <span
              key={p.id}
              className="scroll-row-item inline-flex items-center gap-0.5 rounded-md bg-muted px-1.5 py-1 text-[11px]"
            >
              <SegButton
                active={total === p.minutes * 60 && !running}
                className="px-2 py-1.5 text-[11px] sm:py-1"
                onClick={() => select(p.minutes)}
              >
                {p.minutes}m
              </SegButton>
              <button
                type="button"
                onClick={() => removePreset(p.id)}
                className="ml-0.5 rounded-full p-1 hover:bg-accent hover:text-foreground"
                aria-label={`Remove the ${p.minutes}-minute preset`}
              >
                <X className="size-2.5" />
              </button>
            </span>
          ))}
          <SegButton
            active={showCustomize}
            className="px-2 py-1.5 text-[11px] sm:py-1"
            onClick={() => setShowCustomize(!showCustomize)}
          >
            <Plus className="mr-0.5 size-3 inline" /> Customize
          </SegButton>
        </ScrollRow>
        {showCustomize && (
          <div className="space-y-2 py-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Pick duration</span>
              <span className="text-xs font-medium tabular-nums text-primary">
                {customMinutes} min
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={180}
              value={customMinutes}
              onChange={(e) => setCustomMinutes(Number(e.target.value))}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>1 min</span>
              <span>3 h</span>
            </div>
            <div className="flex gap-2">
              <Button size="sm" className="tap flex-1" onClick={startCustom}>
                <Play className="mr-1 size-3" /> Start
              </Button>
              <Button size="sm" variant="secondary" className="tap flex-1" onClick={saveAsPreset}>
                <Plus className="mr-1 size-3" /> Save as preset
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="tap"
                onClick={() => setShowCustomize(false)}
              >
                <X className="size-3" />
              </Button>
            </div>
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
                stopAlarm();
                setSecondsLeft(total);
                setLinked(undefined);
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

      <AlertDialog
        open={alarmActive || justFinished !== null}
        onOpenChange={(open) => {
          if (!open) {
            stopAlarm();
            setJustFinished(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {justFinished ? "Focus session complete" : "Timer finished"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {justFinished
                ? `${Math.round(total / 60)} minutes · ${justFinished.title}`
                : "The alarm will stop on its own in under a minute, or tap below to silence it now."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            {justFinished && update ? (
              <>
                <AlertDialogCancel
                  onClick={() => {
                    setJustFinished(null);
                    setLinked(undefined);
                  }}
                >
                  Done
                </AlertDialogCancel>
                <AlertDialogAction onClick={logToLinked}>
                  Log to {justFinished.title}
                </AlertDialogAction>
              </>
            ) : (
              <AlertDialogAction onClick={stopAlarm}>Stop Alarm</AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

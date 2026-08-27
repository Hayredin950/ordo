import { useEffect, useRef, useState } from "react";
import { Panel, PanelTitle, ScrollRow, SegButton } from "./primitives";
import { Button } from "@/components/ui/button";
import { Play, Pause, RotateCcw, Timer } from "lucide-react";

const PRESETS = [
  { label: "Deep work", minutes: 50 },
  { label: "Standard", minutes: 25 },
  { label: "Short", minutes: 15 },
];

const DEFAULT_TOTAL = 25 * 60;

export function FocusTimer() {
  // The chosen preset length is state of its own: the ring has to be drawn
  // against the session actually selected, not against a hard-coded 25 minutes.
  const [total, setTotal] = useState(DEFAULT_TOTAL);
  const [secondsLeft, setSecondsLeft] = useState(DEFAULT_TOTAL);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  const select = (minutes: number) => {
    setRunning(false);
    setTotal(minutes * 60);
    setSecondsLeft(minutes * 60);
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
      <PanelTitle
        title="Focus timer"
        hint="One block at a time — the timer is the task."
        action={
          /* Three presets plus a title do not share a phone line, so they scroll
             below `sm` and sit inline above it. */
          <ScrollRow className="sm:justify-end">
            {PRESETS.map((p) => (
              <SegButton
                key={p.label}
                active={total === p.minutes * 60}
                className="px-2.5 py-1.5 text-[11px] sm:py-1"
                onClick={() => select(p.minutes)}
              >
                {p.label}
              </SegButton>
            ))}
          </ScrollRow>
        }
      />
      <div className="flex flex-col items-center gap-3 py-2">
        {/* Drawn in a 144×144 user space and scaled by CSS so the dial can shrink
            on a small phone without redoing the geometry. */}
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

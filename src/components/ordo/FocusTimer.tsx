import { useEffect, useRef, useState } from "react";
import { Panel, PanelTitle } from "./primitives";
import { Button } from "@/components/ui/button";
import { Play, Pause, RotateCcw, Timer } from "lucide-react";

const PRESETS = [
  { label: "Deep work", minutes: 50 },
  { label: "Standard", minutes: 25 },
  { label: "Short", minutes: 15 },
];

export function FocusTimer() {
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
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

  const mm = Math.floor(secondsLeft / 60).toString().padStart(2, "0");
  const ss = (secondsLeft % 60).toString().padStart(2, "0");
  const pct = 1 - secondsLeft / (25 * 60);

  return (
    <Panel>
      <PanelTitle
        title="Focus timer"
        hint="One block at a time — the timer is the task."
        action={
          <div className="flex flex-wrap justify-end gap-1">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => {
                  setRunning(false);
                  setSecondsLeft(p.minutes * 60);
                }}
                className="rounded-md bg-muted px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-accent"
              >
                {p.label}
              </button>
            ))}
          </div>
        }
      />
      <div className="flex flex-col items-center gap-3 py-2">
        <div className="relative flex size-36 items-center justify-center">
          <svg width={144} height={144} className="-rotate-90">
            <circle cx={72} cy={72} r={64} fill="none" stroke="var(--border)" strokeWidth={8} />
            <circle
              cx={72}
              cy={72}
              r={64}
              fill="none"
              stroke="var(--primary)"
              strokeWidth={8}
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 64}
              strokeDashoffset={2 * Math.PI * 64 * pct}
              style={{ transition: "stroke-dashoffset 1s linear" }}
            />
          </svg>
          <div className="absolute font-display text-3xl font-bold tabular-nums">
            {mm}:{ss}
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => setRunning((r) => !r)}>
            {running ? <Pause className="mr-1 size-4" /> : <Play className="mr-1 size-4" />}
            {running ? "Pause" : secondsLeft === 0 ? "Restart" : "Start"}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setRunning(false);
              setSecondsLeft(25 * 60);
            }}
          >
            <RotateCcw className="mr-1 size-4" /> Reset
          </Button>
        </div>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Timer className="size-3.5" /> Log the linked block when it's done.
        </p>
      </div>
    </Panel>
  );
}

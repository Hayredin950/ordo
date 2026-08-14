import { useMemo } from "react";
import {
  addDays,
  categoryBreakdown,
  catColor,
  dateKey,
  dayScore,
  rangeScore,
  startOfWeek,
  streak,
  type CategoryId,
  type OrdoState,
} from "@/lib/ordo";
import { Panel, PanelTitle, Stat } from "./primitives";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Sparkles } from "lucide-react";

export function InsightsView({ state }: { state: OrdoState }) {
  const weekly = useMemo(() => {
    const out: { label: string; value: number }[] = [];
    for (let w = 9; w >= 0; w--) {
      const from = addDays(startOfWeek(new Date()), -7 * w);
      out.push({ label: `${from.getMonth() + 1}/${from.getDate()}`, value: rangeScore(state, from, 7) });
    }
    return out;
  }, [state]);

  const cats = useMemo(() => categoryBreakdown(state), [state]);
  const s = useMemo(() => streak(state), [state]);
  const month = rangeScore(state, addDays(new Date(), -29), 30);
  const trend = weekly.at(-1)!.value - weekly.at(-4)!.value;

  const heat = useMemo(() => {
    const days: { key: string; score: number | null }[] = [];
    const start = addDays(startOfWeek(new Date()), -7 * 25);
    for (let i = 0; i < 26 * 7; i++) {
      const d = addDays(start, i);
      days.push({ key: dateKey(d), score: d > new Date() ? null : dayScore(state, d) });
    }
    return days;
  }, [state]);

  const weakest = [...cats].sort((a, b) => a.value - b.value)[0]!;
  const strongest = [...cats].sort((a, b) => b.value - a.value)[0]!;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat value={`${month}%`} label="Last 30 days" />
        <Stat value={`${s.current}d`} label="Current streak" />
        <Stat value={`${s.best}d`} label="Longest streak" />
        <Stat value={`${trend >= 0 ? "+" : ""}${trend}%`} label="3-week trend" />
      </div>

      <Panel>
        <PanelTitle title="Consistency heatmap" hint="Half a year of discipline at one glance." />
        <div className="overflow-x-auto pb-1">
          <div className="grid grid-flow-col grid-rows-7 gap-1">
            {heat.map((d) => (
              <div
                key={d.key}
                title={`${d.key} — ${d.score === null ? "—" : `${d.score}%`}`}
                className="size-3 rounded-[3px] border border-border/40"
                style={{
                  backgroundColor:
                    d.score === null
                      ? "transparent"
                      : `color-mix(in oklab, var(--primary) ${Math.max(6, d.score)}%, var(--muted))`,
                }}
              />
            ))}
          </div>
        </div>
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel>
          <PanelTitle title="Weekly completion" hint="Last 10 weeks." />
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weekly}>
                <defs>
                  <linearGradient id="ordoFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} />
                <YAxis domain={[0, 100]} stroke="var(--muted-foreground)" fontSize={11} tickLine={false} width={30} />
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    color: "var(--popover-foreground)",
                  }}
                />
                <Area dataKey="value" stroke="var(--primary)" strokeWidth={2} fill="url(#ordoFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel>
          <PanelTitle title="Category balance" hint="Completion by life domain, last 28 days." />
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cats} layout="vertical" margin={{ left: 24 }}>
                <CartesianGrid stroke="var(--border)" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} stroke="var(--muted-foreground)" fontSize={11} />
                <YAxis
                  type="category"
                  dataKey="category"
                  stroke="var(--muted-foreground)"
                  fontSize={11}
                  width={90}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: "var(--muted)" }}
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    color: "var(--popover-foreground)",
                  }}
                />
                <Bar dataKey="value" radius={4} fill="var(--primary)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
            {cats.map((c) => (
              <span key={c.id} className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-full" style={{ backgroundColor: catColor(c.id as CategoryId) }} />
                {c.category} {c.value}%
              </span>
            ))}
          </div>
        </Panel>
      </div>

      <Panel>
        <PanelTitle title="Coach review" hint="Observational, blunt when the data is blunt." />
        <div className="space-y-2 text-sm">
          <p className="flex gap-2">
            <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
            You are strongest in <strong>{strongest.category}</strong> ({strongest.value}%) and weakest in{" "}
            <strong>{weakest.category}</strong> ({weakest.value}%). The imbalance is {strongest.value - weakest.value}{" "}
            points — that gap is a choice, not a coincidence.
          </p>
          <p className="flex gap-2">
            <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
            Your last three weeks moved {trend >= 0 ? "up" : "down"} {Math.abs(trend)} points. One adjustment for next
            week: move your lowest-completion block earlier in the day, before decision fatigue takes it.
          </p>
        </div>
      </Panel>
    </div>
  );
}

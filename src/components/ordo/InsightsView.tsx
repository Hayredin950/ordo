import { useEffect, useMemo, useRef, useState } from "react";
import {
  addDays,
  categoryBreakdown,
  dateKey,
  dayScore,
  rangeScore,
  startOfWeek,
  streak,
  type OrdoState,
} from "@/lib/ordo";
import { categoryColor, useCategories } from "@/lib/categories";
import { useAuth } from "@/lib/auth-context";
import { useIsMobile } from "@/hooks/use-mobile";
import { apiFetch } from "@/lib/api";
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
import { Sparkles, Award, RefreshCw, CalendarRange } from "lucide-react";
import { Button } from "@/components/ui/button";

function YearInReview({ state }: { state: OrdoState }) {
  const { categories } = useCategories();
  const days = 365;
  let sum = 0;
  let n = 0;
  let bestWeek = 0;
  for (let i = days - 1; i >= 0; i--) {
    const d = addDays(new Date(), -i);
    const s = dayScore(state, d);
    if (s !== null) {
      sum += s;
      n++;
    }
  }
  for (let w = 51; w >= 0; w--) {
    const from = addDays(startOfWeek(new Date()), -7 * w);
    const ws = rangeScore(state, from, 7);
    if (ws > bestWeek) bestWeek = ws;
  }
  const cats = categoryBreakdown(state, 365, categories);
  const mostConsistent = [...cats].sort((a, b) => b.value - a.value)[0];
  const avg = n ? Math.round(sum / n) : 0;
  const isNew = n < 7;

  return (
    <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
      <Stat value={isNew ? "New" : `${avg}%`} label="Avg completion (365d)" />
      <Stat value={`${bestWeek}%`} label="Best week" />
      <Stat value={mostConsistent ? `${mostConsistent.category}` : "—"} label="Most consistent" />
      <Stat value={`${n}`} label="Days tracked" />
      <p className="flex gap-2 text-muted-foreground sm:col-span-2 lg:col-span-4">
        <CalendarRange className="mt-0.5 size-4 shrink-0 text-primary" />
        <span>
          {isNew
            ? "Keep logging — the year review needs a few weeks of honest data to mean anything."
            : `Your discipline this year averaged ${avg}% with a best week of ${bestWeek}%. ${mostConsistent ? `Your most consistent domain: ${mostConsistent.category} at ${mostConsistent.value}%.` : ""}`}
        </span>
      </p>
    </div>
  );
}

function badges(s: { current: number; best: number }, month: number) {
  const earned: string[] = [];
  if (s.best >= 7) earned.push("🔥 7-day streak");
  if (s.best >= 30) earned.push("⚡ 30-day streak");
  if (s.best >= 60) earned.push("🏆 60-day streak");
  if (month >= 70) earned.push("🎯 70% month");
  if (s.current >= 3 && month < 40) earned.push("💪 Comeback");
  return earned;
}

/** Gutter labels for the heatmap rows; only odd rows are printed so 12px rows stay legible. */
const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

export function InsightsView({ state }: { state: OrdoState }) {
  const { user } = useAuth();
  const { categories } = useCategories();
  const isMobile = useIsMobile();
  const heatRef = useRef<HTMLDivElement | null>(null);
  const [coach, setCoach] = useState<string | null>(null);
  const [coachBusy, setCoachBusy] = useState(false);

  const loadCoach = async () => {
    if (!user) return;
    setCoachBusy(true);
    try {
      const res = await apiFetch<{ report: string }>("/api/coach/weekly");
      setCoach(res.report);
    } catch {
      setCoach(null);
    } finally {
      setCoachBusy(false);
    }
  };

  useEffect(() => {
    void loadCoach();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const weekly = useMemo(() => {
    const out: { label: string; value: number }[] = [];
    for (let w = 9; w >= 0; w--) {
      const from = addDays(startOfWeek(new Date()), -7 * w);
      out.push({
        label: `${from.getMonth() + 1}/${from.getDate()}`,
        value: rangeScore(state, from, 7),
      });
    }
    return out;
  }, [state]);

  const cats = useMemo(() => categoryBreakdown(state, 28, categories), [state, categories]);
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
  const earned = badges(s, month);
  const points = Math.round(month * (s.current + 1) + s.best * 5);

  // 26 weeks never fit a phone, so open the scroller at today rather than at
  // the six-month-old end nobody is looking for.
  useEffect(() => {
    const el = heatRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [heat.length]);

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5">
        <Stat value={`${month}%`} label="Last 30 days" />
        <Stat value={`${s.current}d`} label="Current streak" />
        <Stat value={`${s.best}d`} label="Longest streak" />
        <Stat value={`${trend >= 0 ? "+" : ""}${trend}%`} label="3-week trend" />
        <Stat value={`${points}`} label="Points" />
      </div>

      {earned.length ? (
        <Panel>
          <PanelTitle title="Milestone badges" hint="Rewards resilience, not just perfection." />
          <div className="flex flex-wrap gap-2">
            {earned.map((b) => (
              <span
                key={b}
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-sm"
              >
                <Award className="size-4 text-primary" />
                {b}
              </span>
            ))}
          </div>
        </Panel>
      ) : null}

      <Panel>
        <PanelTitle title="Consistency heatmap" hint="Half a year of discipline at one glance." />
        <div className="flex gap-1.5">
          {/* Weekday gutter: alternating labels keep the 12px rows readable. */}
          <div
            className="grid shrink-0 grid-rows-7 gap-1 text-[9px] leading-none text-muted-foreground"
            aria-hidden
          >
            {WEEKDAYS.map((d, i) => (
              <span key={i} className="flex h-3 items-center">
                {i % 2 === 1 ? d : ""}
              </span>
            ))}
          </div>
          {/* Starts scrolled to the present, which is the half nobody wants to
              swipe for. */}
          <div ref={heatRef} className="no-scrollbar flex-1 overflow-x-auto pb-1">
            <div className="grid w-max grid-flow-col grid-rows-7 gap-1">
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
        </div>
        <div className="mt-3 flex items-center justify-end gap-1.5 text-[10px] text-muted-foreground">
          <span>less</span>
          {[6, 30, 55, 80, 100].map((v) => (
            <span
              key={v}
              className="size-3 rounded-[3px] border border-border/40"
              style={{
                backgroundColor: `color-mix(in oklab, var(--primary) ${v}%, var(--muted))`,
              }}
            />
          ))}
          <span>more</span>
        </div>
      </Panel>

      <div className="grid gap-4 sm:gap-5 lg:grid-cols-2">
        <Panel>
          <PanelTitle title="Weekly completion" hint="Last 10 weeks." />
          <div className="h-48 sm:h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weekly} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="ordoFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="label"
                  stroke="var(--muted-foreground)"
                  fontSize={10}
                  tickLine={false}
                  interval="preserveStartEnd"
                  minTickGap={12}
                />
                <YAxis
                  domain={[0, 100]}
                  stroke="var(--muted-foreground)"
                  fontSize={10}
                  tickLine={false}
                  width={28}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    color: "var(--popover-foreground)",
                  }}
                />
                <Area
                  dataKey="value"
                  stroke="var(--primary)"
                  strokeWidth={2}
                  fill="url(#ordoFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel>
          <PanelTitle title="Category balance" hint="Completion by life domain, last 28 days." />
          <div className="h-48 sm:h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cats} layout="vertical" margin={{ left: 0, right: 8 }}>
                <CartesianGrid stroke="var(--border)" horizontal={false} />
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  stroke="var(--muted-foreground)"
                  fontSize={10}
                />
                <YAxis
                  type="category"
                  dataKey="category"
                  stroke="var(--muted-foreground)"
                  fontSize={10}
                  /* A 90px label gutter swallows a third of a 360px screen. */
                  width={isMobile ? 64 : 92}
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
          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {cats.map((c) => (
              <span key={c.id} className="inline-flex items-center gap-1.5">
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: categoryColor(categories, c.id) }}
                />
                {c.category} {c.value}%
              </span>
            ))}
          </div>
        </Panel>
      </div>

      <Panel>
        <PanelTitle
          title="Year in review"
          hint="Your discipline, summed up. Refresh after a big week."
        />
        <YearInReview state={state} />
      </Panel>

      <Panel>
        <PanelTitle
          title="Coach review"
          hint={
            user
              ? "Generated server-side — Claude when configured, rule-based otherwise."
              : "Local rule-based review. Sign in for the server version."
          }
          action={
            user ? (
              <Button
                variant="ghost"
                size="icon"
                aria-label="Refresh coach report"
                onClick={() => void loadCoach()}
              >
                <RefreshCw className={`size-4 ${coachBusy ? "animate-spin" : ""}`} />
              </Button>
            ) : null
          }
        />
        {coach ? (
          <div
            className="space-y-2 whitespace-pre-line text-sm"
            dangerouslySetInnerHTML={{ __html: coach }}
          />
        ) : (
          <div className="space-y-2 text-sm">
            <p className="flex gap-2">
              <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
              You are strongest in <strong>{strongest.category}</strong> ({strongest.value}%) and
              weakest in <strong>{weakest.category}</strong> ({weakest.value}%). The imbalance is{" "}
              {strongest.value - weakest.value} points — that gap is a choice, not a coincidence.
            </p>
            <p className="flex gap-2">
              <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
              Your last three weeks moved {trend >= 0 ? "up" : "down"} {Math.abs(trend)} points. One
              adjustment for next week: move your lowest-completion block earlier in the day, before
              decision fatigue takes it.
            </p>
          </div>
        )}
      </Panel>
    </div>
  );
}

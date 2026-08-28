import { useCallback, useEffect, useState } from "react";
import * as db from "@/lib/db";
import type { AdminOverview as Overview } from "@/lib/db";
import { useAuth } from "@/lib/auth-context";
import { Panel, PanelTitle, Stat } from "@/components/ordo/primitives";
import { Button } from "@/components/ui/button";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";

/** Grouped so the grid reads as three ideas rather than seventeen numbers. */
const GROUPS: { title: string; cells: { key: keyof Overview; label: string }[] }[] = [
  {
    title: "People",
    cells: [
      { key: "users", label: "Accounts" },
      { key: "admins", label: "Admins" },
      { key: "new_7d", label: "New (7d)" },
      { key: "active_7d", label: "Active (7d)" },
    ],
  },
  {
    title: "Usage",
    cells: [
      { key: "documents", label: "Plans saved" },
      { key: "active_24h", label: "Active (24h)" },
      { key: "avg_weekly", label: "Avg weekly %" },
      { key: "categories", label: "Custom categories" },
    ],
  },
  {
    title: "Social & channels",
    cells: [
      { key: "challenges", label: "Challenges" },
      { key: "challenge_members", label: "Challenge members" },
      { key: "pairings", label: "Pairings" },
      { key: "templates", label: "Shared templates" },
      { key: "letters_pending", label: "Letters pending" },
      { key: "telegram_linked", label: "Telegram linked" },
      { key: "slack_linked", label: "Slack linked" },
      { key: "notifications_7d", label: "Notifications (7d)" },
    ],
  },
];

export function AdminOverview() {
  const { health } = useAuth();
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      setData(await db.adminOverview());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the overview");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) {
    return (
      <Panel>
        <PanelTitle title="Overview" hint="Live figures straight from Postgres." />
        <p className="flex items-center gap-2 text-sm text-destructive">
          <AlertTriangle className="size-4 shrink-0" /> {error}
        </p>
        <Button size="sm" variant="secondary" className="tap mt-3" onClick={() => void load()}>
          <RefreshCw className="size-4" /> Try again
        </Button>
      </Panel>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      <Panel>
        <PanelTitle
          title="Overview"
          hint="Live figures straight from Postgres — aggregates only, never anyone's plan."
          action={
            <Button
              size="sm"
              variant="secondary"
              className="tap w-full sm:w-auto"
              disabled={busy}
              onClick={() => void load()}
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              Refresh
            </Button>
          }
        />
        {!data ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading figures…</p>
        ) : (
          <div className="space-y-4">
            {GROUPS.map((g) => (
              <div key={g.title}>
                <p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                  {g.title}
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {g.cells.map((c) => (
                    <Stat key={c.key} value={String(data[c.key] ?? 0)} label={c.label} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <div className="grid gap-4 sm:gap-5 lg:grid-cols-[1.6fr_1fr]">
        <Panel>
          <PanelTitle title="Last 14 days" hint="Signups against accounts that saved something." />
          <div className="h-56 sm:h-64">
            {data ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.series} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                  <defs>
                    <linearGradient id="adminActive" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.03} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="day"
                    tickFormatter={(v: string) => v.slice(5)}
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    stroke="var(--border)"
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    stroke="var(--border)"
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      color: "var(--popover-foreground)",
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Area
                    type="monotone"
                    dataKey="active"
                    name="Active"
                    stroke="var(--primary)"
                    fill="url(#adminActive)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="signups"
                    name="Signups"
                    stroke="var(--cat-study)"
                    fill="transparent"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : null}
          </div>
        </Panel>

        <Panel>
          <PanelTitle title="System health" hint="What the server reports it can actually do." />
          <ul className="space-y-2 text-sm">
            <HealthRow
              label="API"
              ok={Boolean(health)}
              note={health ? "reachable" : "unreachable"}
            />
            <HealthRow
              label="Telegram bot"
              ok={Boolean(health?.telegram)}
              note={health?.telegramBot ? `@${health.telegramBot}` : "not configured"}
            />
            <HealthRow
              label="Slack"
              ok={Boolean(health?.slack)}
              note={health?.slack ? "configured" : "not configured"}
            />
            <HealthRow
              label="AI coach"
              ok={Boolean(health?.anthropic)}
              note={health?.anthropic ? "Claude" : "rule-based fallback"}
            />
            <HealthRow
              label="GitHub sign-in"
              ok={Boolean(health?.github)}
              note={health?.github ? "enabled" : "off"}
            />
            <HealthRow
              label="Google sign-in"
              ok={Boolean(health?.google)}
              note={health?.google ? "enabled" : "off"}
            />
          </ul>
        </Panel>
      </div>
    </div>
  );
}

function HealthRow({ label, ok, note }: { label: string; ok: boolean; note: string }) {
  return (
    <li className="flex items-center gap-2 rounded-lg border border-border bg-background/40 p-2.5">
      <span
        className="size-2 shrink-0 rounded-full"
        style={{ backgroundColor: ok ? "var(--cat-health)" : "var(--muted-foreground)" }}
        aria-hidden
      />
      <span className="flex-1 truncate font-medium">{label}</span>
      <span className="shrink-0 truncate text-xs text-muted-foreground">{note}</span>
    </li>
  );
}

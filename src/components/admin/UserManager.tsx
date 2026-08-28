import { useCallback, useEffect, useState } from "react";
import * as db from "@/lib/db";
import type { AdminUser } from "@/lib/db";
import { useAuth } from "@/lib/auth-context";
import { Panel, PanelTitle } from "@/components/ordo/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  AlertTriangle,
  Loader2,
  Search,
  Send,
  Shield,
  ShieldOff,
  Slack,
  User as UserIcon,
} from "lucide-react";
import { toast } from "sonner";

const shortDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "never";

/**
 * Search, inspect and promote accounts. Everything shown here comes from
 * `admin_list_users`, which returns aggregates — weekly %, block count, channel
 * flags — and never a user's blocks, journal or goals.
 */
export function UserManager() {
  const { user } = useAuth();
  const [rows, setRows] = useState<AdminUser[] | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (q: string) => {
    setBusy(true);
    setError(null);
    try {
      setRows(await db.adminListUsers(q, 100));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load users");
      setRows(null);
    } finally {
      setBusy(false);
    }
  }, []);

  // Debounced so typing an email does not fire a query per keystroke.
  useEffect(() => {
    const t = setTimeout(() => void load(search.trim()), search ? 350 : 0);
    return () => clearTimeout(t);
  }, [search, load]);

  const setRole = async (row: AdminUser, role: "user" | "admin") => {
    try {
      await db.adminSetRole(row.id, role);
      setRows((rs) => (rs ? rs.map((r) => (r.id === row.id ? { ...r, role } : r)) : rs));
      toast.success(
        role === "admin" ? `${row.email} is now an admin` : `${row.email} is back to a normal user`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not change that role");
    }
  };

  return (
    <Panel>
      <PanelTitle
        title="Users"
        hint="Aggregates only — you can see how much someone uses Ordo, never what they wrote."
      />

      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by email or name"
          aria-label="Search users"
          className="pl-8"
        />
      </div>

      {error ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-destructive">
          <AlertTriangle className="size-4 shrink-0" /> {error}
        </p>
      ) : null}

      <div className="mt-3 space-y-2">
        {busy && !rows ? (
          <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading accounts…
          </p>
        ) : null}
        {rows?.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No account matches “{search.trim()}”.
          </p>
        ) : null}
        {rows?.map((r) => {
          const isMe = r.id === user?.id;
          return (
            <div
              key={r.id}
              className="rounded-lg border border-border bg-background/40 p-3 text-sm"
            >
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
                  {r.role === "admin" ? (
                    <Shield className="size-4 text-primary" />
                  ) : (
                    <UserIcon className="size-4 text-muted-foreground" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="truncate font-medium">{r.name || r.email}</span>
                    {r.role === "admin" ? (
                      <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">
                        admin
                      </span>
                    ) : null}
                    {isMe ? (
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                        you
                      </span>
                    ) : null}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{r.email}</p>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                    <span>joined {shortDate(r.created_at)}</span>
                    <span>active {shortDate(r.last_active)}</span>
                    <span>{r.blocks} blocks</span>
                    <span>via {r.provider}</span>
                    {r.telegram ? (
                      <span className="inline-flex items-center gap-1">
                        <Send className="size-3" /> Telegram
                      </span>
                    ) : null}
                    {r.slack ? (
                      <span className="inline-flex items-center gap-1">
                        <Slack className="size-3" /> Slack
                      </span>
                    ) : null}
                  </div>
                </div>
                <span className="shrink-0 rounded bg-muted px-2 py-1 font-display text-sm font-semibold tabular-nums">
                  {r.weekly === null ? "—" : `${r.weekly}%`}
                </span>
              </div>

              {/* Self-demotion and demoting the founder are refused by the
                  database, so the control is simply not offered here. */}
              {isMe ? null : (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="secondary" size="sm" className="tap mt-3 w-full sm:w-auto">
                      {r.role === "admin" ? (
                        <>
                          <ShieldOff className="size-4" /> Remove admin
                        </>
                      ) : (
                        <>
                          <Shield className="size-4" /> Make admin
                        </>
                      )}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        {r.role === "admin"
                          ? `Remove admin from ${r.email}?`
                          : `Make ${r.email} an admin?`}
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        {r.role === "admin"
                          ? "They keep their own data and lose access to this dashboard, the category list and announcements."
                          : "Admins can edit the global category list, post announcements, moderate the template library and promote other people."}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="tap">Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        className="tap"
                        onClick={() => void setRole(r, r.role === "admin" ? "user" : "admin")}
                      >
                        {r.role === "admin" ? "Remove admin" : "Make admin"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

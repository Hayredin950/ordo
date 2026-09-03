import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ExportKind } from "@/lib/export";
import type { HourFormat } from "@/lib/ordo";
import {
  BarChart3,
  Bell,
  CalendarCheck,
  CalendarClock,
  CalendarPlus,
  Clock,
  FileJson,
  FileSpreadsheet,
  LogIn,
  LogOut,
  MoreVertical,
  RotateCcw,
  Shield,
  Sparkles,
  Target,
  Redo2,
  Undo2,
  Users,
} from "lucide-react";

export const TABS = [
  { id: "Today", icon: CalendarCheck },
  { id: "Routine", icon: CalendarClock },
  { id: "Goals", icon: Target },
  { id: "Insights", icon: BarChart3 },
  { id: "Community", icon: Users },
] as const;

export type TabId = (typeof TABS)[number]["id"];

const EXPORTS = [
  { kind: "json" as const, label: "Export JSON", Icon: FileJson },
  { kind: "csv" as const, label: "Export CSV", Icon: FileSpreadsheet },
  { kind: "ical" as const, label: "Export iCal", Icon: CalendarPlus },
];

type ShellProps = {
  tab: TabId;
  onTab: (tab: TabId) => void;
  /** This week's completion, shown in the header at every breakpoint. */
  week: number;
  undoBusy: boolean;
  onUndo: () => void;
  redoBusy: boolean;
  onRedo: () => void;
  onReset: () => void;
  onExport: (kind: ExportKind) => void;
  /** Current clock preference, and the one-tap way to flip it. */
  hourFormat: HourFormat;
  onHourFormat: (format: HourFormat) => void;
  children: ReactNode;
};

/**
 * The week score. Deliberately the one number that never gets hidden on a
 * narrow screen — it is the app's whole point — so only its caption shortens.
 */
function WeekScore({ value }: { value: number }) {
  return (
    <div
      className="flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-surface/70 py-1 pl-2.5 pr-3"
      title={`${value}% of this week's blocks completed`}
    >
      <span className="font-display text-sm font-bold leading-none tabular-nums sm:text-base">
        {value}%
      </span>
      <span className="text-[10px] leading-none text-muted-foreground">
        <span className="sm:hidden">wk</span>
        <span className="hidden sm:inline">this week</span>
      </span>
    </div>
  );
}

/**
 * Everything that used to be six separate header controls. Undo and Reset stay
 * as icon buttons on a wide screen, so they are hidden from the menu there
 * rather than listed twice.
 */
function AccountMenu({
  undoBusy,
  onUndo,
  redoBusy,
  onRedo,
  onReset,
  onExport,
  hourFormat,
  onHourFormat,
}: Pick<
  ShellProps,
  | "undoBusy"
  | "onUndo"
  | "redoBusy"
  | "onRedo"
  | "onReset"
  | "onExport"
  | "hourFormat"
  | "onHourFormat"
>) {
  const { user, isAdmin, logout } = useAuth();
  if (!user) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="tap" aria-label="Account, data and export">
          <MoreVertical className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm font-medium">{user.name || user.email}</p>
          <p className="truncate text-xs text-muted-foreground">signed in with {user.provider}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {isAdmin ? (
          <>
            <DropdownMenuItem asChild className="lg:hidden">
              <Link to="/admin">
                <Shield /> Admin console
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="lg:hidden" />
          </>
        ) : null}
        {/* The full control lives in Community → Preferences; this is the shortcut
            for the one setting people flip while looking at a schedule. */}
        <DropdownMenuItem onSelect={() => onHourFormat(hourFormat === "24h" ? "12h" : "24h")}>
          <Clock /> {hourFormat === "24h" ? "Switch to 12-hour (AM/PM)" : "Switch to 24-hour"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="lg:hidden" disabled={undoBusy} onSelect={onUndo}>
          <Undo2 /> Undo last change
        </DropdownMenuItem>
        <DropdownMenuItem className="lg:hidden" disabled={redoBusy} onSelect={onRedo}>
          <Redo2 /> Redo last change
        </DropdownMenuItem>
        <DropdownMenuItem className="lg:hidden" onSelect={onReset}>
          <RotateCcw /> Reset my data
        </DropdownMenuItem>
        <DropdownMenuSeparator className="lg:hidden" />
        {EXPORTS.map(({ kind, label, Icon }) => (
          <DropdownMenuItem key={kind} onSelect={() => onExport(kind)}>
            <Icon /> {label}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void logout()}>
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * App chrome. Navigation lives in the header from `lg` up and in a fixed bottom
 * bar below it, which is where a thumb actually reaches on a phone — the old
 * single wrapping header row grew to three lines at 375px.
 */
export function AppShell({
  tab,
  onTab,
  week,
  undoBusy,
  onUndo,
  redoBusy,
  onRedo,
  onReset,
  onExport,
  hourFormat,
  onHourFormat,
  children,
}: ShellProps) {
  const { user, isAdmin, health } = useAuth();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="pt-safe sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-2 px-3 sm:h-16 sm:px-5">
          <a href="/" className="flex shrink-0 items-center gap-2">
            <img src="/logo-icon.png" alt="Ordo logo" className="size-8 sm:size-10" />
            <span className="font-display text-lg font-bold tracking-tight sm:text-xl">Ordo</span>
          </a>

          <nav aria-label="Sections" className="mx-auto hidden gap-1 lg:flex">
            {TABS.map(({ id }) => (
              <button
                key={id}
                type="button"
                onClick={() => onTab(id)}
                aria-current={tab === id ? "page" : undefined}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  tab === id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                {id}
              </button>
            ))}
            {/* Not one of TABS: it is a separate page, and a sixth item would
                overflow the phone's bottom bar. Admins get it inline here and as
                an icon beside the account menu below `lg`. */}
            {isAdmin ? (
              <Link
                to="/admin"
                className="ml-1 flex items-center gap-1.5 rounded-md border border-primary/40 px-3 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
              >
                <Shield className="size-3.5" /> Admin
              </Link>
            ) : null}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-1.5">
            <WeekScore value={week} />
            {user ? (
              <>
                {isAdmin ? (
                  <Link to="/admin" className="lg:hidden">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="tap text-primary"
                      aria-label="Admin console"
                      title="Admin console"
                    >
                      <Shield className="size-4" />
                    </Button>
                  </Link>
                ) : null}
                <Button
                  variant="ghost"
                  size="icon"
                  className="hidden lg:inline-flex"
                  aria-label="Undo last change"
                  title="Undo last change"
                  disabled={undoBusy}
                  onClick={onUndo}
                >
                  <Undo2 className={cn("size-4", undoBusy && "animate-pulse")} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="hidden lg:inline-flex"
                  aria-label="Redo last change"
                  title="Redo last change"
                  disabled={redoBusy}
                  onClick={onRedo}
                >
                  <Redo2 className={cn("size-4", redoBusy && "animate-pulse")} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="hidden lg:inline-flex"
                  aria-label="Reset my data"
                  title="Reset my data"
                  onClick={onReset}
                >
                  <RotateCcw className="size-4" />
                </Button>
                <AccountMenu
                  undoBusy={undoBusy}
                  onUndo={onUndo}
                  redoBusy={redoBusy}
                  onRedo={onRedo}
                  onReset={onReset}
                  onExport={onExport}
                  hourFormat={hourFormat}
                  onHourFormat={onHourFormat}
                />
              </>
            ) : (
              <Link to="/login">
                <Button size="sm" variant="outline" className="tap">
                  <LogIn className="size-3.5" /> Sign in
                </Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-3 py-4 sm:px-5 sm:py-6">{children}</main>

      {/* The bottom bar overlays the page, so the footer reserves room for it. */}
      <footer className="mx-auto w-full max-w-6xl px-3 pb-24 text-xs text-muted-foreground sm:px-5 lg:pb-10">
        <div className="flex flex-col gap-1 border-t border-border/60 pt-4 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4">
          <span>Ordo — all data syncs per-user when you're signed in.</span>
          <span className="flex items-center gap-1">
            <Bell className="size-3 shrink-0" /> Telegram bot:{" "}
            {health?.telegram ? "active" : "not configured"}
          </span>
          <span className="flex items-center gap-1">
            <Sparkles className="size-3 shrink-0" /> AI coach:{" "}
            {health?.anthropic ? "Claude" : "rule-based"}
          </span>
          {!user ? <span>Signed out — data stays in this browser.</span> : null}
        </div>
      </footer>

      <nav
        aria-label="Sections"
        className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/95 backdrop-blur-md lg:hidden"
      >
        <div className="mx-auto grid max-w-md grid-cols-5">
          {TABS.map(({ id, icon: Icon }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onTab(id)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-[56px] flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex h-6 w-9 items-center justify-center rounded-full transition-colors",
                    active && "bg-primary/15",
                  )}
                >
                  <Icon className="size-[18px]" />
                </span>
                {id}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

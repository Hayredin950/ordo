import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import type { HourFormat } from "@/lib/ordo";
import { cn } from "@/lib/utils";
import { Panel, PanelTitle } from "@/components/ordo/primitives";
import { Button } from "@/components/ui/button";
import { AdminOverview } from "./AdminOverview";
import { CategoryManager } from "./CategoryManager";
import { UserManager } from "./UserManager";
import { AnnouncementManager } from "./AnnouncementManager";
import { LibraryModeration } from "./LibraryModeration";
import {
  ArrowLeft,
  LayoutDashboard,
  Library,
  Megaphone,
  Shapes,
  ShieldAlert,
  Users,
} from "lucide-react";

const SECTIONS = [
  { id: "Overview", icon: LayoutDashboard },
  { id: "Categories", icon: Shapes },
  { id: "Users", icon: Users },
  { id: "Announcements", icon: Megaphone },
  { id: "Library", icon: Library },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

/**
 * The admin console. Its own page rather than a sixth bottom-nav tab: five tabs
 * already fill a 320px bar, and this is not a daily surface.
 *
 * The guard here is cosmetic. Every call it makes is a SECURITY DEFINER function
 * or an admin-only policy, so a non-admin who reached this page would see a
 * screen full of "Admins only" errors rather than anybody's data.
 */
export function AdminDashboard({ hourFormat = "24h" }: { hourFormat?: HourFormat }) {
  const { user, isAdmin, loading } = useAuth();
  const [section, setSection] = useState<SectionId>("Overview");

  if (loading) return <div className="min-h-dvh" aria-busy="true" />;

  if (!user || !isAdmin) {
    return (
      <div className="mx-auto w-full max-w-md px-4 py-16">
        <Panel>
          <PanelTitle title="Admins only" hint="This console manages the whole app." />
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <ShieldAlert className="mt-0.5 size-4 shrink-0 text-primary" />
            {user
              ? "Your account is not an admin. Ask an admin to promote you if you need access."
              : "Sign in with an admin account to continue."}
          </p>
          <div className="mt-4 flex gap-2">
            <Link to="/" className="flex-1">
              <Button variant="secondary" size="sm" className="tap w-full">
                <ArrowLeft className="size-4" /> Back to Ordo
              </Button>
            </Link>
            {user ? null : (
              <Link to="/login" className="flex-1">
                <Button size="sm" className="tap w-full">
                  Sign in
                </Button>
              </Link>
            )}
          </div>
        </Panel>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="pt-safe sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-2 px-3 sm:h-16 sm:px-5">
          <Link to="/" className="flex shrink-0 items-center gap-2">
            <img src="/logo-icon.png" alt="Ordo logo" className="size-8 sm:size-9" />
            <span className="font-display text-base font-bold tracking-tight sm:text-lg">
              Ordo
              <span className="ml-1.5 rounded bg-primary/15 px-1.5 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-wide text-primary">
                admin
              </span>
            </span>
          </Link>

          <nav aria-label="Admin sections" className="mx-auto hidden gap-1 lg:flex">
            {SECTIONS.map(({ id }) => (
              <button
                key={id}
                type="button"
                onClick={() => setSection(id)}
                aria-current={section === id ? "page" : undefined}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  section === id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                {id}
              </button>
            ))}
          </nav>

          <div className="ml-auto shrink-0">
            <Link to="/">
              <Button variant="outline" size="sm" className="tap">
                <ArrowLeft className="size-3.5" />
                <span className="hidden sm:inline">Back to app</span>
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Below `lg` the sections scroll horizontally under the header: five
          labels with icons do not fit a phone line, and a second fixed bottom
          bar would collide with the app's own. */}
      <div className="sticky top-14 z-30 border-b border-border/70 bg-background/85 backdrop-blur-md sm:top-16 lg:hidden">
        <div className="scroll-row mx-auto max-w-6xl gap-1 px-3 py-2 sm:px-5">
          {SECTIONS.map(({ id, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setSection(id)}
              aria-current={section === id ? "page" : undefined}
              className={cn(
                "scroll-row-item tap inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                section === id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground",
              )}
            >
              <Icon className="size-4" />
              {id}
            </button>
          ))}
        </div>
      </div>

      <main className="mx-auto w-full max-w-6xl flex-1 px-3 py-4 sm:px-5 sm:py-6">
        {section === "Overview" ? <AdminOverview /> : null}
        {section === "Categories" ? <CategoryManager /> : null}
        {section === "Users" ? <UserManager /> : null}
        {section === "Announcements" ? <AnnouncementManager /> : null}
        {section === "Library" ? <LibraryModeration hourFormat={hourFormat} /> : null}
      </main>

      <footer className="mx-auto w-full max-w-6xl px-3 pb-10 text-xs text-muted-foreground sm:px-5">
        <p className="border-t border-border/60 pt-4">
          Signed in as {user.email}. Every action here is enforced by row level security in
          Postgres, not by this page.
        </p>
      </footer>
    </div>
  );
}

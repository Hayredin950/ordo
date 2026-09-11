import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — Ordo" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <>
      <div className="flex min-h-dvh flex-col">
        <header className="pt-safe sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-md">
          <div className="mx-auto flex h-14 w-full max-w-2xl items-center gap-1 px-3 sm:h-16 sm:px-5">
            <Link
              to="/"
              aria-label="Back to Ordo"
              className="tap -ml-1 inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            </Link>
            <h1 className="font-display text-lg font-bold tracking-tight sm:text-xl">About Ordo</h1>
          </div>
        </header>

        <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-3 py-6 sm:px-5 sm:py-8">
          {/* Hero */}
          <section className="rounded-xl border border-border bg-card p-6 sm:p-8">
            <div className="flex items-center gap-4">
              <img src="/logo-icon.png" alt="Ordo" className="size-14" />
              <div>
                <h2 className="font-display text-2xl font-bold tracking-tight">Ordo</h2>
                <p className="text-sm text-muted-foreground">Personal Accountability & Goal Tracking</p>
              </div>
            </div>
            <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
              Plan your year down to the hour, log reality, and let the data do the nagging.
              Ordo separates what you <em>intended</em> to do from what you <em>actually</em> did,
              then visualises the gap with streaks, heatmaps and honest weekly reviews.
            </p>
          </section>

          {/* What Ordo Does */}
          <section className="space-y-3">
            <h2 className="font-display text-sm font-semibold text-primary">What Ordo Does</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { icon: "🎯", title: "Goal Hierarchy", desc: "Define goals at every scale — year, semester, month, week, day — each rolling up into the one above." },
                { icon: "📅", title: "Time-Block Routines", desc: "Create a default routine per weekday with per-date overrides. Copy to other days, weeks or ranges in one tap." },
                { icon: "📊", title: "Streaks & Heatmap", desc: "A GitHub-style consistency heatmap over the last six months, milestone badges, and a live streak counter." },
                { icon: "🤖", title: "AI Coach", desc: "Weekly reflection and catch-up proposals powered by Anthropic Claude when configured, with a rule-based fallback." },
                { icon: "📲", title: "Bot Integrations", desc: "Morning briefs, block reminders, unlogged must-do nags, evening check-ins and weekly reports via Telegram & Slack." },
                { icon: "✉️", title: "Future-Self Letters", desc: "Sealed at goal-setting time and delivered by the bot on their deadline — accountability you can't ignore." },
                { icon: "👥", title: "Community", desc: "Pair with a friend to see each other's weekly percentage, publish routines to a public template library, or join opt-in challenges." },
                { icon: "🔄", title: "Plan vs. Log", desc: "The plan and the log are separate objects. Every score, streak, and chart is computed from the log, never the plan." },
              ].map((item) => (
                <div key={item.title} className="rounded-xl border border-border bg-card p-4">
                  <span className="text-2xl">{item.icon}</span>
                  <p className="mt-2 font-display text-sm font-semibold">{item.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Design Philosophy */}
          <section className="rounded-xl border border-border bg-card p-6">
            <h2 className="font-display text-sm font-semibold text-primary">Design Philosophy</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              The plan (what should happen) and the log (what did happen) are deliberately separate objects.
              Every score, streak, and chart is computed from the log, never from the plan.
              When signed out, everything runs on local storage as a demo; signing in syncs the same
              document per-user to the cloud. There is no separate backend server — Supabase (Postgres
              with Row Level Security) is the backend.
            </p>
          </section>

          {/* Tech Stack */}
          <section className="rounded-xl border border-border bg-card p-6">
            <h2 className="font-display text-sm font-semibold text-primary">Built With</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {["TanStack Start", "React", "TypeScript", "Supabase", "Tailwind CSS", "Flutter", "Dart"].map((tech) => (
                <span key={tech} className="rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-muted-foreground">
                  {tech}
                </span>
              ))}
            </div>
          </section>

          {/* Version */}
          <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
            <InfoIcon className="size-[18px] shrink-0 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">v1.0.0 &middot; Ordo &middot; All rights reserved</p>
          </div>
        </main>
      </div>
    </>
  );
}

function InfoIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
  );
}

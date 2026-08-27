/**
 * The one scheduler endpoint. Three pingers call it and it is safe for all of
 * them to overlap, because every message is claimed in `notification_log`
 * before it goes out:
 *
 *   1. GitHub Actions — .github/workflows/cron.yml, every 5 minutes. This is
 *      what makes the 10-minute reminders and nags actually timely.
 *   2. Vercel Cron — vercel.json, once a day (the Hobby plan's limit). A floor
 *      that keeps the daily brief and letters moving if Actions is disabled.
 *   3. Any external cron service (cron-job.org, Upstash QStash, EasyCron…):
 *      point it at this URL with the same Authorization header.
 *
 * Auth is `Authorization: Bearer $CRON_SECRET`. Vercel Cron sends that header
 * automatically once CRON_SECRET is set in the project's env vars; the other two
 * must send it themselves.
 */
import { createFileRoute } from "@tanstack/react-router";
import { fail, json, serverConfig } from "@/lib/server/config.server";
import { serviceConfigured } from "@/lib/server/supabase.server";
import { runTick } from "@/lib/server/tick.server";

/** Length-independent comparison, so a wrong secret leaks nothing by timing. */
function secretMatches(request: Request): boolean {
  const expected = serverConfig.cronSecret;
  if (!expected) return false;
  const header = request.headers.get("authorization") ?? "";
  const presented = /^Bearer\s+(.+)$/i.exec(header.trim())?.[1]?.trim() ?? "";
  if (presented.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++)
    diff |= presented.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

async function tick({ request }: { request: Request }): Promise<Response> {
  if (!serverConfig.cronSecret) return fail(503, "CRON_SECRET not set");
  if (!secretMatches(request)) return fail(401, "Unauthorized");
  if (!serviceConfigured()) return fail(503, "SUPABASE_SERVICE_ROLE_KEY not set");

  try {
    return json(await runTick());
  } catch (err) {
    console.error("[cron] tick failed", err);
    return fail(500, err instanceof Error ? err.message : "Tick failed");
  }
}

export const Route = createFileRoute("/api/cron/tick")({
  server: {
    // GET for Vercel Cron and browsers; POST for pingers that insist on it.
    handlers: { GET: tick, POST: tick },
  },
});

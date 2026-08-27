/**
 * Registers the daily Vercel cron job on the build output.
 *
 * Nitro emits Build Output API v3 artifacts, and Vercel reads cron jobs from
 * `.vercel/output/config.json` — not from a root `vercel.json` — so the schedule
 * has to be injected after the build. Vercel's Hobby plan allows one invocation
 * per day, which is why 07:00 UTC is the only entry: GitHub Actions
 * (.github/workflows/cron.yml) does the every-5-minutes work.
 *
 * No-ops when there is no Vercel output, so Cloudflare and Lovable builds are
 * unaffected.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const CONFIG = ".vercel/output/config.json";
const CRON = { path: "/api/cron/tick", schedule: "0 7 * * *" };

if (!existsSync(CONFIG)) {
  console.log(`[vercel-crons] ${CONFIG} not found — not a Vercel build, skipping`);
  process.exit(0);
}

const config = JSON.parse(readFileSync(CONFIG, "utf8"));
const crons = config.crons ?? [];

if (crons.some((c) => c.path === CRON.path && c.schedule === CRON.schedule)) {
  console.log(`[vercel-crons] ${CRON.path} already registered`);
  process.exit(0);
}

config.crons = [...crons.filter((c) => c.path !== CRON.path), CRON];
writeFileSync(CONFIG, `${JSON.stringify(config, null, 2)}\n`);
console.log(`[vercel-crons] registered ${CRON.path} at "${CRON.schedule}"`);

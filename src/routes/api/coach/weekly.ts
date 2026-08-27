/**
 * The AI coach's weekly report. Server-side because it holds the Anthropic key;
 * the caller's own access token is what fetches their state, so this route can
 * only ever summarize the person who asked.
 */
import { createFileRoute } from "@tanstack/react-router";
import { fail, json } from "@/lib/server/config.server";
import { callerState } from "@/lib/server/state.server";
import { generateWeeklyReport } from "@/lib/server/coach.server";

export const Route = createFileRoute("/api/coach/weekly")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const state = await callerState(request);
        if (!state) return fail(401, "Sign in to get a weekly report");
        return json({ report: await generateWeeklyReport(state) });
      },
    },
  },
});

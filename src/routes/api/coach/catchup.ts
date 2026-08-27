/**
 * Catch-up proposal: what last week's missed must-dos would cost to make good.
 * Deterministic — no model call — but it still needs the caller's state, so it
 * lives here rather than in the browser.
 */
import { createFileRoute } from "@tanstack/react-router";
import { fail, json } from "@/lib/server/config.server";
import { callerState } from "@/lib/server/state.server";
import { proposeCatchUp } from "@/lib/server/coach.server";

export const Route = createFileRoute("/api/coach/catchup")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const state = await callerState(request);
        if (!state) return fail(401, "Sign in to get a catch-up proposal");
        return json({ proposal: proposeCatchUp(state) });
      },
    },
  },
});

import { config } from "../config.js";

type OrdoState = {
  routine?: Record<string, { id: string; title: string; start: string; end: string; category: string; priority?: string }[]>;
  overrides?: Record<string, unknown[]>;
  log?: Record<string, Record<string, number>>;
  journal?: Record<string, string>;
  goals?: { id: string; title: string; period: string; target: number }[];
};

const dateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function summarizeWeek(state: OrdoState): {
  total: number;
  perDay: { date: string; score: number | null }[];
  skipped: string[];
  bestCategory: string;
  weakestCategory: string;
} {
  const today = new Date();
  const perDay: { date: string; score: number | null }[] = [];
  const catAcc: Record<string, { sum: number; n: number }> = {};
  const skipped = new Set<string>();

  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = dateKey(d);
    const blocks = state.routine?.[String(d.getDay())] ?? [];
    if (!blocks.length) {
      perDay.push({ date: key, score: null });
      continue;
    }
    const entries = state.log?.[key] ?? {};
    let sum = 0;
    for (const b of blocks) {
      const pct = entries[b.id] ?? 0;
      sum += pct;
      const c = (catAcc[b.category] ??= { sum: 0, n: 0 });
      c.sum += pct;
      c.n += 1;
      if (pct < 50 && b.priority !== "nice") skipped.add(b.title);
    }
    perDay.push({ date: key, score: Math.round(sum / blocks.length) });
  }

  const cats = Object.entries(catAcc)
    .map(([k, v]) => ({ category: k, value: v.n ? Math.round(v.sum / v.n) : 0 }))
    .sort((a, b) => a.value - b.value);
  const scored = perDay.filter((p): p is { date: string; score: number } => p.score !== null);
  const total = scored.length ? Math.round(scored.reduce((s, p) => s + p.score, 0) / scored.length) : 0;

  return {
    total,
    perDay,
    skipped: [...skipped].slice(0, 8),
    bestCategory: cats.at(-1)?.category ?? "—",
    weakestCategory: cats[0]?.category ?? "—",
  };
}

/** Claude-powered weekly report with a deterministic fallback. */
export async function generateWeeklyReport(state: OrdoState): Promise<string> {
  const summary = summarizeWeek(state);

  if (config.anthropicApiKey) {
    try {
      const prompt = `You are Ordo's coach — observational, blunt when the data is blunt. Here is a week of a user's plan-vs-reality data:
- Week completion: ${summary.total}%
- Per day: ${summary.perDay.map((p) => `${p.date}: ${p.score ?? "no plan"}`).join(", ")}
- Consistently skipped: ${summary.skipped.join(", ") || "none"}
- Strongest category: ${summary.bestCategory} · Weakest: ${summary.weakestCategory}
- Journal: ${Object.entries(state.journal ?? {}).slice(-3).map(([k, v]) => `${k}: ${v}`).join(" | ") || "no entries"}
- Goals: ${(state.goals ?? []).map((g) => `${g.title} (${g.period}, target ${g.target}%)`).join("; ") || "none"}

Write a short weekly report (max 120 words): what went well, what consistently got skipped, and ONE concrete adjustment for next week. Be direct, never sycophantic.`;

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": config.anthropicApiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: config.anthropicModel,
          max_tokens: 300,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const json = (await res.json()) as {
        content?: { text?: string }[];
        error?: { message?: string };
      };
      if (json.content?.[0]?.text) return `📋 <b>Weekly report</b>\n\n${json.content[0].text}`;
      console.error("[coach] anthropic error", json.error?.message ?? "unknown");
    } catch (err) {
      console.error("[coach] anthropic call failed", err);
    }
  }

  // Rule-based fallback — mirrors the app's existing coach voice.
  const lines = [
    `📋 <b>Weekly report</b>`,
    ``,
    `Week completion: <b>${summary.total}%</b>`,
    `Strongest: ${summary.bestCategory} · Weakest: ${summary.weakestCategory}`,
  ];
  if (summary.skipped.length) {
    lines.push(``, `Consistently skipped: ${summary.skipped.join(", ")}`);
  }
  lines.push(
    ``,
    summary.total >= 80
      ? "One adjustment: protect the weakest category — it's the only thing between you and a balanced 90%."
      : summary.total >= 50
        ? "One adjustment: move your lowest-completion block earlier in the day, before decision fatigue takes it."
        : "One adjustment: cut the plan in half for one week. A small honest win beats a big dishonest one.",
  );
  return lines.join("\n");
}

/** Catch-up proposal: redistribute missed must-do blocks across the next days. */
export function proposeCatchUp(state: OrdoState): string {
  const missed: { title: string; date: string }[] = [];
  const today = new Date();
  for (let i = 1; i <= 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = dateKey(d);
    const blocks = state.routine?.[String(d.getDay())] ?? [];
    const entries = state.log?.[key] ?? {};
    for (const b of blocks) {
      if (b.priority !== "nice" && (entries[b.id] ?? 0) < 50) missed.push({ title: b.title, date: key });
    }
  }
  if (!missed.length) return "Clean slate — nothing owed.";

  const slots = ["evening", "early morning", "lunch break"];
  return (
    `🧮 <b>Catch-up proposal</b> — ${missed.length} missed must-do${missed.length > 1 ? "s" : ""}.\n\n` +
    missed
      .slice(0, 4)
      .map((m, i) => `• ${m.title} (was ${m.date.slice(5)}) → fit into ${slots[i % slots.length]} over the next ${Math.ceil(missed.length / 3)} days`)
      .join("\n") +
    `\n\nMust-do mornings stay untouched. Reply /today to see the adjusted plan.`
  );
}

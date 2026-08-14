import { Router } from "express";
import { pool } from "../db/index.js";
import { requireUser } from "./auth.js";

export const exportRouter = Router();

type Block = { id: string; title: string; start: string; end: string; category: string };

type OrdoState = {
  routine?: Record<string, Block[]>;
  overrides?: Record<string, Block[]>;
  log?: Record<string, Record<string, number>>;
  journal?: Record<string, string>;
  goals?: { id: string; title: string; period: string; category: string; target: number }[];
  templates?: { id: string; name: string; blocks: Block[] }[];
};

async function loadState(userId: string): Promise<OrdoState> {
  const { rows } = await pool.query<{ state: OrdoState }>(
    `SELECT state FROM user_state WHERE user_id = $1`,
    [userId],
  );
  return rows[0]?.state ?? {};
}

function toCSV(rows: (string | number)[][]): string {
  return rows
    .map((r) =>
      r
        .map((cell) => {
          const s = String(cell);
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(","),
    )
    .join("\n");
}

exportRouter.get("/json", requireUser, async (req: any, res) => {
  const state = await loadState(req.user.id);
  const payload = {
    exportedAt: new Date().toISOString(),
    user: req.user,
    state,
  };
  res.setHeader("content-type", "application/json");
  res.setHeader("content-disposition", `attachment; filename="ordo-export-${req.user.id.slice(0, 8)}.json"`);
  res.send(JSON.stringify(payload, null, 2));
});

exportRouter.get("/csv", requireUser, async (req: any, res) => {
  const state = await loadState(req.user.id);
  const rows: (string | number)[][] = [["date", "block", "category", "start", "end", "percent"]];
  const log = state.log ?? {};
  const routine = state.routine ?? {};
  const overrides = state.overrides ?? {};

  const blockLookup = new Map<string, { title: string; start: string; end: string; category: string }>();
  for (const list of Object.values(routine)) {
    for (const b of list ?? []) blockLookup.set(b.id, b);
  }
  for (const list of Object.values(overrides)) {
    for (const b of list ?? []) blockLookup.set(b.id, b);
  }

  for (const [date, entries] of Object.entries(log)) {
    for (const [blockId, pct] of Object.entries(entries)) {
      const b = blockLookup.get(blockId);
      rows.push([
        date,
        b?.title ?? blockId,
        b?.category ?? "",
        b?.start ?? "",
        b?.end ?? "",
        pct,
      ]);
    }
  }
  rows.sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  res.setHeader("content-type", "text/csv; charset=utf-8");
  res.setHeader("content-disposition", `attachment; filename="ordo-log-${req.user.id.slice(0, 8)}.csv"`);
  res.send(toCSV(rows));
});

exportRouter.get("/ical", requireUser, async (req: any, res) => {
  const state = await loadState(req.user.id);
  const now = new Date();
  const routine = state.routine ?? {};
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Ordo//EN",
    "CALSCALE:GREGORIAN",
  ];

  const weekdayNames = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
  for (let d = 0; d < 60; d++) {
    const date = new Date(now);
    date.setDate(date.getDate() + d);
    const dow = date.getDay();
    const blocks = routine[String(dow)] ?? [];
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
    for (const b of blocks) {
      const start = `${dateStr}T${b.start.replace(":", "")}00`;
      const end = `${dateStr}T${b.end.replace(":", "")}00`;
      const summary = b.title.replace(/[\\;,]/g, (m) => `\\${m}`);
      lines.push(
        "BEGIN:VEVENT",
        `UID:${b.id}@ordo`,
        `DTSTART:${start}`,
        `DTEND:${end}`,
        `SUMMARY:${summary}`,
        `CATEGORIES:${b.category}`,
        `RRULE:FREQ=WEEKLY;BYDAY=${weekdayNames[dow]}`,
        "END:VEVENT",
      );
    }
  }
  lines.push("END:VCALENDAR");

  res.setHeader("content-type", "text/calendar; charset=utf-8");
  res.setHeader("content-disposition", `attachment; filename="ordo-routine.ics"`);
  res.send(lines.join("\r\n"));
});

/**
 * Exports, generated in the browser. The document already lives in memory here,
 * so there is nothing for a server to add — and no download endpoint to secure.
 */
import type { Block, OrdoState } from "./ordo";

function csvEscape(cell: string | number): string {
  const s = String(cell);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const toCSV = (rows: (string | number)[][]) =>
  rows.map((r) => r.map(csvEscape).join(",")).join("\n");

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;

/** Every block the log could reference, keyed by id. */
function blockLookup(state: OrdoState): Map<string, Block> {
  const map = new Map<string, Block>();
  for (const list of Object.values(state.routine ?? {})) {
    for (const b of list ?? []) map.set(b.id, b);
  }
  for (const list of Object.values(state.overrides ?? {})) {
    for (const b of list ?? []) map.set(b.id, b);
  }
  return map;
}

export function buildJson(state: OrdoState, user: { id: string; email: string } | null): string {
  return JSON.stringify({ exportedAt: new Date().toISOString(), user, state }, null, 2);
}

export function buildCsv(state: OrdoState): string {
  const rows: (string | number)[][] = [["date", "block", "category", "start", "end", "percent"]];
  const lookup = blockLookup(state);
  for (const [date, entries] of Object.entries(state.log ?? {})) {
    for (const [blockId, pct] of Object.entries(entries ?? {})) {
      const b = lookup.get(blockId);
      rows.push([date, b?.title ?? blockId, b?.category ?? "", b?.start ?? "", b?.end ?? "", pct]);
    }
  }
  const [header, ...body] = rows;
  body.sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  return toCSV([header!, ...body]);
}

const ICS_DAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"] as const;

/**
 * One recurring VEVENT per routine block. The Express version emitted the same
 * UID 60 times *and* a weekly RRULE, so importing it produced duplicates; here
 * each block is anchored to the next occurrence of its weekday and repeats.
 */
export function buildIcal(state: OrdoState): string {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Ordo//EN", "CALSCALE:GREGORIAN"];
  const today = new Date();
  const escape = (s: string) => s.replace(/([\\;,])/g, "\\$1").replace(/\n/g, "\\n");

  for (let offset = 0; offset < 7; offset++) {
    const date = new Date(today);
    date.setDate(date.getDate() + offset);
    const dow = date.getDay();
    const blocks = state.routine?.[dow] ?? [];
    const dateStr = ymd(date);

    for (const b of blocks) {
      lines.push(
        "BEGIN:VEVENT",
        `UID:${b.id}@ordo`,
        `DTSTART:${dateStr}T${b.start.replace(":", "")}00`,
        `DTEND:${dateStr}T${b.end.replace(":", "")}00`,
        `SUMMARY:${escape(b.title)}`,
        `CATEGORIES:${b.category}`,
        `RRULE:FREQ=WEEKLY;BYDAY=${ICS_DAYS[dow]}`,
        "END:VEVENT",
      );
    }
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export type ExportKind = "json" | "csv" | "ical";

const MIME: Record<ExportKind, string> = {
  json: "application/json",
  csv: "text/csv;charset=utf-8",
  ical: "text/calendar;charset=utf-8",
};

const FILENAME: Record<ExportKind, string> = {
  json: "ordo-export.json",
  csv: "ordo-log.csv",
  ical: "ordo-routine.ics",
};

export function downloadExport(
  kind: ExportKind,
  state: OrdoState,
  user: { id: string; email: string } | null,
): void {
  const body =
    kind === "json" ? buildJson(state, user) : kind === "csv" ? buildCsv(state) : buildIcal(state);

  const url = URL.createObjectURL(new Blob([body], { type: MIME[kind] }));
  const a = document.createElement("a");
  a.href = url;
  a.download = FILENAME[kind];
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

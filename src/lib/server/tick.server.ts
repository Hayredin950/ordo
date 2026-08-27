/**
 * The scheduler, as one idempotent pass. Render ran node-cron in a long-lived
 * process; Vercel has no such process, so three pingers (GitHub Actions every
 * 5 minutes, Vercel's daily cron, and any external cron service) all call
 * /api/cron/tick and this function decides what is actually due.
 *
 * Every outbound message is claimed in `notification_log` first. The claim is a
 * primary-key insert, so concurrent ticks cannot double-send: exactly one wins.
 */
import { serviceClient } from "./supabase.server";
import { notifyUser, type Keyboard } from "./notify.server";
import { generateWeeklyReport } from "./coach.server";
import { buildCheckIn } from "./telegram.server";
import { blocksForDay, dateKey, logForDay, type ServerState } from "./state.server";

/** Vercel runs in UTC; set this when "07:00" should mean 07:00 somewhere else. */
const OFFSET_MINUTES = Number(process.env["ORDO_TZ_OFFSET_MINUTES"] ?? 0) || 0;

/** "Now", shifted into the schedule's timezone. */
const localNow = (): Date => new Date(Date.now() + OFFSET_MINUTES * 60_000);

type Target = { user_id: string; chat_id: string | null; slack_channel: string | null };

export type TickResult = {
  ok: true;
  users: number;
  sent: number;
  kinds: Record<string, number>;
  skipped?: string;
};

/** Everyone with at least one channel linked, Telegram-only or Slack-only. */
async function linkedUsers(): Promise<Target[]> {
  const db = serviceClient();
  const [telegram, slack] = await Promise.all([
    db.from("telegram_links").select("user_id, chat_id"),
    db.from("slack_links").select("user_id, channel"),
  ]);
  if (telegram.error) throw new Error(telegram.error.message);
  if (slack.error) throw new Error(slack.error.message);

  const byUser = new Map<string, Target>();
  const get = (userId: string): Target => {
    const existing = byUser.get(userId);
    if (existing) return existing;
    const fresh: Target = { user_id: userId, chat_id: null, slack_channel: null };
    byUser.set(userId, fresh);
    return fresh;
  };
  for (const row of telegram.data ?? []) get(row.user_id as string).chat_id = String(row.chat_id);
  for (const row of slack.data ?? [])
    get(row.user_id as string).slack_channel = row.channel as string;
  return [...byUser.values()];
}

async function loadStates(userIds: string[]): Promise<Map<string, ServerState>> {
  const states = new Map<string, ServerState>();
  if (!userIds.length) return states;
  const { data, error } = await serviceClient()
    .from("user_state")
    .select("user_id, state")
    .in("user_id", userIds);
  if (error) throw new Error(error.message);
  for (const row of data ?? []) states.set(row.user_id as string, (row.state ?? {}) as ServerState);
  return states;
}

/**
 * Claim one notification. Returns false when another tick already sent it —
 * a unique-violation on the primary key is the whole locking mechanism.
 */
async function claim(userId: string, kind: string, day: Date, ref = ""): Promise<boolean> {
  const { error } = await serviceClient()
    .from("notification_log")
    .insert({ user_id: userId, kind, day: dateKey(day), ref });
  if (!error) return true;
  if (error.code === "23505") return false;
  console.error("[cron] claim failed", kind, error.message);
  return false;
}

/** Minutes from now until "HH:MM" today, negative once it has passed. */
function minutesUntil(start: string, now: Date): number {
  const [h, m] = start.split(":").map(Number);
  const target = new Date(now);
  target.setHours(h ?? 0, m ?? 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / 60_000);
}

export async function runTick(): Promise<TickResult> {
  const now = localNow();
  const today = new Date(now);
  const kinds: Record<string, number> = {};
  let sent = 0;

  const send = async (
    target: Target,
    kind: string,
    text: string,
    ref = "",
    keyboard?: Keyboard,
  ): Promise<void> => {
    if (!(await claim(target.user_id, kind, today, ref))) return;
    const ok = await notifyUser(target, text, keyboard);
    if (ok) {
      sent += 1;
      kinds[kind] = (kinds[kind] ?? 0) + 1;
    } else {
      // Nothing went out — release the claim so the next tick can retry.
      await serviceClient()
        .from("notification_log")
        .delete()
        .match({ user_id: target.user_id, kind, day: dateKey(today), ref });
    }
  };

  const targets = await linkedUsers();
  const states = await loadStates(targets.map((t) => t.user_id));

  for (const target of targets) {
    try {
      const state = states.get(target.user_id) ?? {};
      const blocks = blocksForDay(state, today);
      const entries = logForDay(state, today);

      // Morning brief — from 07:00 until noon, once per day.
      if (blocks.length && now.getHours() >= 7 && now.getHours() < 12) {
        const must = blocks.filter((b) => b.priority !== "nice");
        const headline = must.length
          ? `Today's must-dos: ${must.map((b) => b.title).join(", ")}`
          : "No must-do blocks today — coast is earned.";
        await send(
          target,
          "morning",
          `🌅 Good morning. ${headline}\n\nFull plan:\n${blocks
            .map((b) => `• ${b.start}–${b.end} ${b.title}`)
            .join("\n")}`,
        );
      }

      // Pre-block reminders and nags, one claim per block per day.
      for (const b of blocks) {
        const mins = minutesUntil(b.start, now);
        if (b.priority !== "nice" && mins >= 0 && mins <= 15) {
          await send(
            target,
            "pre",
            `⏰ Starting soon: <b>${b.title}</b> (${b.start}–${b.end})`,
            b.id,
          );
        }
        if (b.priority === "must" && mins <= -5 && mins > -90 && (entries[b.id] ?? 0) === 0) {
          await send(
            target,
            "nag",
            `🔔 <b>${b.title}</b> (${b.start}) passed unlogged. Log it or it becomes debt.`,
            b.id,
          );
        }
      }

      // Evening check-in — from 21:00, with the logging keyboard.
      if (now.getHours() >= 21) {
        const checkIn = buildCheckIn(state, today);
        if (checkIn) await send(target, "evening", checkIn.text, "", checkIn.keyboard);
      }

      // Weekly report — Sunday evening, once.
      if (today.getDay() === 0 && now.getHours() >= 20) {
        await send(target, "weekly", await generateWeeklyReport(state));
      }
    } catch (err) {
      console.error("[cron] user pass failed", target.user_id, err);
    }
  }

  // Future-self letters. `delivered` is the idempotency flag here.
  try {
    const db = serviceClient();
    const { data: due, error } = await db
      .from("future_letters")
      .select("id, user_id, goal_title, body")
      .eq("delivered", false)
      .lte("deadline", dateKey(today));
    if (error) throw new Error(error.message);

    for (const letter of due ?? []) {
      const target = targets.find((t) => t.user_id === letter.user_id);
      if (!target) continue; // No channel linked yet — it waits, undelivered.
      const text = `💌 <b>Your future-self letter has arrived.</b>\n\n“${letter.body}”\n\n— sealed for “${letter.goal_title}”`;
      if (await notifyUser(target, text)) {
        await db.from("future_letters").update({ delivered: true }).eq("id", letter.id);
        sent += 1;
        kinds["letter"] = (kinds["letter"] ?? 0) + 1;
      }
    }
  } catch (err) {
    console.error("[cron] letter delivery failed", err);
  }

  return { ok: true, users: targets.length, sent, kinds };
}

/**
 * Every read and write the app performs against Postgres. Owner-only tables are
 * queried directly and guarded by row level security; anything that has to
 * touch another user's data (peer scores, leaderboards, template copy counters,
 * pairing by email) goes through a SECURITY DEFINER function that returns
 * aggregates only. See supabase/migrations/0001_init.sql.
 */
import { dbError, sb } from "./supabase";
import type { Block, OrdoState } from "./ordo";

export type Peer = { id: string; name: string; email: string; weekly: number | null };

export type Challenge = {
  id: string;
  name: string;
  starts_on: string;
  ends_on: string;
  owner_id: string;
  members: number;
  joined: boolean;
};

export type BoardRow = { user_id: string; name: string; score: number };

export type FutureLetter = {
  id: string;
  goal_title: string;
  body: string;
  deadline: string;
  delivered: boolean;
  created_at: string;
};

export type PublicTemplate = {
  id: string;
  author_name: string;
  name: string;
  blocks: Block[];
  copies: number;
  created_at: string;
};

export type Onboarding = {
  user_id: string;
  goal_set: boolean;
  routine_set: boolean;
  telegram_linked: boolean;
  completed_at: string | null;
};

// ---- The document ----------------------------------------------------------

export async function loadState(): Promise<OrdoState | null> {
  const { data, error } = await sb().from("user_state").select("state").maybeSingle();
  if (error) throw dbError(error, "Could not load your data");
  const state = (data as { state?: OrdoState } | null)?.state;
  return state && Object.keys(state).length ? state : null;
}

export async function saveState(state: OrdoState): Promise<void> {
  const { error } = await sb().rpc("save_state", { p_state: state });
  if (error) throw dbError(error, "Could not save your data");
}

export async function undoState(): Promise<OrdoState> {
  const { data, error } = await sb().rpc("undo_state");
  if (error) throw dbError(error, "Nothing to undo");
  return data as OrdoState;
}

export async function loadHistory(): Promise<OrdoState[]> {
  const { data, error } = await sb().from("user_state").select("history").maybeSingle();
  if (error) throw dbError(error, "Could not load history");
  return ((data as { history?: OrdoState[] } | null)?.history ?? []) as OrdoState[];
}

// ---- Accountability pairing -----------------------------------------------

export async function listPeers(): Promise<Peer[]> {
  const { data, error } = await sb().rpc("peer_progress");
  if (error) throw dbError(error, "Could not load your partners");
  return (data ?? []) as Peer[];
}

export async function pairWithEmail(email: string): Promise<void> {
  const { error } = await sb().rpc("pair_with_email", { p_email: email });
  if (error) throw dbError(error, "Could not add that partner");
}

export async function unpair(peerId: string): Promise<void> {
  const { error } = await sb().rpc("unpair", { p_peer: peerId });
  if (error) throw dbError(error, "Could not remove that partner");
}

// ---- Challenges ------------------------------------------------------------

export async function listChallenges(): Promise<Challenge[]> {
  const { data, error } = await sb().rpc("list_challenges");
  if (error) throw dbError(error, "Could not load challenges");
  return (data ?? []) as Challenge[];
}

export async function createChallenge(name: string, days: number): Promise<void> {
  const { error } = await sb().rpc("create_challenge", { p_name: name, p_days: days });
  if (error) throw dbError(error, "Could not create the challenge");
}

export async function joinChallenge(id: string): Promise<void> {
  const { error } = await sb().rpc("join_challenge", { p_challenge: id });
  if (error) throw dbError(error, "Could not join the challenge");
}

export async function challengeLeaderboard(
  id: string,
  meId: string | null,
): Promise<{ leaderboard: BoardRow[]; myRank: number | null }> {
  const { data, error } = await sb().rpc("challenge_leaderboard", { p_challenge: id });
  if (error) throw dbError(error, "Could not load the leaderboard");
  const leaderboard = (data ?? []) as BoardRow[];
  const rank = meId ? leaderboard.findIndex((r) => r.user_id === meId) + 1 : 0;
  return { leaderboard, myRank: rank || null };
}

// ---- Future-self letters ----------------------------------------------------

export async function listLetters(): Promise<FutureLetter[]> {
  const { data, error } = await sb()
    .from("future_letters")
    .select("id, goal_title, body, deadline, delivered, created_at")
    .order("deadline", { ascending: true });
  if (error) throw dbError(error, "Could not load your letters");
  return (data ?? []) as FutureLetter[];
}

export async function createLetter(input: {
  goal_title: string;
  body: string;
  deadline: string;
  userId: string;
}): Promise<FutureLetter> {
  const { data, error } = await sb()
    .from("future_letters")
    .insert({
      user_id: input.userId,
      goal_title: input.goal_title,
      body: input.body,
      deadline: input.deadline,
    })
    .select("id, goal_title, body, deadline, delivered, created_at")
    .single();
  if (error) throw dbError(error, "Could not seal the letter");
  return data as FutureLetter;
}

export async function deleteLetter(id: string): Promise<void> {
  const { error } = await sb().from("future_letters").delete().eq("id", id);
  if (error) throw dbError(error, "Could not delete the letter");
}

// ---- Shared template library ------------------------------------------------

export async function listPublicTemplates(): Promise<PublicTemplate[]> {
  const { data, error } = await sb()
    .from("public_templates")
    .select("id, author_name, name, blocks, copies, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw dbError(error, "Could not load the template library");
  return (data ?? []) as PublicTemplate[];
}

export async function publishTemplate(name: string, blocks: Block[]): Promise<void> {
  const { error } = await sb().rpc("publish_template", { p_name: name, p_blocks: blocks });
  if (error) throw dbError(error, "Could not publish the template");
}

export async function copyPublicTemplate(id: string): Promise<{ name: string; blocks: Block[] }> {
  const { data, error } = await sb().rpc("copy_public_template", { p_id: id });
  if (error) throw dbError(error, "Could not copy the template");
  const row = (Array.isArray(data) ? data[0] : data) as { name: string; blocks: Block[] } | null;
  if (!row) throw new Error("Template not found");
  return row;
}

// ---- Onboarding -------------------------------------------------------------

export async function getOnboarding(): Promise<Onboarding | null> {
  const { data, error } = await sb().from("onboarding").select("*").maybeSingle();
  if (error) throw dbError(error, "Could not load onboarding");
  return (data ?? null) as Onboarding | null;
}

export async function setOnboarding(flags: {
  goal_set?: boolean;
  routine_set?: boolean;
  telegram_linked?: boolean;
}): Promise<Onboarding> {
  const { data, error } = await sb().rpc("set_onboarding", {
    p_goal_set: flags.goal_set ?? null,
    p_routine_set: flags.routine_set ?? null,
    p_telegram_linked: flags.telegram_linked ?? null,
  });
  if (error) throw dbError(error, "Could not save onboarding");
  return (Array.isArray(data) ? data[0] : data) as Onboarding;
}

// ---- Notification channels --------------------------------------------------

export async function telegramLink(): Promise<{ chatId: string; username: string } | null> {
  const { data, error } = await sb()
    .from("telegram_links")
    .select("chat_id, username")
    .maybeSingle();
  if (error) throw dbError(error, "Could not read your Telegram link");
  const row = data as { chat_id: number | string; username: string } | null;
  return row ? { chatId: String(row.chat_id), username: row.username } : null;
}

export async function createTelegramCode(): Promise<string> {
  const { data, error } = await sb().rpc("create_telegram_code");
  if (error) throw dbError(error, "Could not create a link code");
  return String(data);
}

export async function unlinkTelegram(userId: string): Promise<void> {
  const { error } = await sb().from("telegram_links").delete().eq("user_id", userId);
  if (error) throw dbError(error, "Could not unlink Telegram");
}

export async function slackLink(): Promise<{ channel: string } | null> {
  const { data, error } = await sb().from("slack_links").select("channel").maybeSingle();
  if (error) throw dbError(error, "Could not read your Slack channel");
  return (data ?? null) as { channel: string } | null;
}

export async function linkSlack(userId: string, channel: string): Promise<string> {
  const normalized = channel.trim().startsWith("#") ? channel.trim() : `#${channel.trim()}`;
  const { data, error } = await sb()
    .from("slack_links")
    .upsert({ user_id: userId, channel: normalized }, { onConflict: "user_id" })
    .select("channel")
    .single();
  if (error) throw dbError(error, "Could not save the Slack channel");
  return (data as { channel: string }).channel;
}

export async function unlinkSlack(userId: string): Promise<void> {
  const { error } = await sb().from("slack_links").delete().eq("user_id", userId);
  if (error) throw dbError(error, "Could not unlink Slack");
}

// ---- Account ----------------------------------------------------------------

export async function deleteAccount(): Promise<void> {
  const { error } = await sb().rpc("delete_account");
  if (error) throw dbError(error, "Could not delete the account");
}

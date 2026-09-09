/**
 * Every read and write the app performs against Postgres. Owner-only tables are
 * queried directly and guarded by row level security; anything that has to
 * touch another user's data (peer scores, leaderboards, template copy counters,
 * pairing by email) goes through a SECURITY DEFINER function that returns
 * aggregates only. See supabase/migrations/0001_init.sql.
 */
import { dbError, sb } from "./supabase";
import type { Block, ChallengeRoutine, OrdoState } from "./ordo";
import type { CategoryRow } from "./categories";

export type { Block, OrdoState, ChallengeRoutine } from "./ordo";

export type Peer = {
  id: string;
  name: string;
  email: string;
  weekly: number | null;
  paired_at: string;
};

/** A pending invite, in either direction. `peer_id` is null until they sign up. */
export type PairingRequest = {
  id: string;
  direction: "incoming" | "outgoing";
  peer_id: string | null;
  peer_name: string | null;
  peer_email: string;
  created_at: string;
  expires_at: string;
};

export type ChallengeStatus = "upcoming" | "active" | "completed" | "cancelled";

/**
 * What every challenge read returns. `status` is derived from the dates on each
 * read rather than stored: 0005 wrote 'upcoming' at creation and had nothing to
 * promote it, while join_challenge demanded 'active', so nothing was joinable.
 * `invite_code` is null unless you are the owner or already a member — the code
 * is a capability, not a description.
 */
export type ChallengeBase = {
  id: string;
  owner_id: string;
  name: string;
  category: string;
  description: string;
  start_at: string;
  end_at: string;
  status: ChallengeStatus;
  visibility: "public" | "private";
  min_daily_minutes: number;
  max_participants: number | null;
  members: number;
  joined: boolean;
  is_owner: boolean;
  invite_code: string | null;
};

/** `list_challenges` adds progress; `get_challenge` returns the base only. */
export type Challenge = ChallengeBase & {
  /** 1-based day of the run, clamped to [0, total_days]. */
  day_index: number;
  total_days: number;
  /** Null until you have joined and the window has opened. */
  my_score: number | null;
};

/**
 * `rank` is the server's — ties share it, so it is not the array index. 0005
 * declared it `integer` while returning `rank()`'s bigint, which made the whole
 * call raise 42804; the client compensated by recomputing rank from position and
 * silently disagreed with the database whenever two people tied.
 */
export type BoardRow = {
  user_id: string;
  name: string;
  score: number;
  rank: number;
  is_me: boolean;
  has_left: boolean;
  is_final: boolean;
  total_members: number;
};

/**
 * Why a score is what it is — the caller's own components only. The three
 * percentages are null while the window has no days in it yet (a challenge that
 * starts tomorrow), because a 0 there would read as "you failed" rather than
 * "nothing has happened".
 */
export type ChallengeBreakdown = {
  window_days: number;
  active_days: number;
  completion: number | null;
  consistency: number | null;
  participation: number | null;
  score: number | null;
  is_final: boolean;
  final_rank: number | null;
};

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

export async function redoState(): Promise<OrdoState> {
  const { data, error } = await sb().rpc("redo_state");
  if (error) throw dbError(error, "Nothing to redo");
  return data as OrdoState;
}

export async function loadHistory(): Promise<OrdoState[]> {
  const { data, error } = await sb().from("user_state").select("history").maybeSingle();
  if (error) throw dbError(error, "Could not load history");
  return ((data as { history?: OrdoState[] } | null)?.history ?? []) as OrdoState[];
}

// ---- Accountability pairing -----------------------------------------------

export async function listPeers(): Promise<Peer[]> {
  const { data, error } = await sb().rpc("get_accountability_partners");
  if (error) throw dbError(error, "Could not load your partners");
  return (data ?? []) as Peer[];
}

export async function pairWithEmail(email: string): Promise<string> {
  const { data, error } = await sb().rpc("pair_with_email", { p_email: email });
  if (error) throw dbError(error, "Could not add that partner");
  return data as string;
}

/**
 * Both directions in one call. The inbox used to be a direct read of
 * `pairing_requests`, which had no RLS in 0005 and selected a `requester_email`
 * column that does not exist — so the pending list rendered blank rows.
 */
export async function listPairingRequests(): Promise<PairingRequest[]> {
  const { data, error } = await sb().rpc("list_pairing_requests");
  if (error) throw dbError(error, "Could not load pairing requests");
  return (data ?? []) as PairingRequest[];
}

export async function respondToPairingRequest(
  requestId: string,
  response: "accept" | "decline",
): Promise<void> {
  const { error } = await sb().rpc("respond_to_pairing_request", {
    p_request_id: requestId,
    p_response: response,
  });
  if (error) throw dbError(error, "Could not respond to request");
}

export async function cancelPairingRequest(requestId: string): Promise<void> {
  const { error } = await sb().rpc("cancel_pairing_request", { p_request_id: requestId });
  if (error) throw dbError(error, "Could not withdraw that request");
}

export async function unpairUser(peerId: string): Promise<void> {
  const { error } = await sb().rpc("unpair_user", { p_peer: peerId });
  if (error) throw dbError(error, "Could not remove that partner");
}

// ---- Challenges ------------------------------------------------------------

export async function listChallenges(): Promise<Challenge[]> {
  const { data, error } = await sb().rpc("list_challenges");
  if (error) throw dbError(error, "Could not load challenges");
  return (data ?? []) as Challenge[];
}

export async function getChallenge(id: string): Promise<ChallengeBase | null> {
  const { data, error } = await sb().rpc("get_challenge", { p_challenge: id });
  if (error) throw dbError(error, "Could not load the challenge");
  const rows = (data ?? []) as ChallengeBase[];
  return rows[0] ?? null;
}

export async function createChallenge(input: {
  name: string;
  category?: string;
  description?: string;
  startAt?: Date;
  endAt?: Date;
  visibility?: "public" | "private";
  maxParticipants?: number | null;
  minDailyMinutes?: number;
}): Promise<void> {
  const { error } = await sb().rpc("create_challenge", {
    p_name: input.name,
    p_category: input.category ?? "general",
    p_description: input.description ?? "",
    // Null means "decide server-side": the dates are validated against each
    // other there, and the 30-day default lives in one place.
    p_start_at: input.startAt?.toISOString() ?? null,
    p_end_at: input.endAt?.toISOString() ?? null,
    p_visibility: input.visibility ?? "public",
    p_max_participants: input.maxParticipants ?? null,
    p_min_daily_minutes: input.minDailyMinutes ?? 30,
  });
  if (error) throw dbError(error, "Could not create the challenge");
}

export async function joinChallenge(id: string): Promise<void> {
  const { error } = await sb().rpc("join_challenge", { p_challenge: id });
  if (error) throw dbError(error, "Could not join the challenge");
}

/** Returns the challenge that was joined, so the caller can open it. */
export async function joinChallengeByCode(code: string): Promise<string> {
  const { data, error } = await sb().rpc("join_challenge_by_code", { p_code: code });
  if (error) throw dbError(error, "Could not join with that code");
  return data as string;
}

export async function leaveChallenge(id: string): Promise<void> {
  const { error } = await sb().rpc("leave_challenge", { p_challenge: id });
  if (error) throw dbError(error, "Could not leave the challenge");
}

export async function cancelChallenge(id: string): Promise<void> {
  const { error } = await sb().rpc("cancel_challenge", { p_challenge: id });
  if (error) throw dbError(error, "Could not cancel the challenge");
}

export async function challengeLeaderboard(
  id: string,
): Promise<{ leaderboard: BoardRow[]; myRank: number | null; totalMembers: number }> {
  const { data, error } = await sb().rpc("get_challenge_leaderboard", { p_challenge: id });
  if (error) throw dbError(error, "Could not load the leaderboard");
  const leaderboard = (data ?? []) as BoardRow[];
  const me = leaderboard.find((r) => r.is_me);
  return {
    leaderboard,
    myRank: me?.rank ?? null,
    totalMembers: leaderboard[0]?.total_members ?? leaderboard.length,
  };
}

export async function challengeBreakdown(id: string): Promise<ChallengeBreakdown | null> {
  const { data, error } = await sb().rpc("get_challenge_breakdown", { p_challenge: id });
  if (error) throw dbError(error, "Could not load your score breakdown");
  const rows = (data ?? []) as ChallengeBreakdown[];
  return rows[0] ?? null;
}

// ---- Challenge Routines ---------------------------------------------------

export async function getChallengeRoutine(challengeId: string): Promise<ChallengeRoutine | null> {
  const { data, error } = await sb().rpc("get_challenge_routine", { p_challenge: challengeId });
  if (error) throw dbError(error, "Could not load challenge routine");
  const row = (data ?? []) as ChallengeRoutine[];
  return row[0] ?? null;
}

export async function updateChallengeRoutine(challengeId: string, routine: Record<number, Block[]>): Promise<void> {
  const { error } = await sb().rpc("update_challenge_routine", {
    p_challenge: challengeId,
    p_routine: routine,
  });
  if (error) throw dbError(error, "Could not update challenge routine");
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

// ---- Categories (read: everyone, write: admin by policy) ---------------------

const CATEGORY_COLS = "id, label, color, icon, sort";

export async function listCategories(): Promise<CategoryRow[]> {
  const { data, error } = await sb()
    .from("app_categories")
    .select(CATEGORY_COLS)
    .order("sort", { ascending: true });
  if (error) throw dbError(error, "Could not load categories");
  return (data ?? []) as CategoryRow[];
}

/**
 * Insert-or-replace by id. The admin-write policy on `app_categories` is what
 * actually stops a non-admin here; the UI hiding the form is only politeness.
 */
export async function upsertCategory(row: CategoryRow): Promise<CategoryRow> {
  const { data, error } = await sb()
    .from("app_categories")
    .upsert(row, { onConflict: "id" })
    .select(CATEGORY_COLS)
    .single();
  if (error) throw dbError(error, "Could not save the category");
  return data as CategoryRow;
}

/** Deleting a row that overrode a built-in restores the code-defined default. */
export async function deleteCategory(id: string): Promise<void> {
  const { error } = await sb().from("app_categories").delete().eq("id", id);
  if (error) throw dbError(error, "Could not delete the category");
}

// ---- Announcements ----------------------------------------------------------

export type AnnouncementLevel = "info" | "warning" | "success";

export type Announcement = {
  id: string;
  title: string;
  body: string;
  level: AnnouncementLevel;
  active: boolean;
  created_at: string;
};

const ANNOUNCEMENT_COLS = "id, title, body, level, active, created_at";

/** Everyone gets the active ones; an admin also sees the retired ones. */
export async function listAnnouncements(): Promise<Announcement[]> {
  const { data, error } = await sb()
    .from("announcements")
    .select(ANNOUNCEMENT_COLS)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw dbError(error, "Could not load announcements");
  return (data ?? []) as Announcement[];
}

export async function createAnnouncement(input: {
  title: string;
  body: string;
  level: AnnouncementLevel;
  userId: string;
}): Promise<Announcement> {
  const { data, error } = await sb()
    .from("announcements")
    .insert({
      title: input.title,
      body: input.body,
      level: input.level,
      created_by: input.userId,
    })
    .select(ANNOUNCEMENT_COLS)
    .single();
  if (error) throw dbError(error, "Could not post the announcement");
  return data as Announcement;
}

export async function setAnnouncementActive(id: string, active: boolean): Promise<void> {
  const { error } = await sb().from("announcements").update({ active }).eq("id", id);
  if (error) throw dbError(error, "Could not update the announcement");
}

export async function deleteAnnouncement(id: string): Promise<void> {
  const { error } = await sb().from("announcements").delete().eq("id", id);
  if (error) throw dbError(error, "Could not delete the announcement");
}

// ---- Admin ------------------------------------------------------------------
// Every function below calls a SECURITY DEFINER routine that raises "Admins
// only" for anyone else, so these throw rather than return empty for a
// non-admin. Nothing here trusts the client.

export type AdminSeriesPoint = { day: string; signups: number; active: number };

export type AdminOverview = {
  users: number;
  admins: number;
  new_7d: number;
  documents: number;
  active_24h: number;
  active_7d: number;
  categories: number;
  challenges: number;
  challenge_members: number;
  pairings: number;
  templates: number;
  letters_pending: number;
  telegram_linked: number;
  slack_linked: number;
  announcements: number;
  notifications_7d: number;
  avg_weekly: number;
  series: AdminSeriesPoint[];
};

export async function adminOverview(): Promise<AdminOverview> {
  const { data, error } = await sb().rpc("admin_overview");
  if (error) throw dbError(error, "Could not load the admin overview");
  return data as AdminOverview;
}

export type AdminUser = {
  id: string;
  email: string;
  name: string;
  provider: string;
  role: "user" | "admin";
  created_at: string;
  last_active: string | null;
  weekly: number | null;
  telegram: boolean;
  slack: boolean;
  blocks: number;
};

export async function adminListUsers(search = "", limit = 50): Promise<AdminUser[]> {
  const { data, error } = await sb().rpc("admin_list_users", {
    p_search: search,
    p_limit: limit,
  });
  if (error) throw dbError(error, "Could not load the user list");
  return (data ?? []) as AdminUser[];
}

/** Refused server-side for self-demotion and for the founder address. */
export async function adminSetRole(userId: string, role: "user" | "admin"): Promise<void> {
  const { error } = await sb().rpc("admin_set_role", { p_user: userId, p_role: role });
  if (error) throw dbError(error, "Could not change that role");
}

/** Library moderation: admins have a DELETE policy on `public_templates`. */
export async function adminDeleteTemplate(id: string): Promise<void> {
  const { error } = await sb().from("public_templates").delete().eq("id", id);
  if (error) throw dbError(error, "Could not remove that template");
}

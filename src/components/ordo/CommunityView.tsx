import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import * as db from "@/lib/db";
import type {
  BoardRow,
  Block,
  Challenge,
  ChallengeBreakdown,
  ChallengeRoutine,
  ChallengeStatus,
  PairingRequest,
  Peer,
} from "@/lib/db";
import { useCategories } from "@/lib/categories";
import { Panel, PanelTitle } from "./primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  UserPlus,
  Users,
  Trophy,
  Trash2,
  ChevronDown,
  ChevronUp,
  Loader2,
  Flag,
  Check,
  X,
  MailWarning,
  Send,
  Copy,
  KeyRound,
  Lock,
  Ban,
  Edit3,
  Save,
} from "lucide-react";
import { toast } from "sonner";

const DAY_MS = 24 * 60 * 60 * 1000;

const SELECT_CLASS =
  "h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-sm sm:h-9";

/** Status is derived server-side from the dates, so these are the only four. */
const STATUS_STYLE: Record<ChallengeStatus, string> = {
  active: "bg-primary/10 text-primary",
  upcoming: "bg-muted text-muted-foreground",
  completed: "bg-muted text-muted-foreground",
  cancelled: "bg-destructive/10 text-destructive",
};

const fmtDay = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });

const errMsg = (err: unknown, fallback: string) => (err instanceof Error ? err.message : fallback);

export function CommunityView() {
  const { user } = useAuth();
  const { categories } = useCategories();

  // ---- Accountability pairing ----
  const [peers, setPeers] = useState<Peer[] | null>(null);
  const [pairEmail, setPairEmail] = useState("");
  const [pairBusy, setPairBusy] = useState(false);
  const [requests, setRequests] = useState<PairingRequest[]>([]);
  const [reqBusy, setReqBusy] = useState<string | null>(null);

  const loadPeers = useCallback(async () => {
    if (!user) return;
    try {
      setPeers(await db.listPeers());
    } catch {
      setPeers([]);
    }
  }, [user]);

  /**
   * Both directions come from one RPC. This used to read `pairing_requests`
   * directly and select a `requester_email` column that has never existed, so
   * every pending invite rendered as a blank row; the table is RLS-locked now.
   */
  const loadRequests = useCallback(async () => {
    if (!user) return;
    try {
      setRequests(await db.listPairingRequests());
    } catch {
      setRequests([]);
    }
  }, [user]);

  const addPair = async () => {
    if (!pairEmail.trim()) return;
    setPairBusy(true);
    try {
      await db.pairWithEmail(pairEmail.trim());
      // Deliberately the same message whether or not that address has an
      // account: anything else turns this box into an account-enumeration probe.
      toast.success("Invite sent — they have to accept before either of you sees anything.");
      setPairEmail("");
      void loadRequests();
    } catch (err) {
      toast.error(errMsg(err, "Could not send that invite"));
    } finally {
      setPairBusy(false);
    }
  };

  const respondRequest = async (id: string, response: "accept" | "decline") => {
    setReqBusy(id);
    try {
      await db.respondToPairingRequest(id, response);
      toast.success(response === "accept" ? "Paired." : "Invite declined.");
      setRequests((rs) => rs.filter((r) => r.id !== id));
      void loadPeers();
    } catch (err) {
      toast.error(errMsg(err, "Could not respond"));
      void loadRequests();
    } finally {
      setReqBusy(null);
    }
  };

  const withdrawRequest = async (id: string) => {
    setReqBusy(id);
    try {
      await db.cancelPairingRequest(id);
      setRequests((rs) => rs.filter((r) => r.id !== id));
      toast.success("Invite withdrawn");
    } catch (err) {
      toast.error(errMsg(err, "Could not withdraw that invite"));
    } finally {
      setReqBusy(null);
    }
  };

  const removePair = async (peerId: string) => {
    try {
      await db.unpairUser(peerId);
      setPeers((ps) => (ps ? ps.filter((p) => p.id !== peerId) : ps));
      toast.success("Pairing removed");
    } catch (err) {
      toast.error(errMsg(err, "Could not remove pairing"));
    }
  };

  // ---- Challenges ----
  const [challenges, setChallenges] = useState<Challenge[] | null>(null);
  const [chName, setChName] = useState("");
  const [chDays, setChDays] = useState(30);
  const [chFloor, setChFloor] = useState(30);
  const [chCategory, setChCategory] = useState("general");
  const [chPrivate, setChPrivate] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [codeBusy, setCodeBusy] = useState(false);

  const [openBoard, setOpenBoard] = useState<string | null>(null);
  const [board, setBoard] = useState<{
    rows: BoardRow[];
    myRank: number | null;
    totalMembers: number;
  } | null>(null);
  const [breakdown, setBreakdown] = useState<ChallengeBreakdown | null>(null);
  const [boardBusy, setBoardBusy] = useState(false);

  // Challenge routine editor
  const [editingRoutine, setEditingRoutine] = useState<string | null>(null);
  const [routineData, setRoutineData] = useState<ChallengeRoutine | null>(null);
  const [routineBusy, setRoutineBusy] = useState(false);

  const loadChallenges = useCallback(async () => {
    if (!user) return;
    try {
      setChallenges(await db.listChallenges());
    } catch {
      setChallenges([]);
    }
  }, [user]);

  useEffect(() => {
    void loadPeers();
    void loadRequests();
    void loadChallenges();
  }, [loadPeers, loadRequests, loadChallenges]);

  const loadBoard = useCallback(async (id: string) => {
    setBoardBusy(true);
    setBoard(null);
    setBreakdown(null);
    try {
      const [rows, mine] = await Promise.all([
        db.challengeLeaderboard(id),
        db.challengeBreakdown(id).catch(() => null),
      ]);
      setBoard({ rows: rows.leaderboard, myRank: rows.myRank, totalMembers: rows.totalMembers });
      setBreakdown(mine);
    } catch {
      setBoard(null);
    } finally {
      setBoardBusy(false);
    }
  }, []);

  const toggleRoutineEditor = useCallback(async (id: string, c: Challenge) => {
    if (editingRoutine === id) {
      setEditingRoutine(null);
      setRoutineData(null);
      return;
    }
    setRoutineBusy(true);
    try {
      const routine = await db.getChallengeRoutine(id);
      setRoutineData(routine);
      setEditingRoutine(id);
    } catch {
      toast.error("Could not load challenge routine");
    } finally {
      setRoutineBusy(false);
    }
  }, [editingRoutine]);

  const saveRoutine = useCallback(async (id: string) => {
    if (!routineData) return;
    setRoutineBusy(true);
    try {
      await db.updateChallengeRoutine(id, routineData.routine);
      toast.success("Challenge routine updated");
      setEditingRoutine(null);
      setRoutineData(null);
      void loadChallenges();
    } catch (err) {
      toast.error(errMsg(err, "Could not save routine"));
    } finally {
      setRoutineBusy(false);
    }
  }, [routineData]);

  const toggleBoard = (id: string) => {
    if (openBoard === id) {
      setOpenBoard(null);
      setBoard(null);
      setBreakdown(null);
      return;
    }
    setOpenBoard(id);
    void loadBoard(id);
  };

  const createChallenge = async () => {
    if (!chName.trim()) return;
    setCreateBusy(true);
    try {
      const startAt = new Date();
      // `new Date() + n` was string concatenation, so this argument used to
      // arrive as "Wed Sep 03 …2592000000" and the call died before the server.
      const endAt = new Date(startAt.getTime() + Math.max(1, chDays) * DAY_MS);
      await db.createChallenge({
        name: chName.trim(),
        category: chCategory,
        startAt,
        endAt,
        visibility: chPrivate ? "private" : "public",
        minDailyMinutes: chFloor,
      });
      toast.success(
        chPrivate
          ? "Created. Share the invite code to let people in."
          : "Created — you are the first member.",
      );
      setChName("");
      void loadChallenges();
    } catch (err) {
      toast.error(errMsg(err, "Could not create the challenge"));
    } finally {
      setCreateBusy(false);
    }
  };

  const joinByCode = async () => {
    if (!joinCode.trim()) return;
    setCodeBusy(true);
    try {
      const id = await db.joinChallengeByCode(joinCode.trim());
      toast.success("Joined.");
      setJoinCode("");
      await loadChallenges();
      setOpenBoard(id);
      void loadBoard(id);
    } catch (err) {
      toast.error(errMsg(err, "Could not join with that code"));
    } finally {
      setCodeBusy(false);
    }
  };

  const joinChallenge = async (id: string) => {
    try {
      await db.joinChallenge(id);
      toast.success("Joined. Rank is by score — nobody sees what your days contain.");
      await loadChallenges();
      setOpenBoard(id);
      void loadBoard(id);
    } catch (err) {
      toast.error(errMsg(err, "Could not join"));
    }
  };

  const leaveChallenge = async (id: string) => {
    try {
      await db.leaveChallenge(id);
      // Leaving is not an erase: the run stays on the leaderboard, marked.
      toast.success("Left the challenge — your score so far stays ranked.");
      await loadChallenges();
      if (openBoard === id) void loadBoard(id);
    } catch (err) {
      toast.error(errMsg(err, "Could not leave"));
    }
  };

  const cancelChallenge = async (id: string) => {
    try {
      await db.cancelChallenge(id);
      toast.success("Cancelled. It will not be scored.");
      await loadChallenges();
    } catch (err) {
      toast.error(errMsg(err, "Could not cancel"));
    }
  };

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success(`Copied ${code}`);
    } catch {
      toast.error("Could not copy — the code is shown beside the button.");
    }
  };

  if (!user) {
    return (
      <Panel>
        <PanelTitle title="Community" hint="Pair with a friend or join a challenge." />
        <p className="text-sm text-muted-foreground">
          Sign in to pair accounts, join challenges and publish your discipline to the leaderboard.
        </p>
      </Panel>
    );
  }

  const incoming = requests.filter((r) => r.direction === "incoming");
  const outgoing = requests.filter((r) => r.direction === "outgoing");

  return (
    <div className="space-y-4 sm:space-y-5">
      <Panel>
        <PanelTitle
          title="Accountability pairing"
          hint="Each of you sees the other's weekly % — never task details."
        />
        {/* Stacked on a phone: an email field squeezed next to a button is too
            narrow to read the address you just typed. */}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={pairEmail}
            type="email"
            placeholder="friend@example.com"
            onChange={(e) => setPairEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void addPair();
            }}
          />
          <Button
            size="sm"
            className="tap w-full sm:w-auto sm:shrink-0"
            disabled={pairBusy}
            onClick={() => void addPair()}
          >
            {pairBusy ? (
              <Loader2 className="mr-1 size-4 animate-spin" />
            ) : (
              <UserPlus className="mr-1 size-4" />
            )}
            Invite
          </Button>
        </div>

        <div className="mt-3 space-y-2">
          {incoming.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-medium text-foreground">Waiting on you</p>
              {incoming.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center gap-2 rounded-lg border border-border p-3 text-sm"
                >
                  <MailWarning className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate">{r.peer_name || r.peer_email}</div>
                    {r.peer_name ? (
                      <div className="truncate text-xs text-muted-foreground">{r.peer_email}</div>
                    ) : null}
                  </div>
                  {reqBusy === r.id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="tap"
                        aria-label={`Accept pairing invite from ${r.peer_email}`}
                        onClick={() => void respondRequest(r.id, "accept")}
                      >
                        <Check className="size-4 text-green-600" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="tap"
                        aria-label={`Decline pairing invite from ${r.peer_email}`}
                        onClick={() => void respondRequest(r.id, "decline")}
                      >
                        <X className="size-4 text-red-600" />
                      </Button>
                    </>
                  )}
                </div>
              ))}
            </div>
          ) : null}

          {outgoing.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-medium text-foreground">Sent</p>
              {outgoing.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center gap-2 rounded-lg border border-dashed border-border p-3 text-sm"
                >
                  <Send className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">
                    {r.peer_email}
                  </span>
                  {reqBusy === r.id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="tap shrink-0"
                      onClick={() => void withdrawRequest(r.id)}
                    >
                      Withdraw
                    </Button>
                  )}
                </div>
              ))}
            </div>
          ) : null}

          {!peers?.length && requests.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No partners yet. Invite someone by email — they choose whether to accept.
            </p>
          ) : null}

          {peers?.length
            ? peers.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-2 rounded-lg border border-border p-3 text-sm sm:gap-3"
                >
                  <Users className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{p.name || p.email}</div>
                    <div className="truncate text-xs text-muted-foreground">{p.email}</div>
                  </div>
                  <span className="shrink-0 rounded bg-muted px-2 py-1 font-display text-sm font-semibold tabular-nums">
                    {p.weekly === null ? "—" : `${p.weekly}%`}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="tap -mr-1 shrink-0"
                    aria-label={`Remove pairing with ${p.email}`}
                    onClick={() => void removePair(p.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))
            : null}
        </div>
      </Panel>

      <Panel>
        <PanelTitle
          title="Challenges"
          hint="Score = 70% completion, 20% consistency, 10% participation. Rank is public; your days are not."
        />
        {/* Name gets its own line on a phone; the numbers and the action share
            the second one because none of them needs full width. */}
        <div className="space-y-2">
          <Input
            value={chName}
            maxLength={80}
            placeholder="e.g. 30 days of study"
            onChange={(e) => setChName(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <select
              value={chCategory}
              aria-label="Challenge category"
              onChange={(e) => setChCategory(e.target.value)}
              className={SELECT_CLASS}
            >
              <option value="general">Any category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
            <select
              value={chPrivate ? "private" : "public"}
              aria-label="Challenge visibility"
              onChange={(e) => setChPrivate(e.target.value === "private")}
              className={SELECT_CLASS}
            >
              <option value="public">Public</option>
              <option value="private">Invite code only</option>
            </select>
          </div>
          <div className="flex gap-2">
            <label className="flex min-w-0 flex-1 items-center gap-2 text-xs text-muted-foreground">
              <Input
                type="number"
                min={2}
                max={365}
                value={chDays}
                onChange={(e) => setChDays(Number(e.target.value) || 30)}
                className="w-20 shrink-0 sm:w-24"
              />
              days
            </label>
            <label className="flex min-w-0 flex-1 items-center gap-2 text-xs text-muted-foreground">
              <Input
                type="number"
                min={5}
                max={720}
                step={5}
                value={chFloor}
                onChange={(e) => setChFloor(Number(e.target.value) || 30)}
                className="w-20 shrink-0 sm:w-24"
              />
              min/day to count
            </label>
            <Button
              size="sm"
              className="tap shrink-0"
              disabled={createBusy}
              onClick={() => void createChallenge()}
            >
              {createBusy ? (
                <Loader2 className="mr-1 size-4 animate-spin" />
              ) : (
                <Flag className="mr-1 size-4" />
              )}
              Create
            </Button>
          </div>
          <div className="flex gap-2">
            <Input
              value={joinCode}
              placeholder="Have a code? e.g. K7MPQ2XZ"
              autoCapitalize="characters"
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === "Enter") void joinByCode();
              }}
              className="font-mono"
            />
            <Button
              size="sm"
              variant="secondary"
              className="tap shrink-0"
              disabled={codeBusy || !joinCode.trim()}
              onClick={() => void joinByCode()}
            >
              {codeBusy ? (
                <Loader2 className="mr-1 size-4 animate-spin" />
              ) : (
                <KeyRound className="mr-1 size-4" />
              )}
              Join
            </Button>
          </div>
        </div>

        <div className="mt-3 space-y-2">
          {!challenges?.length ? (
            <p className="text-sm text-muted-foreground">No challenges yet — start one.</p>
          ) : (
            challenges.map((c) => {
              const joinable = !c.joined && c.status !== "completed" && c.status !== "cancelled";
              const pct = c.total_days ? (c.day_index / c.total_days) * 100 : 0;
              return (
                <div key={c.id} className="rounded-lg border border-border p-3 text-sm">
                  <div className="flex items-start gap-2 sm:gap-3">
                    <Trophy className="mt-0.5 size-4 shrink-0 text-primary" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        {c.visibility === "private" ? (
                          <Lock
                            className="size-3 shrink-0 text-muted-foreground"
                            aria-label="Private"
                          />
                        ) : null}
                        <span className="break-words font-medium">{c.name}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {fmtDay(c.start_at)} → {fmtDay(c.end_at)} · {c.members} member
                        {c.members === 1 ? "" : "s"} · {c.min_daily_minutes} min/day
                      </div>
                    </div>
                    <span
                      className={`shrink-0 rounded px-2 py-1 text-xs font-medium capitalize ${STATUS_STYLE[c.status]}`}
                    >
                      {c.status}
                    </span>
                  </div>

                  {c.joined && c.status !== "cancelled" ? (
                    <div className="mt-2 flex items-center gap-3">
                      <Progress value={Math.min(100, pct)} className="h-1.5 flex-1" />
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        Day {c.day_index} / {c.total_days}
                        {c.my_score === null ? "" : ` · ${c.my_score}%`}
                      </span>
                    </div>
                  ) : null}

                  {/* The actions sit under the title rather than beside it: "Join"
                      plus "Leaderboard" plus a name never fit one phone line. */}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {joinable ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="tap flex-1 sm:flex-none"
                        onClick={() => void joinChallenge(c.id)}
                      >
                        Join
                      </Button>
                    ) : null}
                    {c.joined && c.status === "active" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="tap flex-1 sm:flex-none"
                        onClick={() => void leaveChallenge(c.id)}
                      >
                        Leave
                      </Button>
                    ) : null}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="tap flex-1 sm:flex-none"
                      aria-expanded={openBoard === c.id}
                      onClick={() => toggleBoard(c.id)}
                    >
                      {openBoard === c.id ? (
                        <ChevronUp className="size-4" />
                      ) : (
                        <ChevronDown className="size-4" />
                      )}
                      Leaderboard
                    </Button>
                    {c.invite_code ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="tap shrink-0 font-mono text-xs"
                        aria-label={`Copy invite code ${c.invite_code}`}
                        onClick={() => void copyCode(c.invite_code as string)}
                      >
                        <Copy className="mr-1 size-3.5" />
                        {c.invite_code}
                      </Button>
                    ) : null}
                    {c.is_owner && (c.status === "upcoming" || c.status === "active") ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="tap shrink-0 text-destructive"
                        onClick={() => void cancelChallenge(c.id)}
                      >
                        <Ban className="mr-1 size-3.5" /> Cancel
                      </Button>
                    ) : null}
                    {c.is_owner && (c.status === "upcoming" || c.status === "active") ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="tap shrink-0"
                        onClick={() => void toggleRoutineEditor(c.id, c)}
                      >
                        {editingRoutine === c.id ? (
                          <><Save className="mr-1 size-3.5" /> Save</>
                        ) : (
                          <><Edit3 className="mr-1 size-3.5" /> Routine</>
                        )}
                      </Button>
                    ) : null}
                  </div>

                  {openBoard === c.id ? (
                    <div className="mt-3 space-y-1 border-t border-border pt-3">
                      {boardBusy ? (
                        <p className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Loader2 className="size-3.5 animate-spin" /> Loading…
                        </p>
                      ) : board ? (
                        <>
                          {board.rows.map((r) => (
                            <div
                              key={r.user_id}
                              className={`flex items-center gap-2 text-xs ${
                                r.is_me ? "font-medium text-primary" : ""
                              }`}
                            >
                              {/* The server's rank, not the array index — ties
                                  share a number, and the top five plus your own
                                  row is not a contiguous list. */}
                              <span className="w-6 shrink-0 font-semibold tabular-nums text-muted-foreground">
                                #{r.rank}
                              </span>
                              <span className="flex-1 truncate">
                                {r.name}
                                {r.has_left ? " (left)" : ""}
                              </span>
                              <span className="shrink-0 tabular-nums">{r.score}%</span>
                            </div>
                          ))}
                          <p className="pt-1 text-xs text-muted-foreground">
                            {board.myRank
                              ? `You are #${board.myRank} of ${board.totalMembers}`
                              : `${board.totalMembers} ranked · you have not joined`}
                            {board.rows.some((r) => r.is_final) ? " · final" : ""}
                          </p>
                          {breakdown ? (
                            <p className="text-xs text-muted-foreground">
                              Completion {breakdown.completion ?? "—"}% · consistency{" "}
                              {breakdown.consistency ?? "—"}% · participation{" "}
                              {breakdown.participation ?? "—"}% ({breakdown.active_days} of{" "}
                              {breakdown.window_days} days logged)
                            </p>
                          ) : null}
                        </>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          Could not load the leaderboard.
                        </p>
                      )}
                    </div>
                  ) : null}

                  {/* Challenge routine editor */}
                  {editingRoutine === c.id ? (
                    <div className="mt-3 space-y-2 border-t border-border pt-3">
                      <p className="text-xs font-medium text-foreground">
                        Challenge Routine
                        {routineData?.locked_at ? " (locked)" : ""}
                      </p>
                      {routineBusy ? (
                        <p className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Loader2 className="size-3.5 animate-spin" /> Loading routine…
                        </p>
                      ) : routineData ? (
                        <div className="space-y-1 max-h-48 overflow-y-auto">
                          {Object.entries(routineData.routine)
                            .sort(([a], [b]) => parseInt(a) - parseInt(b))
                            .map(([day, blocks]) => (
                              <div key={day} className="text-xs">
                                <span className="font-medium text-muted-foreground">Day {day}:</span>{" "}
                                {(blocks as Block[]).map((b) => (
                                  <span key={b.id} className="ml-2">
                                    {b.title} ({b.category}, {b.start}–{b.end})
                                  </span>
                                ))}
                              </div>
                            ))}
                        </div>
                      ) : null}
                      {routineData && !routineData.locked_at ? (
                        <p className="text-xs text-muted-foreground">
                          Edit the routine in your plan — it will be auto-generated when you join
                          a challenge. Locked routines cannot be edited.
                        </p>
                      ) : null}
                      {editingRoutine && routineData && !routineData.locked_at ? (
                        <Button
                          size="sm"
                          className="tap shrink-0"
                          disabled={routineBusy}
                          onClick={() => void saveRoutine(c.id)}
                        >
                          {routineBusy ? (
                            <Loader2 className="mr-1 size-4 animate-spin" />
                          ) : (
                            <Save className="mr-1 size-4" />
                          )}
                          Save
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </Panel>
    </div>
  );
}

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import * as db from "@/lib/db";
import { sb } from "@/lib/supabase";
import type { BoardRow, Challenge, Peer } from "@/lib/db";
import { Panel, PanelTitle } from "./primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
  LogOut,
} from "lucide-react";
import { toast } from "sonner";

export function CommunityView() {
  const { user, logout } = useAuth();

  // ---- Accountability pairing ----
  const [peers, setPeers] = useState<Peer[] | null>(null);
  const [pairEmail, setPairEmail] = useState("");
  const [pairBusy, setPairBusy] = useState(false);
  const [pairRequests, setPairRequests] = useState<
    Array<{ id: string; requester_email: string; status: string }>
  >([]);
  const [requestsBusy, setRequestsBusy] = useState(false);
  const [respondBusy, setRespondBusy] = useState<string | null>(null);

  const loadPeers = useCallback(async () => {
    if (!user) return;
    try {
      setPeers(await db.listPeers());
    } catch {
      setPeers([]);
    }
  }, [user]);

  const loadRequests = useCallback(async () => {
    if (!user) return;
    setRequestsBusy(true);
    try {
      const { data, error } = await sb()
        .from("pairing_requests")
        .select("id, requester_id, target_email, status, created_at")
        .eq("target_email", user.email ?? "")
        .eq("status", "pending");
      if (error) throw error;
      setPairRequests((data ?? []) as typeof pairRequests);
    } catch {
      setPairRequests([]);
    } finally {
      setRequestsBusy(false);
    }
  }, [user]);

  useEffect(() => {
    void loadPeers();
    void loadRequests();
  }, [loadPeers, loadRequests]);

  const addPair = async () => {
    if (!pairEmail.trim()) return;
    setPairBusy(true);
    try {
      await db.pairWithEmail(pairEmail.trim());
      toast.success("Pair request sent — they must accept to connect.");
      setPairEmail("");
      void loadPeers();
      void loadRequests();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not pair");
    } finally {
      setPairBusy(false);
    }
  };

  const respondRequest = async (requestId: string, response: "accept" | "decline") => {
    setRespondBusy(requestId);
    try {
      await db.respondToPairingRequest(requestId, response);
      toast.success(response === "accept" ? "Pairing accepted!" : "Pairing declined");
      setPairRequests((ps) => ps.filter((r) => r.id !== requestId));
      void loadPeers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not respond");
    } finally {
      setRespondBusy(null);
    }
  };

  const removePair = async (peerId: string) => {
    try {
      await db.unpairUser(peerId);
      setPeers((ps) => (ps ? ps.filter((p) => p.id !== peerId) : ps));
      toast.success("Pairing removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove pairing");
    }
  };

  // ---- Challenges ----
  const [challenges, setChallenges] = useState<Challenge[] | null>(null);
  const [chName, setChName] = useState("");
  const [chDays, setChDays] = useState(30);
  const [openBoard, setOpenBoard] = useState<string | null>(null);
  const [board, setBoard] = useState<{ rows: BoardRow[]; myRank: number | null } | null>(null);
  const [boardBusy, setBoardBusy] = useState(false);

  const loadChallenges = useCallback(async () => {
    if (!user) return;
    try {
      setChallenges(await db.listChallenges());
    } catch {
      setChallenges([]);
    }
  }, [user]);

  useEffect(() => {
    void loadChallenges();
  }, [loadChallenges]);

  const createChallenge = async () => {
    if (!chName.trim()) return;
    try {
      await db.createChallenge(chName.trim(), "general", "", new Date(), new Date() + 30 * 24 * 60 * 60 * 1000);
      toast.success("Challenge created — you're the first member.");
      setChName("");
      void loadChallenges();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create challenge");
    }
  };

  const joinChallenge = async (id: string) => {
    try {
      await db.joinChallenge(id);
      toast.success("Joined. Rank is by completion % — opt-in, no pressure.");
      void loadChallenges();
      setOpenBoard(id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not join");
    }
  };

  const leaveChallenge = async (id: string) => {
    try {
      await db.leaveChallenge(id);
      setChallenges((cs) => cs ? cs.map((c) => c.id === id ? { ...c, joined: false } : c) : cs);
      toast.success("Left the challenge");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not leave");
    }
  };

  const toggleBoard = async (id: string) => {
    if (openBoard === id) {
      setOpenBoard(null);
      setBoard(null);
      return;
    }
    setOpenBoard(id);
    setBoardBusy(true);
    setBoard(null);
    try {
      const res = await db.challengeLeaderboard(id, user?.id ?? null);
      setBoard({ rows: res.leaderboard, myRank: res.myRank });
    } catch {
      setBoard(null);
    } finally {
      setBoardBusy(false);
    }
  };

  // ---- Settings / danger zone ----
  const [deleting, setDeleting] = useState(false);

  const deleteAccount = async () => {
    setDeleting(true);
    try {
      await db.deleteAccount();
      toast.success("Account and all data deleted.");
      await logout();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete account");
    } finally {
      setDeleting(false);
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
            Pair
          </Button>
        </div>
        <div className="mt-3 space-y-2">
          {/* Pairing requests */}
          {pairRequests.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-foreground">Pending requests</p>
              {pairRequests.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center gap-2 rounded-lg border border-border p-3 text-sm"
                >
                  <MailWarning className="size-4 shrink-0 text-muted-foreground" />
                  <span className="flex-1">{r.requester_email}</span>
                  {respondBusy === r.id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="tap"
                        aria-label="Accept pairing request"
                        onClick={() => void respondRequest(r.id, "accept")}
                      >
                        <Check className="size-4 text-green-600" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="tap"
                        aria-label="Decline pairing request"
                        onClick={() => void respondRequest(r.id, "decline")}
                      >
                        <X className="size-4 text-red-600" />
                      </Button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
          {!peers?.length && pairRequests.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No peers yet. Add someone by email — they must have an Ordo account.
            </p>
          ) : null}
          {peers?.length ? (
            peers.map((p) => (
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
          ) : null}
        </div>
      </Panel>

      <Panel>
        <PanelTitle
          title="Challenges"
          hint="Opt-in 30-day tests of willpower, ranked by completion rate."
        />
        {/* Name gets its own line on a phone; the day count and the action share
            the second one because neither needs full width. */}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={chName}
            placeholder="e.g. 30 days of study"
            onChange={(e) => setChName(e.target.value)}
          />
          <div className="flex gap-2">
            <Input
              type="number"
              min={7}
              max={90}
              value={chDays}
              aria-label="Challenge length in days"
              onChange={(e) => setChDays(Number(e.target.value) || 30)}
              className="w-20 shrink-0 sm:w-24"
            />
            <Button
              size="sm"
              className="tap flex-1 sm:flex-none"
              onClick={() => void createChallenge()}
            >
              <Flag className="mr-1 size-4" /> Create
            </Button>
          </div>
        </div>
        <div className="mt-3 space-y-2">
          {!challenges?.length ? (
            <p className="text-sm text-muted-foreground">No challenges yet — start one.</p>
          ) : (
            challenges.map((c) => (
              <div key={c.id} className="rounded-lg border border-border p-3 text-sm">
                <div className="flex items-start gap-2 sm:gap-3">
                  <Trophy className="mt-0.5 size-4 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1">
                    <div className="break-words font-medium">{c.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {c.starts_on} → {c.ends_on} · {c.members} member{c.members === 1 ? "" : "s"}
                    </div>
                  </div>
                  {c.joined ? (
                    <span className="shrink-0 rounded bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                      Joined
                    </span>
                  ) : null}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  {c.joined ? null : (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="tap flex-1 sm:flex-none"
                      onClick={() => void joinChallenge(c.id)}
                    >
                      Join
                    </Button>
                  )}
                  {c.joined ? (
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
                    onClick={() => void toggleBoard(c.id)}
                  >
                    {openBoard === c.id ? (
                      <ChevronUp className="size-4" />
                    ) : (
                      <ChevronDown className="size-4" />
                    )}
                    Leaderboard
                  </Button>
                </div>
                {/* The actions sit under the title rather than beside it: "Join"
                    plus "Leaderboard" plus a name never fit one phone line. */}
                {openBoard === c.id ? (
                  <div className="mt-3 space-y-1 border-t border-border pt-3">
                    {boardBusy ? (
                      <p className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Loader2 className="size-3.5 animate-spin" /> Loading…
                      </p>
                    ) : board ? (
                      <>
                        {board.rows.slice(0, 5).map((r, i) => (
                          <div key={r.user_id} className="flex items-center gap-2 text-xs">
                            <span className="w-5 font-semibold tabular-nums text-muted-foreground">
                              #{i + 1}
                            </span>
                            <span className="flex-1 truncate">{r.name || "Anonymous"}</span>
                            <span className="font-medium tabular-nums">{r.score}%</span>
                          </div>
                        ))}
                        {board.myRank ? (
                          <p className="pt-1 text-xs font-medium text-primary">
                            Your rank: #{board.myRank}
                          </p>
                        ) : (
                          <p className="pt-1 text-xs text-muted-foreground">
                            You haven't joined this challenge.
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Could not load the leaderboard.
                      </p>
                    )}
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>
      </Panel>

      <Panel>
        <PanelTitle title="Settings & data" hint="Your data, your rules — GDPR-style controls." />
        <div className="space-y-4 text-sm">
          <div>
            <p className="font-medium">Data & privacy</p>
            <p className="mt-1 text-muted-foreground">
              Everything is exportable (JSON, CSV, iCal) from the header. Version history keeps the
              last 30 snapshots — use the Undo button in the header to step back.
            </p>
          </div>
          <div className="rounded-lg border border-destructive/40 p-3 sm:p-4">
            <p className="font-medium text-destructive">Delete account</p>
            <p className="mt-1 text-muted-foreground">
              Permanently removes your account, sync state, pairings, letters and memberships. This
              cannot be undone.
            </p>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  size="sm"
                  className="tap mt-3 w-full sm:w-auto"
                  disabled={deleting}
                >
                  {deleting ? <Loader2 className="mr-1 size-4 animate-spin" /> : null} Delete my
                  account
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete your Ordo account?</AlertDialogTitle>
                  <AlertDialogDescription>
                    All synced data is wiped from the server. Export anything you want to keep
                    first. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="tap">Keep my account</AlertDialogCancel>
                  <AlertDialogAction
                    className="tap bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() => void deleteAccount()}
                  >
                    Delete forever
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
          <div className="rounded-lg border border-border p-3 sm:p-4">
            <p className="font-medium">Sign out</p>
            <p className="mt-1 text-muted-foreground">
              Sign out of this device. Your data stays synced to other devices.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="tap mt-3 w-full sm:w-auto"
              onClick={() => void logout()}
            >
              <LogOut className="mr-1 size-4" /> Sign out
            </Button>
          </div>
        </div>
      </Panel>
    </div>
  );
}

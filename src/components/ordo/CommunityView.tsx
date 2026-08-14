import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { Panel, PanelTitle } from "./primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { UserPlus, Users, Trophy, Trash2, ChevronDown, ChevronUp, Loader2, Flag } from "lucide-react";
import { toast } from "sonner";

type Peer = { id: string; name: string; email: string; weekly: number | null };

type Challenge = {
  id: string;
  name: string;
  starts_on: string;
  ends_on: string;
  owner_id: string;
  members: number;
  joined: boolean;
};

type BoardRow = { user_id: string; name: string; score: number };

export function CommunityView() {
  const { user, logout } = useAuth();

  // ---- Accountability pairing ----
  const [peers, setPeers] = useState<Peer[] | null>(null);
  const [pairEmail, setPairEmail] = useState("");
  const [pairBusy, setPairBusy] = useState(false);

  const loadPeers = useCallback(async () => {
    if (!user) return;
    try {
      const res = await apiFetch<{ peers: Peer[] }>("/api/pairs");
      setPeers(res.peers);
    } catch {
      setPeers([]);
    }
  }, [user]);

  useEffect(() => {
    void loadPeers();
  }, [loadPeers]);

  const addPair = async () => {
    if (!pairEmail.trim()) return;
    setPairBusy(true);
    try {
      await apiFetch("/api/pairs", { method: "POST", json: { email: pairEmail.trim() } });
      toast.success("Pairing added — they can see your weekly %, nothing else.");
      setPairEmail("");
      void loadPeers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not pair");
    } finally {
      setPairBusy(false);
    }
  };

  const removePair = async (peerId: string) => {
    try {
      await apiFetch(`/api/pairs/${peerId}`, { method: "DELETE", json: {} });
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
      const res = await apiFetch<{ challenges: Challenge[] }>("/api/challenges");
      setChallenges(res.challenges);
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
      await apiFetch("/api/challenges", {
        method: "POST",
        json: { name: chName.trim(), days: Math.max(7, Math.min(90, chDays)) },
      });
      toast.success("Challenge created — you're the first member.");
      setChName("");
      void loadChallenges();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create challenge");
    }
  };

  const joinChallenge = async (id: string) => {
    try {
      await apiFetch(`/api/challenges/${id}/join`, { method: "POST", json: {} });
      toast.success("Joined. Rank is by completion % — opt-in, no pressure.");
      void loadChallenges();
      setOpenBoard(id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not join");
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
      const res = await apiFetch<{ leaderboard: BoardRow[]; myRank: number | null }>(
        `/api/challenges/${id}/leaderboard`,
      );
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
      await apiFetch("/api/account", { method: "DELETE", json: {} });
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
    <div className="space-y-5">
      <Panel>
        <PanelTitle
          title="Accountability pairing"
          hint="Each of you sees the other's weekly % — never task details."
        />
        <div className="flex gap-2">
          <Input
            value={pairEmail}
            type="email"
            placeholder="friend@example.com"
            onChange={(e) => setPairEmail(e.target.value)}
          />
          <Button size="sm" disabled={pairBusy} onClick={() => void addPair()}>
            {pairBusy ? <Loader2 className="mr-1 size-4 animate-spin" /> : <UserPlus className="mr-1 size-4" />}
            Pair
          </Button>
        </div>
        <div className="mt-3 space-y-2">
          {!peers?.length ? (
            <p className="text-sm text-muted-foreground">
              No peers yet. Add someone by email — they must have an Ordo account.
            </p>
          ) : (
            peers.map((p) => (
              <div key={p.id} className="flex items-center gap-3 rounded-lg border border-border p-3 text-sm">
                <Users className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{p.name || p.email}</div>
                  <div className="truncate text-xs text-muted-foreground">{p.email}</div>
                </div>
                <span className="rounded bg-muted px-2 py-1 font-display text-sm font-semibold tabular-nums">
                  {p.weekly === null ? "—" : `${p.weekly}%`}
                </span>
                <Button variant="ghost" size="icon" aria-label="Remove pairing" onClick={() => void removePair(p.id)}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))
          )}
        </div>
      </Panel>

      <Panel>
        <PanelTitle
          title="Challenges"
          hint="Opt-in 30-day tests of willpower, ranked by completion rate."
        />
        <div className="flex gap-2">
          <Input
            value={chName}
            placeholder="e.g. 30 days of study"
            onChange={(e) => setChName(e.target.value)}
          />
          <Input
            type="number"
            min={7}
            max={90}
            value={chDays}
            aria-label="Challenge length in days"
            onChange={(e) => setChDays(Number(e.target.value) || 30)}
            className="w-24"
          />
          <Button size="sm" onClick={() => void createChallenge()}>
            <Flag className="mr-1 size-4" /> Create
          </Button>
        </div>
        <div className="mt-3 space-y-2">
          {!challenges?.length ? (
            <p className="text-sm text-muted-foreground">No challenges yet — start one.</p>
          ) : (
            challenges.map((c) => (
              <div key={c.id} className="rounded-lg border border-border p-3 text-sm">
                <div className="flex items-center gap-3">
                  <Trophy className="size-4 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{c.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {c.starts_on} → {c.ends_on} · {c.members} member{c.members === 1 ? "" : "s"}
                    </div>
                  </div>
                  {c.joined ? (
                    <span className="rounded bg-primary/10 px-2 py-1 text-xs font-medium text-primary">Joined</span>
                  ) : (
                    <Button size="sm" variant="secondary" onClick={() => void joinChallenge(c.id)}>
                      Join
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => void toggleBoard(c.id)}>
                    {openBoard === c.id ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                    Leaderboard
                  </Button>
                </div>
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
                            <span className="w-5 font-semibold tabular-nums text-muted-foreground">#{i + 1}</span>
                            <span className="flex-1 truncate">{r.name || "Anonymous"}</span>
                            <span className="font-medium tabular-nums">{r.score}%</span>
                          </div>
                        ))}
                        {board.myRank ? (
                          <p className="pt-1 text-xs font-medium text-primary">Your rank: #{board.myRank}</p>
                        ) : (
                          <p className="pt-1 text-xs text-muted-foreground">You haven't joined this challenge.</p>
                        )}
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground">Could not load the leaderboard.</p>
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
              Everything is exportable (JSON, CSV, iCal) from the header. Version history keeps the last 30 snapshots —
              use the Undo button in the header to step back.
            </p>
          </div>
          <div className="rounded-lg border border-destructive/40 p-4">
            <p className="font-medium text-destructive">Delete account</p>
            <p className="mt-1 text-muted-foreground">
              Permanently removes your account, sync state, pairings, letters and memberships. This cannot be undone.
            </p>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" className="mt-3" disabled={deleting}>
                  {deleting ? <Loader2 className="mr-1 size-4 animate-spin" /> : null} Delete my account
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete your Ordo account?</AlertDialogTitle>
                  <AlertDialogDescription>
                    All synced data is wiped from the server. Export anything you want to keep first. This cannot be
                    undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep my account</AlertDialogCancel>
                  <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => void deleteAccount()}>
                    Delete forever
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </Panel>
    </div>
  );
}

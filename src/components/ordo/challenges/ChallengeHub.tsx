import { useCallback, useEffect, useState } from "react";
import { Plus, Search, Trophy, Inbox } from "lucide-react";
import { toast } from "sonner";
import * as db from "@/lib/db";
import type { Block, ChallengeRoutine } from "@/lib/db";
import { useAuth } from "@/lib/auth-context";
import { ChallengeCard } from "./Card";
import { ChallengeDetail } from "./Detail";
import { ChallengeRoutineEditor } from "./RoutineEditor";
import { CreateChallengeWizard } from "./CreateWizard";
import { buildCardModel, type ChallengeCardModel, type ChallengeDraft } from "./types";

type FilterId = "ALL" | "ACTIVE" | "UPCOMING" | "FINALIZED" | "CREATOR" | "UNLOCKED" | "LOCKED";

const FILTERS: { id: FilterId; label: string }[] = [
  { id: "ALL", label: "All" },
  { id: "ACTIVE", label: "● Active" },
  { id: "UPCOMING", label: "● Upcoming" },
  { id: "FINALIZED", label: "Finalized" },
  { id: "CREATOR", label: "My Challenges" },
  { id: "UNLOCKED", label: "Editable Routine" },
  { id: "LOCKED", label: "Locked" },
];

export function ChallengeHub() {
  const { user } = useAuth();
  const [challenges, setChallenges] = useState<ChallengeCardModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterId>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals
  const [selectedChallenge, setSelectedChallenge] = useState<ChallengeCardModel | null>(null);
  const [editingChallenge, setEditingChallenge] = useState<ChallengeCardModel | null>(null);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [createdChallengeName, setCreatedChallengeName] = useState<string | undefined>();
  const [createdInviteCode, setCreatedInviteCode] = useState<string | undefined>();

  const loadChallenges = useCallback(async () => {
    if (!user) {
      setChallenges([]);
      setLoading(false);
      return;
    }
    try {
      const rows = await db.listChallenges();
      const models: ChallengeCardModel[] = [];

      for (const c of rows) {
        let routine: Record<number, Block[]> | null = null;
        let breakdown: db.ChallengeBreakdown | null = null;
        let leaderboard: db.BoardRow[] = [];

        try {
          const r = await db.getChallengeRoutine(c.id);
          if (r) routine = r.routine;
        } catch {
          /* routine not available */
        }

        try {
          breakdown = await db.challengeBreakdown(c.id);
        } catch {
          /* breakdown not available */
        }

        try {
          const lb = await db.challengeLeaderboard(c.id);
          leaderboard = lb.leaderboard;
        } catch {
          /* leaderboard not available */
        }

        models.push(buildCardModel(c, routine, breakdown, leaderboard, user?.id ?? null));
      }

      setChallenges(models);
    } catch {
      setChallenges([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void loadChallenges();
  }, [loadChallenges]);

  // ---- Actions ----

  const handleJoinChallenge = async (challengeId: string) => {
    try {
      await db.joinChallenge(challengeId);
      toast.success("Joined. Rank is by score — nobody sees what your days contain.");
      await loadChallenges();
      // Refresh the selected/edited challenge
      setSelectedChallenge((prev) => (prev?.id === challengeId ? null : prev));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not join");
    }
  };

  const handleLeaveChallenge = async (challengeId: string) => {
    try {
      await db.leaveChallenge(challengeId);
      toast.success("Left the challenge — your score so far stays ranked.");
      await loadChallenges();
      setSelectedChallenge((prev) => (prev?.id === challengeId ? null : prev));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not leave");
    }
  };

  const handleCancelChallenge = async (challengeId: string) => {
    try {
      await db.cancelChallenge(challengeId);
      toast.success("Cancelled. It will not be scored.");
      await loadChallenges();
      setSelectedChallenge((prev) => (prev?.id === challengeId ? null : prev));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not cancel");
    }
  };

  const handleCreateChallenge = async (draft: ChallengeDraft) => {
    try {
      const startAt = new Date(draft.startDate);
      const endAt = new Date(startAt);
      endAt.setDate(endAt.getDate() + draft.durationDays);

      await db.createChallenge({
        name: draft.name.trim(),
        category: draft.category,
        description: "",
        startAt,
        endAt,
        visibility: draft.visibility,
        minDailyMinutes: draft.minDailyMinutes,
      });

      // Save routine if schedule has blocks
      const totalBlocks = draft.schedule.reduce((acc, s) => acc + s.blocks.length, 0);
      let inviteCode: string | null = null;
      if (totalBlocks > 0) {
        // We need to find the newly created challenge to save its routine
        const rows = await db.listChallenges();
        const newest = rows.find((r) => r.name === draft.name.trim() && r.is_owner);
        if (newest) {
          inviteCode = newest.invite_code;
          const routineByDay: Record<number, Block[]> = {};
          for (const day of draft.schedule) {
            routineByDay[day.dayOfWeek] = day.blocks.map((b) => ({
              id: b.id,
              title: b.title,
              start: b.startTime,
              end: b.endTime,
              category: b.category,
              priority: "must" as const,
            }));
          }
          await db.updateChallengeRoutine(newest.id, routineByDay);
        }
      } else {
        const rows = await db.listChallenges();
        const newest = rows.find((r) => r.name === draft.name.trim() && r.is_owner);
        if (newest) inviteCode = newest.invite_code;
      }

      setCreatedChallengeName(draft.name.trim());
      setCreatedInviteCode(inviteCode ?? undefined);
      toast.success(
        draft.visibility === "private"
          ? "Created. Share the invite code to let people in."
          : "Created — you are the first member.",
      );
      await loadChallenges();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create the challenge");
    }
  };

  const handleSaveRoutine = async (challengeId: string, routine: Record<number, Block[]>) => {
    try {
      await db.updateChallengeRoutine(challengeId, routine);
      toast.success("Challenge routine updated");
      setEditingChallenge(null);
      await loadChallenges();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save routine");
    }
  };

  const handleToggleTodayBlock = (_challengeId: string, _blockId: string) => {
    // Block toggling requires challenge_logs writes which aren't implemented yet
    // For now this is a no-op placeholder
  };

  if (!user) {
    return (
      <div className="space-y-4 sm:space-y-5">
        <div className="bg-surface rounded-2xl border border-border p-6 text-center">
          <Trophy className="w-10 h-10 text-primary mx-auto mb-3" aria-hidden="true" />
          <h3 className="text-base font-bold text-foreground">Challenges</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Sign in to join challenges and publish your discipline to the leaderboard.
          </p>
        </div>
      </div>
    );
  }

  const filteredChallenges = challenges.filter((c) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matches = c.name.toLowerCase().includes(q) || c.category.toLowerCase().includes(q);
      if (!matches) return false;
    }

    if (filter === "ALL") return true;
    if (filter === "ACTIVE") return c.status === "active";
    if (filter === "UPCOMING") return c.status === "upcoming";
    if (filter === "FINALIZED") return c.status === "completed";
    if (filter === "CREATOR") return c.isCreator;
    if (filter === "LOCKED") return c.routineLocked;
    if (filter === "UNLOCKED") return !c.routineLocked && c.isCreator;
    return true;
  });

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Header */}
      <div className="bg-surface rounded-2xl border border-border p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/30 text-primary flex items-center justify-center shadow-xs">
            <Trophy className="w-5 h-5 text-primary" aria-hidden="true" />
          </div>
          <div>
            <h2 className="font-extrabold text-foreground text-base tracking-tight leading-none">
              Challenge Hub
            </h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Score = 70% completion, 20% consistency, 10% participation
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setCreatedChallengeName(undefined);
            setCreatedInviteCode(undefined);
            setIsWizardOpen(true);
          }}
          className="min-h-[40px] px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-primary-foreground font-bold text-xs tracking-wide shadow-xs flex items-center gap-1.5 transition-colors"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          <span>Create Challenge</span>
        </button>
      </div>

      {/* Filters & Search */}
      <div className="bg-surface p-3 rounded-2xl border border-border shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 no-scrollbar">
          {FILTERS.map((tab) => (
            <button
              type="button"
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                filter === tab.id
                  ? "bg-primary text-primary-foreground font-bold shadow-xs"
                  : "bg-surface-elevated hover:bg-muted text-muted-foreground hover:text-foreground border border-border"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative flex-1 sm:w-48">
          <Search
            className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2"
            aria-hidden="true"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search challenges..."
            className="w-full text-xs pl-8 pr-3 py-1.5 rounded-xl border border-border bg-surface-elevated text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      {/* Challenge Cards Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <ChallengeCard isLoading={true} />
          <ChallengeCard isLoading={true} />
          <ChallengeCard isLoading={true} />
        </div>
      ) : filteredChallenges.length === 0 ? (
        <div className="text-center py-16 px-4 bg-surface rounded-2xl border border-dashed border-border max-w-lg mx-auto space-y-3">
          <div className="w-12 h-12 rounded-full bg-surface-elevated text-primary border border-border flex items-center justify-center mx-auto">
            <Inbox className="w-6 h-6 text-primary" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">
              No challenges matching your criteria
            </h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
              Start a new community challenge or adjust your filters.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setCreatedChallengeName(undefined);
              setIsWizardOpen(true);
            }}
            className="min-h-[44px] px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-primary-foreground font-bold text-xs shadow-xs inline-flex items-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Start New Challenge</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 items-start">
          {filteredChallenges.map((challenge) => (
            <ChallengeCard
              key={challenge.id}
              challenge={challenge}
              onSelect={(c) => setSelectedChallenge(c)}
              onToggleTodayBlock={handleToggleTodayBlock}
              onOpenLeaderboard={(c) => setSelectedChallenge(c)}
              onEditRoutine={(c) => setEditingChallenge(c)}
            />
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {selectedChallenge && (
        <ChallengeDetail
          challenge={selectedChallenge}
          onClose={() => setSelectedChallenge(null)}
          onJoinChallenge={handleJoinChallenge}
          onEditRoutine={(c) => {
            setSelectedChallenge(null);
            setEditingChallenge(c);
          }}
        />
      )}

      {/* Routine Editor Modal */}
      {editingChallenge && (
        <ChallengeRoutineEditor
          challenge={editingChallenge}
          onClose={() => setEditingChallenge(null)}
          onSaveRoutine={handleSaveRoutine}
        />
      )}

      {/* Create Wizard Modal */}
      {isWizardOpen && (
        <CreateChallengeWizard
          onClose={() => setIsWizardOpen(false)}
          onCreateChallenge={(draft) => {
            void handleCreateChallenge(draft);
          }}
          createdChallengeName={createdChallengeName}
          createdInviteCode={createdInviteCode}
        />
      )}
    </div>
  );
}

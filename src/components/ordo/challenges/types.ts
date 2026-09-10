import type { Challenge, BoardRow, ChallengeBreakdown, ChallengeStatus } from "@/lib/db";
import type { Block } from "@/lib/ordo";

export type { ChallengeStatus };

/** Block extended with the day of week it belongs to (stored in the routine record key). */
export type BlockWithDay = Block & { dayOfWeek: number };

export type { Block as ChallengeRoutineBlock } from "@/lib/ordo";

export interface LeaderboardMember {
  id: string;
  name: string;
  score: number;
  rank: number;
  isCurrentUser: boolean;
  hasLeft: boolean;
  completionRate: number | null;
  consistencyRate: number | null;
  participationRate: number | null;
}

export interface ChallengeCardModel {
  id: string;
  name: string;
  category: string;
  status: ChallengeStatus;
  startAt: string;
  endAt: string;
  description: string;
  visibility: "public" | "private";
  minDailyMinutes: number;
  maxParticipants: number | null;
  score: number | null;
  rank: number | null;
  memberCount: number;
  completion: number | null;
  consistency: number | null;
  participation: number | null;
  currentDay: number;
  totalDays: number;
  routineLocked: boolean;
  isCreator: boolean;
  joined: boolean;
  inviteCode: string | null;
  todayBlocks: BlockWithDay[];
  allWeeklyRoutine: BlockWithDay[];
  leaderboard: LeaderboardMember[];
  breakdown: ChallengeBreakdown | null;
}

export interface ChallengeDraft {
  name: string;
  category: string;
  durationDays: number;
  startDate: string;
  visibility: "public" | "private";
  minDailyMinutes: number;
  schedule: {
    dayOfWeek: number;
    blocks: {
      id: string;
      title: string;
      startTime: string;
      endTime: string;
      category: string;
    }[];
  }[];
}

export function buildCardModel(
  c: Challenge,
  routine: Record<number, Block[]> | null,
  breakdown: ChallengeBreakdown | null,
  leaderboard: BoardRow[],
  _currentUserId: string | null,
): ChallengeCardModel {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(c.start_at);
  start.setHours(0, 0, 0, 0);
  const dayIndex = Math.max(
    0,
    Math.min(c.total_days, Math.floor((today.getTime() - start.getTime()) / 86400000) + 1),
  );
  const dayOfWeek = today.getDay();

  const allWeeklyRoutine: BlockWithDay[] = routine
    ? Object.entries(routine).flatMap(([d, blocks]) =>
        blocks.map((b) => ({ ...b, dayOfWeek: Number(d) })),
      )
    : [];

  const todayBlocks: BlockWithDay[] = routine?.[dayOfWeek]?.map((b) => ({ ...b, dayOfWeek })) ?? [];

  const isLocked = routine !== null;
  const me = leaderboard.find((r) => r.is_me);

  const mappedLeaderboard: LeaderboardMember[] = leaderboard.map((r) => ({
    id: r.user_id,
    name: r.name,
    score: r.score,
    rank: r.rank,
    isCurrentUser: r.is_me,
    hasLeft: r.has_left,
    completionRate: breakdown?.completion ?? null,
    consistencyRate: breakdown?.consistency ?? null,
    participationRate: breakdown?.participation ?? null,
  }));

  return {
    id: c.id,
    name: c.name,
    category: c.category,
    status: c.status,
    startAt: c.start_at,
    endAt: c.end_at,
    description: c.description,
    visibility: c.visibility,
    minDailyMinutes: c.min_daily_minutes,
    maxParticipants: c.max_participants,
    score: c.my_score,
    rank: me?.rank ?? null,
    memberCount: c.members,
    completion: breakdown?.completion ?? null,
    consistency: breakdown?.consistency ?? null,
    participation: breakdown?.participation ?? null,
    currentDay: dayIndex,
    totalDays: c.total_days,
    routineLocked: isLocked,
    isCreator: c.is_owner,
    joined: c.joined,
    inviteCode: c.invite_code,
    todayBlocks,
    allWeeklyRoutine,
    leaderboard: mappedLeaderboard,
    breakdown,
  };
}

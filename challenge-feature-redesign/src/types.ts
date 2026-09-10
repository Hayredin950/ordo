export type ChallengeStatus = 
  | 'UPCOMING'
  | 'ACTIVE'
  | 'COMPLETED'
  | 'FINALIZED'
  | 'CANCELLED';

export interface ChallengeRoutineBlock {
  id: string;
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, ... 6 = Saturday
  startTime: string; // e.g. "07:00"
  endTime: string;   // e.g. "07:45"
  title: string;
  category: string;
  completed?: boolean;
}

export interface LeaderboardMember {
  id: string;
  name: string;
  avatarUrl?: string;
  score: number;
  rank: number;
  isCurrentUser?: boolean;
  completionRate: number;
  consistencyRate: number;
  participationRate: number;
}

export interface ChallengeCardModel {
  id: string;
  name: string;
  category: string; // e.g., "Fitness", "Mindfulness", "Coding", "Reading"
  status: ChallengeStatus;
  startAt: string;
  endAt: string;
  score: number | null;
  rank: number | null;
  memberCount: number;
  completion: number | null;
  consistency: number | null;
  participation: number | null;
  currentDay: number;
  totalDays: number;
  routineLocked: boolean;
  isCreator?: boolean;
  joined?: boolean;
  todayBlocks: ChallengeRoutineBlock[];
  allWeeklyRoutine: ChallengeRoutineBlock[];
  leaderboard?: LeaderboardMember[];
}

export interface ChallengeDraft {
  name: string;
  category: string;
  durationDays: number;
  startDate: string;
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

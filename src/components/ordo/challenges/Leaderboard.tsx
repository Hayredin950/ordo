import { Trophy } from "lucide-react";
import type { LeaderboardMember } from "./types";

interface Props {
  members: LeaderboardMember[];
  challengeName: string;
}

export function ChallengeLeaderboard({ members }: Props) {
  if (members.length === 0) {
    return (
      <div className="text-center py-10 px-4 bg-surface rounded-2xl border border-dashed border-border text-muted-foreground">
        <div className="w-10 h-10 rounded-full bg-muted text-primary flex items-center justify-center mx-auto mb-2 border border-border">
          <Trophy className="w-5 h-5 text-primary" aria-hidden="true" />
        </div>
        <h4 className="text-sm font-semibold text-foreground">No participants yet</h4>
        <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
          Be the first to join this challenge and claim rank #1 on the leaderboard.
        </p>
      </div>
    );
  }

  const sorted = [...members].sort((a, b) => a.rank - b.rank);
  const top3 = sorted.slice(0, 3);

  const getRankBadge = (rank: number) => {
    if (rank === 1) {
      return (
        <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs shadow-xs">
          1
        </span>
      );
    }
    if (rank === 2) {
      return (
        <span className="w-6 h-6 rounded-full bg-muted text-muted-foreground flex items-center justify-center font-bold text-xs border border-border">
          2
        </span>
      );
    }
    if (rank === 3) {
      return (
        <span className="w-6 h-6 rounded-full bg-muted text-muted-foreground flex items-center justify-center font-bold text-xs border border-border">
          3
        </span>
      );
    }
    return (
      <span className="w-6 h-6 rounded-full bg-muted/50 text-muted-foreground flex items-center justify-center font-semibold text-xs font-mono">
        {rank}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {top3.length > 0 && (
        <div className="grid grid-cols-3 gap-2 pt-2">
          {top3.map((member) => (
            <div
              key={member.id}
              className={`p-3 rounded-xl border text-center flex flex-col items-center justify-between transition-colors ${
                member.rank === 1
                  ? "bg-primary/10 border-primary/40 ring-1 ring-primary/40"
                  : member.isCurrentUser
                    ? "bg-primary/5 border-primary/30"
                    : "bg-surface border-border"
              }`}
            >
              <div className="relative mb-1">
                <div className="w-9 h-9 rounded-full bg-muted border border-border flex items-center justify-center text-xs font-bold text-foreground shadow-xs">
                  {member.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="absolute -bottom-1 -right-1">{getRankBadge(member.rank)}</div>
              </div>

              <div className="mt-1 w-full">
                <p className="text-xs font-bold text-foreground truncate">{member.name}</p>
                <div className="text-sm font-extrabold text-foreground font-mono mt-0.5">
                  {member.score.toFixed(1)}
                </div>
                {member.consistencyRate !== null && (
                  <div className="text-[10px] text-muted-foreground font-medium">
                    {member.consistencyRate}% const.
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="border border-border rounded-xl overflow-hidden bg-surface">
        <div className="bg-surface-elevated px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground grid grid-cols-12 gap-2 border-b border-border">
          <span className="col-span-2">Rank</span>
          <span className="col-span-6">Participant</span>
          <span className="col-span-4 text-right">Score</span>
        </div>

        <div className="divide-y divide-border">
          {sorted.map((member) => (
            <div
              key={member.id}
              className={`px-3 py-2.5 grid grid-cols-12 gap-2 items-center text-xs transition-colors ${
                member.isCurrentUser
                  ? "bg-primary/10 font-semibold text-foreground"
                  : "hover:bg-muted/40 text-muted-foreground"
              }`}
            >
              <div className="col-span-2 flex items-center gap-1">{getRankBadge(member.rank)}</div>

              <div className="col-span-6 flex items-center gap-2 min-w-0">
                <div className="w-6 h-6 rounded-full bg-muted text-[10px] font-bold text-foreground flex items-center justify-center shrink-0 border border-border">
                  {member.name.charAt(0)}
                </div>
                <div className="truncate">
                  <span className="text-foreground truncate font-medium">{member.name}</span>
                  {member.isCurrentUser && (
                    <span className="ml-1.5 px-1.5 py-0.2 rounded bg-primary/20 text-primary text-[10px] font-bold border border-primary/30">
                      YOU
                    </span>
                  )}
                  {member.hasLeft && (
                    <span className="ml-1.5 text-[10px] text-muted-foreground">(left)</span>
                  )}
                </div>
              </div>

              <div className="col-span-4 text-right">
                <div className="font-bold text-foreground font-mono">
                  {member.score.toFixed(1)} pts
                </div>
                {member.consistencyRate !== null && (
                  <div className="text-[10px] text-muted-foreground">
                    {member.consistencyRate}% consistency
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

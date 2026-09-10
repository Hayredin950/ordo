import { useState } from "react";
import {
  X,
  Trophy,
  Calendar,
  Clock,
  CheckCircle2,
  Circle,
  Lock,
  ArrowRight,
  Check,
  Edit3,
} from "lucide-react";
import { ChallengeStatusBadge } from "./StatusBadge";
import { ChallengeLeaderboard } from "./Leaderboard";
import { getCategoryMeta } from "./categoryColors";
import type { ChallengeCardModel } from "./types";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface Props {
  challenge: ChallengeCardModel;
  onClose: () => void;
  onJoinChallenge?: (challengeId: string) => void;
  onEditRoutine?: (challenge: ChallengeCardModel) => void;
}

export function ChallengeDetail({ challenge, onClose, onJoinChallenge, onEditRoutine }: Props) {
  const [activeTab, setActiveTab] = useState<"routine" | "leaderboard" | "breakdown">("routine");

  const {
    id,
    name,
    category,
    status,
    startAt,
    endAt,
    score,
    rank,
    memberCount,
    completion,
    consistency,
    participation,
    totalDays,
    routineLocked,
    isCreator,
    joined,
    allWeeklyRoutine,
    leaderboard = [],
  } = challenge;

  const isFinal = status === "completed";
  const isUpcoming = status === "upcoming";
  const catMeta = getCategoryMeta(category);

  const routineByDay = DAY_NAMES.map((dayName, dayIndex) => ({
    dayIndex,
    dayName,
    blocks: allWeeklyRoutine.filter((b) => b.dayOfWeek === dayIndex),
  }));

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });

  return (
    <div
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`detail-modal-title-${id}`}
    >
      <div
        className="bg-surface rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl border border-border overflow-hidden text-foreground"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-border flex items-start justify-between gap-4 bg-surface-elevated/70">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border ${catMeta.badgeClass}`}
              >
                {category}
              </span>
              <span className="text-border">•</span>
              <span className="text-xs text-muted-foreground flex items-center gap-1 font-mono">
                <Calendar className="w-3.5 h-3.5 text-muted-foreground" aria-hidden="true" />
                {fmtDate(startAt)} → {fmtDate(endAt)} ({totalDays} Days)
              </span>
              <ChallengeStatusBadge status={status} />
            </div>
            <h2
              id={`detail-modal-title-${id}`}
              className="text-xl sm:text-2xl font-bold text-foreground leading-tight"
            >
              {name}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="w-8 h-8 rounded-full bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors shrink-0 border border-border"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-xl bg-surface-elevated/60 border border-border">
            <div>
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                {isFinal ? "Final Score" : "Current Score"}
              </span>
              <div className="text-2xl font-extrabold text-primary font-mono mt-0.5">
                {score !== null ? score.toFixed(1) : "--"}
              </div>
            </div>

            <div className="border-l border-border pl-3">
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                {isFinal ? "Final Rank" : "Current Standing"}
              </span>
              <div className="text-2xl font-extrabold text-foreground font-mono mt-0.5">
                {rank !== null ? `#${rank}` : "--"}
                <span className="text-xs font-normal text-muted-foreground">
                  {" "}
                  / {memberCount || 1}
                </span>
              </div>
            </div>

            <div className="border-l border-border pl-3">
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                Consistency
              </span>
              <div className="text-2xl font-extrabold text-primary font-mono mt-0.5">
                {consistency !== null ? `${consistency}%` : "--"}
              </div>
            </div>

            <div className="border-l border-border pl-3">
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                Completion
              </span>
              <div className="text-2xl font-extrabold text-foreground font-mono mt-0.5">
                {completion !== null ? `${completion}%` : "--"}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 border-b border-border pb-1">
            <button
              type="button"
              onClick={() => setActiveTab("routine")}
              className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-colors ${
                activeTab === "routine"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              Full Weekly Routine
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("leaderboard")}
              className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 ${
                activeTab === "leaderboard"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <Trophy className="w-3.5 h-3.5" aria-hidden="true" />
              Leaderboard ({leaderboard.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("breakdown")}
              className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-colors ${
                activeTab === "breakdown"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              Score Metrics
            </button>
          </div>

          {activeTab === "routine" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <p>Full weekly commitment schedule across all challenge days:</p>
                {isCreator && !routineLocked && onEditRoutine && (
                  <button
                    type="button"
                    onClick={() => onEditRoutine(challenge)}
                    className="text-xs font-semibold text-primary hover:text-primary-hover flex items-center gap-1"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
                    Edit Routine
                  </button>
                )}
                {routineLocked && (
                  <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                    <Lock className="w-3 h-3 text-muted-foreground" aria-hidden="true" />
                    Routine Locked (fair competition)
                  </span>
                )}
              </div>

              <div className="space-y-3">
                {routineByDay.map(({ dayName, blocks }) => (
                  <div
                    key={dayName}
                    className="border border-border rounded-xl overflow-hidden bg-surface"
                  >
                    <div className="px-3.5 py-2 bg-surface-elevated border-b border-border flex items-center justify-between text-xs">
                      <span className="font-bold text-foreground">{dayName}</span>
                      <span className="text-[11px] text-muted-foreground font-medium">
                        {blocks.length === 0
                          ? "Rest day"
                          : `${blocks.length} scheduled block${blocks.length > 1 ? "s" : ""}`}
                      </span>
                    </div>

                    <div className="p-2 divide-y divide-border/60">
                      {blocks.length === 0 ? (
                        <p className="text-xs text-muted-foreground/60 italic px-2 py-1.5">
                          No routine blocks scheduled.
                        </p>
                      ) : (
                        blocks.map((block) => {
                          const blockCatMeta = getCategoryMeta(block.category);
                          return (
                            <div
                              key={block.id}
                              className="p-2 flex items-center justify-between hover:bg-muted/40 rounded-lg transition-colors"
                            >
                              <div className="flex items-center gap-2.5 min-w-0 pr-2">
                                <button
                                  type="button"
                                  aria-label="Toggle completed"
                                  className="text-muted-foreground"
                                >
                                  <Circle
                                    className="w-4 h-4 text-muted-foreground"
                                    aria-hidden="true"
                                  />
                                </button>
                                <div className="min-w-0">
                                  <span className="text-xs font-semibold text-foreground">
                                    {block.title}
                                  </span>
                                  <div className="text-[10px] text-muted-foreground flex items-center gap-1.5 font-mono">
                                    <Clock
                                      className="w-2.5 h-2.5 text-muted-foreground"
                                      aria-hidden="true"
                                    />
                                    {block.start} - {block.end}
                                    <span>•</span>
                                    <span className={blockCatMeta.textClass}>{block.category}</span>
                                  </div>
                                </div>
                              </div>

                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded border bg-muted text-muted-foreground border-border">
                                Planned
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "leaderboard" && (
            <ChallengeLeaderboard members={leaderboard} challengeName={name} />
          )}

          {activeTab === "breakdown" && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-surface-elevated/60 border border-border">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                  Scoring Formula Breakdown
                </h4>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-xs font-semibold mb-1">
                      <span className="text-foreground">Completion Rate (Routine execution)</span>
                      <span className="font-mono text-primary">{completion ?? 0}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${completion ?? 0}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-semibold mb-1">
                      <span className="text-foreground">
                        Consistency Score (Frequency & Streak)
                      </span>
                      <span className="font-mono text-primary">{consistency ?? 0}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${consistency ?? 0}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-semibold mb-1">
                      <span className="text-foreground">
                        Participation Index (Community & Logs)
                      </span>
                      <span className="font-mono text-primary">{participation ?? 0}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-primary/70 rounded-full"
                        style={{ width: `${participation ?? 0}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="text-xs text-muted-foreground leading-relaxed bg-surface-elevated/40 p-3 rounded-lg border border-border">
                <strong>Platform Scoring Principle:</strong> Scores are calculated deterministically
                on the backend based on routine adherence, verified timestamped check-ins, and
                consistent streak velocity.
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-border bg-surface-elevated/70 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-4 py-2.5 rounded-xl border border-border hover:bg-muted text-foreground font-semibold text-xs transition-colors"
          >
            Close View
          </button>

          {!joined && isUpcoming ? (
            <button
              type="button"
              onClick={() => {
                onJoinChallenge?.(id);
                onClose();
              }}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-primary-foreground font-bold text-xs tracking-wide shadow-xs transition-colors flex items-center gap-2"
            >
              <span>Join Challenge Now</span>
              <ArrowRight className="w-4 h-4 text-primary-foreground" aria-hidden="true" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-primary-foreground font-bold text-xs tracking-wide shadow-xs transition-colors flex items-center gap-2"
            >
              <span>{isFinal ? "Done Reviewing" : "Continue Tracking"}</span>
              <Check className="w-4 h-4 text-primary-foreground" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

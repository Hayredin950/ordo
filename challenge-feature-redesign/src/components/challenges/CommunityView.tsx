import React, { useState } from 'react';
import { ChallengeCardModel, ChallengeRoutineBlock } from '../../types';
import { ChallengeCard } from './ChallengeCard';
import { ChallengeDetail } from './ChallengeDetail';
import { ChallengeRoutineEditor } from './ChallengeRoutineEditor';
import { CreateChallengeWizard } from './CreateChallengeWizard';
import { 
  Plus, 
  Smartphone, 
  Monitor, 
  RotateCcw, 
  Search,
  Trophy,
  Inbox
} from 'lucide-react';

interface CommunityViewProps {
  initialChallenges: ChallengeCardModel[];
}

export const CommunityView: React.FC<CommunityViewProps> = ({ initialChallenges }) => {
  const [challenges, setChallenges] = useState<ChallengeCardModel[]>(initialChallenges);
  const [filter, setFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'web' | 'mobile'>('web');
  
  // Modals
  const [selectedChallenge, setSelectedChallenge] = useState<ChallengeCardModel | null>(null);
  const [editingChallenge, setEditingChallenge] = useState<ChallengeCardModel | null>(null);
  const [isWizardOpen, setIsWizardOpen] = useState(false);

  // State Simulations
  const [simulatedState, setSimulatedState] = useState<'NORMAL' | 'LOADING' | 'ERROR' | 'EMPTY'>('NORMAL');

  // Interactive task toggle for today's routine block
  const handleToggleBlock = (challengeId: string, blockId: string) => {
    setChallenges((prev) =>
      prev.map((ch) => {
        if (ch.id !== challengeId) return ch;

        const updatedToday = ch.todayBlocks.map((b) =>
          b.id === blockId ? { ...b, completed: !b.completed } : b
        );

        const updatedWeekly = ch.allWeeklyRoutine.map((b) =>
          b.id === blockId ? { ...b, completed: !b.completed } : b
        );

        // Compute simulated score adjustment (+1.5 per completed block)
        const newScore = ch.score !== null ? Math.min(100, Math.max(0, ch.score + (updatedToday.find(b => b.id === blockId)?.completed ? 1.5 : -1.5))) : null;

        const updatedModel: ChallengeCardModel = {
          ...ch,
          todayBlocks: updatedToday,
          allWeeklyRoutine: updatedWeekly,
          score: newScore ? Number(newScore.toFixed(1)) : null,
          completion: Math.min(100, (ch.completion || 80) + 2),
        };

        if (selectedChallenge?.id === challengeId) {
          setSelectedChallenge(updatedModel);
        }

        return updatedModel;
      })
    );
  };

  // Routine update from routine editor
  const handleSaveRoutine = (challengeId: string, updatedRoutine: ChallengeRoutineBlock[]) => {
    setChallenges((prev) =>
      prev.map((ch) => {
        if (ch.id !== challengeId) return ch;
        return {
          ...ch,
          allWeeklyRoutine: updatedRoutine,
        };
      })
    );
  };

  // Simulate member join (locks routine)
  const handleSimulateMemberJoin = (challengeId: string) => {
    setChallenges((prev) =>
      prev.map((ch) => {
        if (ch.id !== challengeId) return ch;
        return {
          ...ch,
          memberCount: ch.memberCount + 1,
          routineLocked: true,
        };
      })
    );
    if (editingChallenge?.id === challengeId) {
      setEditingChallenge((prev) => (prev ? { ...prev, memberCount: prev.memberCount + 1, routineLocked: true } : null));
    }
    if (selectedChallenge?.id === challengeId) {
      setSelectedChallenge((prev) => (prev ? { ...prev, memberCount: prev.memberCount + 1, routineLocked: true } : null));
    }
  };

  // Join a challenge
  const handleJoinChallenge = (challengeId: string) => {
    setChallenges((prev) =>
      prev.map((ch) => {
        if (ch.id !== challengeId) return ch;
        return {
          ...ch,
          joined: true,
          memberCount: ch.memberCount + 1,
          routineLocked: true, // First participant joins locks it
        };
      })
    );
  };

  // Create challenge from wizard
  const handleCreateChallenge = (newChallenge: ChallengeCardModel) => {
    setChallenges((prev) => [newChallenge, ...prev]);
  };

  const handleResetData = () => {
    setChallenges(initialChallenges);
    setSimulatedState('NORMAL');
    setFilter('ALL');
    setSearchQuery('');
  };

  // Filter logic
  const filteredChallenges = challenges.filter((c) => {
    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matches = c.name.toLowerCase().includes(q) || c.category.toLowerCase().includes(q);
      if (!matches) return false;
    }

    if (filter === 'ALL') return true;
    if (filter === 'ACTIVE') return c.status === 'ACTIVE';
    if (filter === 'UPCOMING') return c.status === 'UPCOMING';
    if (filter === 'FINALIZED') return c.status === 'FINALIZED' || c.status === 'COMPLETED';
    if (filter === 'CREATOR') return c.isCreator;
    if (filter === 'LOCKED') return c.routineLocked;
    if (filter === 'UNLOCKED') return !c.routineLocked && c.isCreator;
    return true;
  });

  return (
    <div className="min-h-screen bg-background text-foreground pb-16">
      {/* Top Navigation Bar */}
      <header className="bg-surface border-b border-border sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/30 text-primary flex items-center justify-center font-extrabold shadow-xs">
              <Trophy className="w-5 h-5 text-primary" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold text-foreground text-base tracking-tight leading-none">
                  Challenge Hub
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary border border-primary/25">
                  Dark Theme
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Standardized card hierarchy · Routine locking · Amber primary + navy surfaces
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Device Preview Toggle */}
            <div className="hidden sm:flex items-center p-1 rounded-xl bg-surface-elevated border border-border text-xs font-semibold">
              <button
                type="button"
                id="view-mode-web"
                onClick={() => setViewMode('web')}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors ${
                  viewMode === 'web'
                    ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Monitor className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Web Grid</span>
              </button>
              <button
                type="button"
                id="view-mode-mobile"
                onClick={() => setViewMode('mobile')}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors ${
                  viewMode === 'mobile'
                    ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Mobile Shell</span>
              </button>
            </div>

            {/* Create Challenge Button */}
            <button
              type="button"
              id="btn-create-challenge"
              onClick={() => setIsWizardOpen(true)}
              className="min-h-[40px] px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover active:bg-amber-600 text-primary-foreground font-bold text-xs tracking-wide shadow-xs flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span>Create Challenge</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* Design Goal Principle Callout Banner */}
        <div className="p-4 rounded-2xl bg-surface border border-border shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
              Core Design Objective
            </span>
            <p className="text-sm font-semibold text-foreground">
              &ldquo;What is my current standing in this challenge, and what do I need to do next?&rdquo;
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-muted-foreground font-medium">
              <span className="bg-surface-elevated border border-border px-2 py-0.5 rounded">1. Identity</span>
              <span className="bg-surface-elevated border border-border px-2 py-0.5 rounded">2. Explicit Status</span>
              <span className="bg-surface-elevated border border-border px-2 py-0.5 rounded">3. Focused Score</span>
              <span className="bg-surface-elevated border border-border px-2 py-0.5 rounded">4. Standing Rank</span>
              <span className="bg-surface-elevated border border-border px-2 py-0.5 rounded">5. Next Immediate Action</span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleResetData}
              className="px-3 py-1.5 rounded-lg border border-border hover:bg-muted text-xs font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors"
              title="Reset data back to default mocks"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Reset State</span>
            </button>
          </div>
        </div>

        {/* Filter Controls & State Simulators Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-surface p-3 rounded-2xl border border-border shadow-xs">
          {/* Status Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
            {[
              { id: 'ALL', label: 'All' },
              { id: 'ACTIVE', label: '● Active' },
              { id: 'UPCOMING', label: '● Upcoming' },
              { id: 'FINALIZED', label: '🏆 Finalized' },
              { id: 'CREATOR', label: 'My Challenges' },
              { id: 'UNLOCKED', label: 'Editable Routine' },
              { id: 'LOCKED', label: '🔒 Locked' },
            ].map((tab) => (
              <button
                type="button"
                key={tab.id}
                id={`filter-${tab.id.toLowerCase()}`}
                onClick={() => {
                  setFilter(tab.id);
                  setSimulatedState('NORMAL');
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                  filter === tab.id && simulatedState === 'NORMAL'
                    ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                    : 'bg-surface-elevated hover:bg-muted text-muted-foreground hover:text-foreground border border-border'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search & State Simulators */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 sm:w-48">
              <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search challenges..."
                className="w-full text-xs pl-8 pr-3 py-1.5 rounded-xl border border-border bg-surface-elevated text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* Simulated States Toggle */}
            <div className="flex items-center gap-1 bg-surface-elevated p-1 rounded-xl text-[11px] font-semibold text-muted-foreground border border-border">
              <span className="px-1.5 text-muted-foreground font-bold uppercase text-[10px]">Test States:</span>
              <button
                type="button"
                onClick={() => setSimulatedState('LOADING')}
                className={`px-2 py-1 rounded-lg transition-colors ${
                  simulatedState === 'LOADING' ? 'bg-primary text-primary-foreground font-bold shadow-xs' : 'hover:text-foreground'
                }`}
              >
                Skeleton
              </button>
              <button
                type="button"
                onClick={() => setSimulatedState('ERROR')}
                className={`px-2 py-1 rounded-lg transition-colors ${
                  simulatedState === 'ERROR' ? 'bg-destructive/20 text-destructive font-bold' : 'hover:text-foreground'
                }`}
              >
                Error
              </button>
              <button
                type="button"
                onClick={() => setSimulatedState('EMPTY')}
                className={`px-2 py-1 rounded-lg transition-colors ${
                  simulatedState === 'EMPTY' ? 'bg-primary text-primary-foreground font-bold shadow-xs' : 'hover:text-foreground'
                }`}
              >
                Empty
              </button>
            </div>
          </div>
        </div>

        {/* Section: Challenge Cards Presentation */}
        {viewMode === 'mobile' ? (
          /* Mobile Shell Preview View */
          <div className="flex flex-col items-center justify-center py-4">
            <div className="w-full max-w-[400px] bg-surface-elevated p-4 rounded-[44px] shadow-2xl border-4 border-border">
              {/* Phone Speaker & Notch */}
              <div className="w-28 h-4 bg-surface rounded-full mx-auto mb-3 flex items-center justify-center border border-border">
                <div className="w-3 h-3 rounded-full bg-background mr-2" />
                <div className="w-12 h-1.5 bg-background rounded-full" />
              </div>

              {/* Mobile Viewport Screen */}
              <div className="bg-background rounded-[32px] p-3.5 max-h-[720px] overflow-y-auto space-y-4 border border-border/80">
                <div className="flex items-center justify-between pb-2 border-b border-border">
                  <span className="text-xs font-bold text-foreground">Challenges</span>
                  <span className="text-[10px] text-primary font-semibold font-['JetBrains_Mono',monospace]">
                    {filteredChallenges.length} Active
                  </span>
                </div>

                {simulatedState === 'LOADING' ? (
                  <ChallengeCard isLoading={true} />
                ) : simulatedState === 'ERROR' ? (
                  <ChallengeCard 
                    isError={true} 
                    errorMessage="Unable to load challenge standings due to a temporary network synchronization failure." 
                    onRetry={() => setSimulatedState('NORMAL')}
                  />
                ) : simulatedState === 'EMPTY' || filteredChallenges.length === 0 ? (
                  <div className="text-center py-12 px-4 bg-surface rounded-2xl border border-dashed border-border text-muted-foreground">
                    <Inbox className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <h3 className="text-xs font-bold text-foreground">No challenges found</h3>
                    <p className="text-[11px] text-muted-foreground mt-1">Create your first challenge to get started.</p>
                    <button
                      type="button"
                      onClick={() => setIsWizardOpen(true)}
                      className="mt-3 px-3.5 py-2 bg-primary text-primary-foreground font-bold rounded-xl text-xs shadow-xs"
                    >
                      Create Challenge
                    </button>
                  </div>
                ) : (
                  filteredChallenges.map((challenge) => (
                    <ChallengeCard
                      key={challenge.id}
                      challenge={challenge}
                      onSelect={(c) => setSelectedChallenge(c)}
                      onToggleTodayBlock={handleToggleBlock}
                      onOpenLeaderboard={(c) => setSelectedChallenge(c)}
                      onEditRoutine={(c) => setEditingChallenge(c)}
                    />
                  ))
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Mobile Preview: 44dp minimum touch targets, dark navy surfaces, and amber accents.
            </p>
          </div>
        ) : (
          /* Web Responsive Grid Layout */
          <div>
            {simulatedState === 'LOADING' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                <ChallengeCard isLoading={true} />
                <ChallengeCard isLoading={true} />
                <ChallengeCard isLoading={true} />
              </div>
            ) : simulatedState === 'ERROR' ? (
              <div className="max-w-md mx-auto py-8">
                <ChallengeCard
                  isError={true}
                  errorMessage="This routine is now locked because another member joined. (Translated from locked_at constraint violation)"
                  onRetry={() => setSimulatedState('NORMAL')}
                />
              </div>
            ) : simulatedState === 'EMPTY' || filteredChallenges.length === 0 ? (
              <div className="text-center py-16 px-4 bg-surface rounded-2xl border border-dashed border-border max-w-lg mx-auto space-y-3">
                <div className="w-12 h-12 rounded-full bg-surface-elevated text-primary border border-border flex items-center justify-center mx-auto">
                  <Inbox className="w-6 h-6 text-primary" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">No challenges matching your criteria</h3>
                  <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                    Start a new community challenge or adjust your filters to view active, upcoming, or completed sprints.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsWizardOpen(true)}
                  className="min-h-[44px] px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover active:bg-amber-600 text-primary-foreground font-bold text-xs shadow-xs inline-flex items-center gap-2 transition-colors"
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
                    onToggleTodayBlock={handleToggleBlock}
                    onOpenLeaderboard={(c) => setSelectedChallenge(c)}
                    onEditRoutine={(c) => setEditingChallenge(c)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Expanded Challenge Detail Modal */}
      {selectedChallenge && (
        <ChallengeDetail
          challenge={selectedChallenge}
          onClose={() => setSelectedChallenge(null)}
          onToggleBlock={handleToggleBlock}
          onJoinChallenge={handleJoinChallenge}
          onEditRoutine={(c) => {
            setSelectedChallenge(null);
            setEditingChallenge(c);
          }}
        />
      )}

      {/* Routine Editor Modal (Locked vs Editable) */}
      {editingChallenge && (
        <ChallengeRoutineEditor
          challenge={editingChallenge}
          onClose={() => setEditingChallenge(null)}
          onSaveRoutine={handleSaveRoutine}
          onSimulateMemberJoin={handleSimulateMemberJoin}
        />
      )}

      {/* 3-Step Creation Wizard Modal */}
      {isWizardOpen && (
        <CreateChallengeWizard
          onClose={() => setIsWizardOpen(false)}
          onCreateChallenge={handleCreateChallenge}
          onOpenCardDetail={(c) => setSelectedChallenge(c)}
        />
      )}
    </div>
  );
};

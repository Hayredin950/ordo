import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../models/ordo_state.dart';
import '../services/state_provider.dart';
import '../services/auth_provider.dart';
import '../utils/ordo.dart';
import '../widgets/app_widgets.dart';
import '../themes/app_theme.dart';

class TodayScreen extends StatelessWidget {
  final VoidCallback? onLoginRequired;

  const TodayScreen({super.key, this.onLoginRequired});

  @override
  Widget build(BuildContext context) {
    return Consumer<OrdoProvider>(
      builder: (context, prov, _) {
        final state = prov.state;
        if (state == null) return const Center(child: CircularProgressIndicator());
        final today = DateTime.now();
        final blocks = blocksFor(state, today);
        final score = dayScore(state, today);
        final entries = state.log[dateKey(today)] ?? {};
        return RefreshIndicator(
          onRefresh: () async {
            await Future.delayed(const Duration(milliseconds: 300));
          },
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      DateFormat('EEEE, MMMM d').format(today),
                      style: const TextStyle(
                          fontFamily: 'SpaceGrotesk',
                          fontSize: 24,
                          fontWeight: FontWeight.w700),
                    ),
                    Row(
                      children: [
                        const Icon(Icons.star, color: OrdoColors.primary, size: 20),
                        const SizedBox(width: 4),
                        Text('$score', style: const TextStyle(
                            fontFamily: 'SpaceGrotesk',
                            fontSize: 20,
                            fontWeight: FontWeight.w700)),
                      ],
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                _StreakCard(),
                const SizedBox(height: 16),
                PanelTitle(title: 'Blocks', hint: '${blocks.length} tasks today'),
                const SizedBox(height: 8),
                if (blocks.isEmpty)
                  Panel(
                    child: Center(
                      child: Padding(
                        padding: const EdgeInsets.all(24),
                        child: Text(
                          'No blocks for today.\nAdd blocks in the Routine tab.',
                          textAlign: TextAlign.center,
                          style: TextStyle(color: OrdoColors.mutedForeground),
                        ),
                      ),
                    ),
                  )
                else
                  ...blocks.map((b) => _BlockTile(
                    block: b,
                    score: entries[b.id] ?? 0,
                    onLoginRequired: onLoginRequired,
                  )),
                const SizedBox(height: 16),
                _JournalSection(onLoginRequired: onLoginRequired),
                const SizedBox(height: 16),
                const _AnnouncementBanner(),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _StreakCard extends StatelessWidget {
  const _StreakCard();

  @override
  Widget build(BuildContext context) {
    return Consumer<OrdoProvider>(
      builder: (context, prov, _) {
        final state = prov.state;
        if (state == null) return const SizedBox.shrink();
        final s = streak(state);
        return Panel(
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              Stat(value: '${s.current}', label: 'Current Streak'),
              Stat(value: '${s.best}', label: 'Best Streak'),
              Stat(value: '${_completedToday(prov.state)}', label: 'Completed'),
            ],
          ),
        );
      },
    );
  }
}

int _completedToday(OrdoState? state) {
  if (state == null) return 0;
  final today = DateTime.now();
  final entries = state.log[dateKey(today)] ?? {};
  return entries.values.where((v) => v >= 100).length;
}

class _BlockTile extends StatelessWidget {
  final Block block;
  final int score;
  final VoidCallback? onLoginRequired;

  const _BlockTile({required this.block, required this.score, this.onLoginRequired});

  @override
  Widget build(BuildContext context) {
    return Panel(
      margin: const EdgeInsets.only(bottom: 8),
      onTap: () => _showScoreSheet(context),
      child: Row(
        children: [
          CategoryDot(id: block.category),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(block.title,
                    style: const TextStyle(
                        fontWeight: FontWeight.w600, color: OrdoColors.foreground)),
                Text(formatTimeRange(block.start, block.end),
                    style: TextStyle(fontSize: 12, color: OrdoColors.mutedForeground)),
              ],
            ),
          ),
          _ScoreChip(score: score),
        ],
      ),
    );
  }

  void _showScoreSheet(BuildContext context) {
    if (!context.read<AuthProvider>().isLoggedIn) {
      onLoginRequired?.call();
      return;
    }
    int tempScore = score;
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: OrdoColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setSheetState) {
            return Padding(
              padding: const EdgeInsets.fromLTRB(24, 24, 24, 40),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(
                        child: Text(block.title,
                            style: const TextStyle(
                                fontFamily: 'SpaceGrotesk',
                                fontSize: 18,
                                fontWeight: FontWeight.w700,
                                color: OrdoColors.foreground)),
                      ),
                      IconButton(
                        icon: Icon(Icons.close, color: OrdoColors.mutedForeground),
                        onPressed: () => Navigator.pop(ctx),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(formatTimeRange(block.start, block.end),
                      style: TextStyle(fontSize: 13, color: OrdoColors.mutedForeground)),
                  const SizedBox(height: 24),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      _ScoreButton(
                        icon: Icons.cancel_outlined,
                        label: 'Missed',
                        color: OrdoColors.mutedForeground,
                        active: tempScore == 0,
                        onTap: () => setSheetState(() => tempScore = 0),
                      ),
                      const SizedBox(width: 12),
                      _ScoreButton(
                        icon: Icons.hourglass_top,
                        label: 'Partial',
                        color: OrdoColors.primary,
                        active: tempScore > 0 && tempScore < 100,
                        onTap: () => setSheetState(() => tempScore = 50),
                      ),
                      const SizedBox(width: 12),
                      _ScoreButton(
                        icon: Icons.check_circle_outline,
                        label: 'Done',
                        color: Colors.green,
                        active: tempScore >= 100,
                        onTap: () => setSheetState(() => tempScore = 100),
                      ),
                    ],
                  ),
                  const SizedBox(height: 20),
                  Row(
                    children: [
                      Text('0', style: TextStyle(color: OrdoColors.mutedForeground, fontSize: 12)),
                      Expanded(
                        child: Slider(
                          value: tempScore.toDouble(),
                          min: 0,
                          max: 100,
                          divisions: 20,
                          activeColor: OrdoColors.primary,
                          inactiveColor: OrdoColors.border,
                          onChanged: (v) => setSheetState(() => tempScore = v.round()),
                        ),
                      ),
                      Text('100', style: TextStyle(color: OrdoColors.mutedForeground, fontSize: 12)),
                    ],
                  ),
                  Text(
                    '$tempScore%',
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                        fontFamily: 'SpaceGrotesk',
                        fontSize: 32,
                        fontWeight: FontWeight.w700,
                        color: OrdoColors.foreground),
                  ),
                  const SizedBox(height: 16),
                  SizedBox(
                    height: 48,
                    child: ElevatedButton(
                      onPressed: () {
                        context.read<OrdoProvider>().update((s) {
                          final todayKey = dateKey(DateTime.now());
                          final log = Map<String, Map<String, int>>.from(s.log);
                          final dayLog = Map<String, int>.from(log[todayKey] ?? {});
                          dayLog[block.id] = tempScore;
                          log[todayKey] = dayLog;
                          return s.copyWith(log: log);
                        });
                        Navigator.pop(ctx);
                      },
                      child: const Text('Save'),
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }
}

class _ScoreButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final bool active;
  final VoidCallback onTap;

  const _ScoreButton({
    required this.icon,
    required this.label,
    required this.color,
    required this.active,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        decoration: BoxDecoration(
          color: active ? color.withValues(alpha: 0.2) : OrdoColors.card,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: active ? color : OrdoColors.border,
            width: active ? 2 : 1,
          ),
        ),
        child: Column(
          children: [
            Icon(icon, color: active ? color : OrdoColors.mutedForeground, size: 24),
            const SizedBox(height: 4),
            Text(label, style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w500,
              color: active ? color : OrdoColors.mutedForeground,
            )),
          ],
        ),
      ),
    );
  }
}

class _ScoreChip extends StatelessWidget {
  final int score;

  const _ScoreChip({required this.score});

  @override
  Widget build(BuildContext context) {
    if (score >= 100) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(
          color: Colors.green.withValues(alpha: 0.15),
          borderRadius: BorderRadius.circular(999),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.check_circle, color: Colors.green, size: 16),
            const SizedBox(width: 4),
            Text('Done', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Colors.green)),
          ],
        ),
      );
    }
    if (score > 0) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(
          color: OrdoColors.primary.withValues(alpha: 0.15),
          borderRadius: BorderRadius.circular(999),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.hourglass_top, color: OrdoColors.primary, size: 16),
            const SizedBox(width: 4),
            Text('$score%', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: OrdoColors.primary)),
          ],
        ),
      );
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: OrdoColors.mutedForeground.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.cancel_outlined, color: OrdoColors.mutedForeground, size: 16),
          const SizedBox(width: 4),
          Text('Missed', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w500, color: OrdoColors.mutedForeground)),
        ],
      ),
    );
  }
}

class _JournalSection extends StatelessWidget {
  final VoidCallback? onLoginRequired;

  const _JournalSection({this.onLoginRequired});

  @override
  Widget build(BuildContext context) {
    return Consumer<OrdoProvider>(
      builder: (context, prov, _) {
        final state = prov.state;
        if (state == null) return const SizedBox.shrink();
        final todayKey = dateKey(DateTime.now());
        final existing = state.journal[todayKey] ?? '';
        return Panel(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Journal',
                      style: TextStyle(
                          fontFamily: 'SpaceGrotesk',
                          fontSize: 18,
                          fontWeight: FontWeight.w600,
                          color: OrdoColors.foreground)),
                  Icon(Icons.edit, color: OrdoColors.mutedForeground, size: 18),
                ],
              ),
              const SizedBox(height: 8),
              GestureDetector(
                onTap: () {
                  if (!context.read<AuthProvider>().isLoggedIn) {
                    onLoginRequired?.call();
                    return;
                  }
                  _openJournal(context, prov, existing);
                },
                child: existing.isEmpty
                    ? Text(
                        'Tap to write a journal entry for today...',
                        style: TextStyle(
                            color: OrdoColors.mutedForeground,
                            fontStyle: FontStyle.italic),
                      )
                    : Text(
                        existing,
                        maxLines: 4,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(color: OrdoColors.foreground, fontSize: 14),
                      ),
              ),
            ],
          ),
        );
      },
    );
  }

  void _openJournal(BuildContext context, OrdoProvider prov, String existing) {
    final ctrl = TextEditingController(text: existing);
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: OrdoColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return Padding(
          padding: EdgeInsets.fromLTRB(24, 24, 24, MediaQuery.of(ctx).viewInsets.bottom + 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text('Journal',
                  style: TextStyle(
                      fontFamily: 'SpaceGrotesk',
                      fontSize: 20,
                      fontWeight: FontWeight.w700)),
              const SizedBox(height: 4),
              Text(DateFormat('EEEE, MMMM d').format(DateTime.now()),
                  style: TextStyle(fontSize: 13, color: OrdoColors.mutedForeground)),
              const SizedBox(height: 16),
              TextField(
                controller: ctrl,
                maxLines: 8,
                autofocus: true,
                decoration: InputDecoration(
                  hintText: 'How did today go? What did you learn?',
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
              const SizedBox(height: 16),
              SizedBox(
                height: 48,
                child: ElevatedButton(
                  onPressed: () {
                    prov.update((s) {
                      final journal = Map<String, String>.from(s.journal);
                      if (ctrl.text.trim().isEmpty) {
                        journal.remove(dateKey(DateTime.now()));
                      } else {
                        journal[dateKey(DateTime.now())] = ctrl.text.trim();
                      }
                      return s.copyWith(journal: journal);
                    });
                    Navigator.pop(ctx);
                  },
                  child: const Text('Save'),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _AnnouncementBanner extends StatelessWidget {
  const _AnnouncementBanner();

  @override
  Widget build(BuildContext context) {
    return Panel(
      color: OrdoColors.accent,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Welcome to Ordo!',
              style: TextStyle(
                  fontFamily: 'SpaceGrotesk',
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                  color: OrdoColors.foreground)),
          const SizedBox(height: 4),
          Text('Track your habits, hit your goals, and build discipline one day at a time.',
              style: TextStyle(color: OrdoColors.secondaryForeground)),
        ],
      ),
    );
  }
}

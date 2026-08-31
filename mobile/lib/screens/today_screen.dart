import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../models/ordo_state.dart';
import '../services/state_provider.dart';
import '../services/auth_provider.dart';
import '../utils/ordo.dart';
import '../widgets/app_widgets.dart';
import '../widgets/focus_timer.dart';
import '../themes/app_theme.dart';

const _steps = [0, 25, 50, 75, 100];

class TodayScreen extends StatefulWidget {
  final VoidCallback? onLoginRequired;

  const TodayScreen({super.key, this.onLoginRequired});

  @override
  State<TodayScreen> createState() => _TodayScreenState();
}

class _TodayScreenState extends State<TodayScreen> {
  int _offset = 0;

  DateTime get _day => addDays(DateTime.now(), _offset);


  @override
  Widget build(BuildContext context) {
    return Consumer<OrdoProvider>(
      builder: (context, prov, _) {
        final state = prov.state;
        if (state == null) return const Center(child: CircularProgressIndicator());
        final key = dateKey(_day);
        final blocks = blocksFor(state, _day);
        final entries = state.log[key] ?? {};
        final score = dayScore(state, _day);
        final s = streak(state);
        final debt = missedDebt(state);
        final completed = entries.values.where((v) => v >= 100).length;

        return RefreshIndicator(
          onRefresh: () async => Future.delayed(const Duration(milliseconds: 300)),
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // ── Day header with navigation ──
                _DayHeader(
                  day: _day,
                  blockCount: blocks.length,
                  hasOverride: state.overrides.containsKey(key),
                  onPrev: () => setState(() => _offset--),
                  onToday: () => setState(() => _offset = 0),
                  onNext: () => setState(() => _offset++),
                ),
                const SizedBox(height: 16),

                // ── Streak + score ring ──
                _StreakAndScore(score: score, streak: s),
                const SizedBox(height: 16),

                // ── Stats: blocks cleared + missed-task debt ──
                Row(
                  children: [
                    Expanded(child: Stat(value: '$completed/${blocks.length}', label: 'Blocks cleared')),
                    const SizedBox(width: 8),
                    Expanded(child: Stat(value: '${debt.length}', label: 'Missed-task debt')),
                  ],
                ),
                const SizedBox(height: 16),

                // ── Blocks with inline 5-step scoring ──
                PanelTitle(title: 'Blocks', hint: '${blocks.length} time blocks planned'),
                const SizedBox(height: 8),
                if (blocks.isEmpty)
                  Panel(
                    child: Center(
                      child: Padding(
                        padding: const EdgeInsets.all(24),
                        child: Text(
                          'Nothing scheduled.\nBuild a routine in the Routine tab.',
                          textAlign: TextAlign.center,
                          style: TextStyle(color: OrdoColors.mutedForeground),
                        ),
                      ),
                    ),
                  )
                else
                  ...blocks.map((b) => _BlockTile(
                    block: b,
                    pct: entries[b.id] ?? 0,
                    onLoginRequired: widget.onLoginRequired,
                  )),
                const SizedBox(height: 16),

                // ── Debt & catch-up ──
                _DebtAndCatchUp(debt: debt),
                const SizedBox(height: 16),

                // ── Journal / Reflection ──
                _JournalSection(onLoginRequired: widget.onLoginRequired),
                const SizedBox(height: 16),

                // ── Notification channels ──
                _NotificationChannels(onLoginRequired: widget.onLoginRequired),
                const SizedBox(height: 16),

                // ── Focus timer ──
                const FocusTimer(),
                const SizedBox(height: 16),
              ],
            ),
          ),
        );
      },
    );
  }
}

// ─── Day Header ────────────────────────────────────────────────────────

class _DayHeader extends StatelessWidget {
  final DateTime day;
  final int blockCount;
  final bool hasOverride;
  final VoidCallback onPrev;
  final VoidCallback onToday;
  final VoidCallback onNext;

  const _DayHeader({
    required this.day,
    required this.blockCount,
    required this.hasOverride,
    required this.onPrev,
    required this.onToday,
    required this.onNext,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          DateFormat('EEEE, MMM d').format(day),
          style: const TextStyle(
            fontFamily: 'SpaceGrotesk',
            fontSize: 24,
            fontWeight: FontWeight.w700,
            color: OrdoColors.foreground,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          '$blockCount blocks${hasOverride ? ' · custom day' : ''}',
          style: TextStyle(fontSize: 13, color: OrdoColors.mutedForeground),
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            _NavButton(icon: Icons.chevron_left, onTap: onPrev, label: 'Previous day'),
            const SizedBox(width: 8),
            _NavButton(icon: Icons.chevron_right, onTap: onNext, label: 'Next day'),
            const Spacer(),
            _TextButton(label: 'Today', onTap: onToday),
          ],
        ),
      ],
    );
  }
}

class _NavButton extends StatelessWidget {
  final IconData icon;
  final VoidCallback onTap;
  final String label;

  const _NavButton({required this.icon, required this.onTap, required this.label});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(
          color: OrdoColors.card,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: OrdoColors.border),
        ),
        child: Icon(icon, size: 20, color: OrdoColors.mutedForeground),
      ),
    );
  }
}

class _TextButton extends StatelessWidget {
  final String label;
  final VoidCallback onTap;

  const _TextButton({required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: OrdoColors.card,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: OrdoColors.border),
        ),
        child: Text(label, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: OrdoColors.mutedForeground)),
      ),
    );
  }
}

// ─── Streak + Score Ring ───────────────────────────────────────────────

class _StreakAndScore extends StatelessWidget {
  final int score;
  final Streak streak;

  const _StreakAndScore({required this.score, required this.streak});

  @override
  Widget build(BuildContext context) {
    return Panel(
      child: Row(
        children: [
          ProgressRing(
            value: score.toDouble().clamp(0, 100),
            label: 'today',
            size: 80,
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(Icons.local_fire_department, color: OrdoColors.primary, size: 18),
                    const SizedBox(width: 6),
                    Text(
                      '${streak.current}-day streak',
                      style: const TextStyle(
                        fontFamily: 'SpaceGrotesk',
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                        color: OrdoColors.foreground,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text('Best ever: ${streak.best} days',
                    style: TextStyle(fontSize: 13, color: OrdoColors.mutedForeground)),
                const SizedBox(height: 2),
                Text('Counted when a day closes above 70%.',
                    style: TextStyle(fontSize: 11, color: OrdoColors.mutedForeground)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Block Tile with Inline 5-Step Scoring ─────────────────────────────

class _BlockTile extends StatelessWidget {
  final Block block;
  final int pct;
  final VoidCallback? onLoginRequired;

  const _BlockTile({
    required this.block,
    required this.pct,
    this.onLoginRequired,
  });

  @override
  Widget build(BuildContext context) {
    final done = pct >= 100;
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: done ? OrdoColors.primary.withValues(alpha: 0.05) : OrdoColors.card,
        border: Border.all(
          color: done ? OrdoColors.primary.withValues(alpha: 0.3) : OrdoColors.border,
        ),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Time range
          Text(formatTimeRange(block.start, block.end),
              style: TextStyle(fontSize: 13, color: OrdoColors.mutedForeground)),
          const SizedBox(height: 6),
          // Title + must badge
          Row(
            children: [
              Text(
                block.title,
                style: TextStyle(
                  decoration: done ? TextDecoration.lineThrough : null,
                  decorationColor: OrdoColors.mutedForeground,
                  fontWeight: FontWeight.w600,
                  fontSize: 15,
                  color: OrdoColors.foreground,
                ),
              ),
              if (block.priority == 'must') ...[
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: OrdoColors.muted,
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: const Text('MUST',
                      style: TextStyle(fontSize: 9, fontWeight: FontWeight.w600, letterSpacing: 1)),
                ),
              ],
            ],
          ),
          const SizedBox(height: 6),
          // Category pill
          CategoryPill(id: block.category),
          const SizedBox(height: 10),
          // 5-step scoring buttons
          Row(
            children: _steps.map((v) {
              final active = pct == v;
              return Expanded(
                child: GestureDetector(
                  onTap: () {
                    if (!context.read<AuthProvider>().isLoggedIn) {
                      onLoginRequired?.call();
                      return;
                    }
                    context.read<OrdoProvider>().update((s) {
                      final todayKey = dateKey(DateTime.now());
                      final log = Map<String, Map<String, int>>.from(s.log);
                      final dayLog = Map<String, int>.from(log[todayKey] ?? {});
                      dayLog[block.id] = v;
                      log[todayKey] = dayLog;
                      return s.copyWith(log: log);
                    });
                  },
                  child: Container(
                    margin: const EdgeInsets.symmetric(horizontal: 2),
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    decoration: BoxDecoration(
                      color: active ? OrdoColors.primary : OrdoColors.muted,
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      '$v',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: active ? OrdoColors.primaryForeground : OrdoColors.mutedForeground,
                      ),
                    ),
                  ),
                ),
              );
            }).toList(),
          ),
        ],
      ),
    );
  }
}

// ─── Debt & Catch-up ───────────────────────────────────────────────────

class _DebtAndCatchUp extends StatelessWidget {
  final List<Map<String, dynamic>> debt;

  const _DebtAndCatchUp({required this.debt});

  @override
  Widget build(BuildContext context) {
    return Panel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          PanelTitle(title: 'Debt & catch-up', hint: 'Skipped must-do blocks from the last 14 days.'),
          const SizedBox(height: 8),
          if (debt.isEmpty)
            Text('Clean slate. Nothing owed.',
                style: TextStyle(fontSize: 13, color: OrdoColors.mutedForeground))
          else
            ...debt.map((d) {
              final block = d['block'] as Block;
              final date = d['date'] as String;
              return Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Row(
                  children: [
                    const Icon(Icons.warning_amber_rounded, size: 16, color: OrdoColors.primary),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(block.title, style: const TextStyle(fontSize: 13, color: OrdoColors.foreground), overflow: TextOverflow.ellipsis),
                    ),
                    Text(date.substring(5), style: TextStyle(fontSize: 12, color: OrdoColors.mutedForeground)),
                  ],
                ),
              );
            }),
          if (debt.isNotEmpty) ...[
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton(
                onPressed: () {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('Fit ${debt.length} missed block(s) into the next 4 evenings.')),
                  );
                },
                style: OutlinedButton.styleFrom(
                  foregroundColor: OrdoColors.mutedForeground,
                  side: BorderSide(color: OrdoColors.border),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
                child: const Text('Propose a catch-up plan'),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

// ─── Journal Section ───────────────────────────────────────────────────

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
                  const Text('Reflection',
                      style: TextStyle(fontFamily: 'SpaceGrotesk', fontSize: 16, fontWeight: FontWeight.w600, color: OrdoColors.foreground)),
                  Icon(Icons.edit, color: OrdoColors.mutedForeground, size: 18),
                ],
              ),
              Text('One honest line about today — fuels better suggestions.',
                  style: TextStyle(fontSize: 12, color: OrdoColors.mutedForeground)),
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
                        'What worked, what slipped, and why…',
                        style: TextStyle(color: OrdoColors.mutedForeground, fontStyle: FontStyle.italic),
                      )
                    : Text(existing, maxLines: 4, overflow: TextOverflow.ellipsis, style: TextStyle(color: OrdoColors.foreground, fontSize: 14)),
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
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) {
        return Padding(
          padding: EdgeInsets.fromLTRB(24, 24, 24, MediaQuery.of(ctx).viewInsets.bottom + 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text('Reflection', style: TextStyle(fontFamily: 'SpaceGrotesk', fontSize: 20, fontWeight: FontWeight.w700)),
              const SizedBox(height: 4),
              Text(DateFormat('EEEE, MMMM d').format(DateTime.now()), style: TextStyle(fontSize: 13, color: OrdoColors.mutedForeground)),
              const SizedBox(height: 16),
              TextField(
                controller: ctrl,
                maxLines: 8,
                autofocus: true,
                decoration: InputDecoration(
                  hintText: 'What worked, what slipped, and why…',
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

// ─── Notification Channels ─────────────────────────────────────────────

class _NotificationChannels extends StatelessWidget {
  final VoidCallback? onLoginRequired;

  const _NotificationChannels({this.onLoginRequired});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    return Panel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          PanelTitle(
            title: 'Notification channels',
            hint: 'Telegram-first, Slack as a second option — one shared service.',
          ),
          const SizedBox(height: 8),
          if (!auth.isLoggedIn)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Text(
                'Sign in to connect Telegram or Slack.',
                style: TextStyle(fontSize: 13, color: OrdoColors.mutedForeground),
              ),
            )
          else ...[
            // Telegram section
            Text('TELEGRAM',
                style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, letterSpacing: 1, color: OrdoColors.mutedForeground)),
            const SizedBox(height: 8),
            Text(
              'Bot not configured on the server yet. Set TELEGRAM_BOT_TOKEN to activate reminders, nags and check-ins.',
              style: TextStyle(fontSize: 13, color: OrdoColors.mutedForeground),
            ),
            const SizedBox(height: 16),
            Container(height: 1, color: OrdoColors.border),
            const SizedBox(height: 16),

            // Slack section
            Text('SLACK',
                style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, letterSpacing: 1, color: OrdoColors.mutedForeground)),
            const SizedBox(height: 8),
            Text(
              'Slack not configured on the server. Set SLACK_BOT_TOKEN to receive reminders here too.',
              style: TextStyle(fontSize: 13, color: OrdoColors.mutedForeground),
            ),
          ],
        ],
      ),
    );
  }
}

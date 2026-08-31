import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:fl_chart/fl_chart.dart';
import '../models/ordo_state.dart';
import '../services/state_provider.dart';
import '../services/categories_provider.dart';
import '../utils/ordo.dart';
import '../widgets/app_widgets.dart';
import '../themes/app_theme.dart';

class InsightsScreen extends StatelessWidget {
  const InsightsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Consumer<OrdoProvider>(
      builder: (context, prov, _) {
        final state = prov.state;
        if (state == null) return const Center(child: CircularProgressIndicator());
        final s = streak(state);
        final month = rangeScore(state, addDays(DateTime.now(), -29), 30);
        final weekly = weeklyCompletion(state);
        final trend = weekly.isNotEmpty && weekly.length >= 4
            ? (weekly.last['value'] as num).toInt() - (weekly[weekly.length - 4]['value'] as num).toInt()
            : 0;
        final points = (month * (s.current + 1) + s.best * 5).round();

        return RefreshIndicator(
          onRefresh: () async => Future.delayed(const Duration(milliseconds: 300)),
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              // ── Stats row ──
              _StatsRow(month: month, streak: s, trend: trend, points: points),
              const SizedBox(height: 16),

              // ── Milestone badges ──
              _Badges(streak: s, month: month),
              const SizedBox(height: 16),

              // ── Consistency heatmap ──
              _Heatmap(state: state),
              const SizedBox(height: 16),

              // ── Weekly completion chart ──
              PanelTitle(title: 'Weekly completion', hint: 'Last 10 weeks.'),
              const SizedBox(height: 8),
              _WeeklyChart(data: weekly),
              const SizedBox(height: 16),

              // ── Category balance ──
              PanelTitle(title: 'Category balance', hint: 'Completion by life domain, last 28 days.'),
              const SizedBox(height: 8),
              _CategoryChart(state: state),
              const SizedBox(height: 16),

              // ── Year in review ──
              PanelTitle(title: 'Year in review', hint: 'Your discipline, summed up.'),
              const SizedBox(height: 8),
              _YearInReview(state: state),
              const SizedBox(height: 16),

              // ── Coach review ──
              PanelTitle(title: 'Coach review', hint: 'Local rule-based review. Sign in for the server version.'),
              const SizedBox(height: 8),
              _CoachReview(state: state, trend: trend),
            ],
          ),
        );
      },
    );
  }
}

// ─── Stats Row ─────────────────────────────────────────────────────────

class _StatsRow extends StatelessWidget {
  final int month;
  final Streak streak;
  final int trend;
  final int points;

  const _StatsRow({required this.month, required this.streak, required this.trend, required this.points});

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        Stat(value: '$month%', label: 'Last 30 days'),
        Stat(value: '${streak.current}d', label: 'Current streak'),
        Stat(value: '${streak.best}d', label: 'Longest streak'),
        Stat(value: '${trend >= 0 ? '+' : ''}$trend%', label: '3-week trend'),
        Stat(value: '$points', label: 'Points'),
      ],
    );
  }
}

// ─── Badges ────────────────────────────────────────────────────────────

class _Badges extends StatelessWidget {
  final Streak streak;
  final int month;

  const _Badges({required this.streak, required this.month});

  @override
  Widget build(BuildContext context) {
    final earned = _badges(streak, month);
    if (earned.isEmpty) return const SizedBox.shrink();
    return Panel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          PanelTitle(title: 'Milestone badges', hint: 'Rewards resilience, not just perfection.'),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: earned.map((b) => Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                border: Border.all(color: OrdoColors.border),
                borderRadius: BorderRadius.circular(999),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.emoji_events, size: 16, color: OrdoColors.primary),
                  const SizedBox(width: 6),
                  Text(b, style: TextStyle(fontSize: 13, color: OrdoColors.foreground)),
                ],
              ),
            )).toList(),
          ),
        ],
      ),
    );
  }

  List<String> _badges(Streak s, int month) {
    final earned = <String>[];
    if (s.best >= 7) earned.add('🔥 7-day streak');
    if (s.best >= 30) earned.add('⚡ 30-day streak');
    if (s.best >= 60) earned.add('🏆 60-day streak');
    if (month >= 70) earned.add('🎯 70% month');
    if (s.current >= 3 && month < 40) earned.add('💪 Comeback');
    return earned;
  }
}

// ─── Heatmap ───────────────────────────────────────────────────────────

class _Heatmap extends StatelessWidget {
  final OrdoState state;

  const _Heatmap({required this.state});

  @override
  Widget build(BuildContext context) {
    return Panel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          PanelTitle(title: 'Consistency heatmap', hint: 'Half a year of discipline at one glance.'),
          const SizedBox(height: 8),
          SizedBox(
            height: 160,
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Weekday labels
                  Column(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: ['', 'M', '', 'W', '', 'F', ''].map((d) =>
                      SizedBox(height: 16, child: Center(child: Text(d, style: TextStyle(fontSize: 9, color: OrdoColors.mutedForeground))))
                    ).toList(),
                  ),
                  const SizedBox(width: 4),
                  // Heatmap cells
                  _buildGrid(),
                ],
              ),
            ),
          ),
          const SizedBox(height: 8),
          // Legend
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              Text('less', style: TextStyle(fontSize: 10, color: OrdoColors.mutedForeground)),
              const SizedBox(width: 4),
              ...[6, 30, 55, 80, 100].map((v) => Container(
                width: 12, height: 12,
                margin: const EdgeInsets.symmetric(horizontal: 1),
                decoration: BoxDecoration(
                  color: Color.lerp(OrdoColors.muted, OrdoColors.primary, v / 100),
                  borderRadius: BorderRadius.circular(2),
                  border: Border.all(color: OrdoColors.border.withValues(alpha: 0.4)),
                ),
              )),
              const SizedBox(width: 4),
              Text('more', style: TextStyle(fontSize: 10, color: OrdoColors.mutedForeground)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildGrid() {
    final now = DateTime.now();
    final start = addDays(startOfWeek(now), -7 * 25);
    final cells = <Widget>[];
    for (var i = 0; i < 26 * 7; i++) {
      final d = addDays(start, i);
      final key = dateKey(d);
      final score = d.isAfter(now) ? null : dayScore(state, d);
      cells.add(
        Tooltip(
          message: '$key — ${score == null ? '—' : '$score%'}',
          child: Container(
            width: 12, height: 12,
            margin: const EdgeInsets.all(1),
            decoration: BoxDecoration(
              color: score == null
                  ? Colors.transparent
                  : Color.lerp(OrdoColors.muted, OrdoColors.primary, (score / 100).clamp(0.0, 1.0)),
              borderRadius: BorderRadius.circular(2),
              border: Border.all(color: OrdoColors.border.withValues(alpha: 0.4)),
            ),
          ),
        ),
      );
    }
    return Wrap(children: cells);
  }
}

// ─── Weekly Chart ──────────────────────────────────────────────────────

class _WeeklyChart extends StatelessWidget {
  final List<Map<String, dynamic>> data;

  const _WeeklyChart({required this.data});

  @override
  Widget build(BuildContext context) {
    return Panel(
      child: SizedBox(
        height: 200,
        child: BarChart(
          BarChartData(
            barGroups: data.asMap().entries.map((e) {
              return BarChartGroupData(
                x: e.key,
                barRods: [
                  BarChartRodData(
                    toY: (e.value['value'] as num).toDouble(),
                    color: OrdoColors.primary,
                    width: 20,
                    borderRadius: const BorderRadius.vertical(top: Radius.circular(4)),
                  ),
                ],
              );
            }).toList(),
            titlesData: FlTitlesData(
              bottomTitles: AxisTitles(
                sideTitles: SideTitles(
                  showTitles: true,
                  getTitlesWidget: (value, meta) {
                    if (value.toInt() >= 0 && value.toInt() < data.length) {
                      return Text(data[value.toInt()]['label'] as String? ?? '',
                          style: TextStyle(fontSize: 10, color: OrdoColors.mutedForeground));
                    }
                    return const Text('');
                  },
                ),
              ),
              leftTitles: AxisTitles(
                sideTitles: SideTitles(
                  showTitles: true,
                  getTitlesWidget: (value, meta) {
                    return Text('${value.toInt()}%',
                        style: TextStyle(fontSize: 10, color: OrdoColors.mutedForeground));
                  },
                ),
              ),
            ),
            gridData: FlGridData(show: true),
          ),
        ),
      ),
    );
  }
}

// ─── Category Chart ────────────────────────────────────────────────────

class _CategoryChart extends StatelessWidget {
  final OrdoState state;

  const _CategoryChart({required this.state});

  @override
  Widget build(BuildContext context) {
    final catsProv = context.read<CategoriesProvider>();
    final breakdown = categoryBreakdown(state, catsProv.categories);
    final catList = (breakdown['cats'] as List).cast<Map<String, dynamic>>();
    final max = catList.isNotEmpty
        ? catList.map((c) => (c['value'] as num).toDouble()).fold<double>(0, (a, b) => a > b ? a : b)
        : 1.0;

    return Panel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ...catList.map((c) {
            final val = (c['value'] as num).toDouble();
            final pct = (val / (max > 0 ? max : 1)).clamp(0.0, 1.0);
            final color = _parseColor(catsProv.categoryColor(c['id'] as String));
            return Padding(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Row(
                children: [
                  SizedBox(
                    width: 90,
                    child: Text(c['category'] as String? ?? c['id'] as String,
                        style: TextStyle(fontSize: 12, color: OrdoColors.mutedForeground)),
                  ),
                  Expanded(
                    child: LinearProgressIndicator(
                      value: pct,
                      backgroundColor: OrdoColors.border,
                      valueColor: AlwaysStoppedAnimation(color),
                    ),
                  ),
                  const SizedBox(width: 8),
                  SizedBox(
                    width: 36,
                    child: Text('${(c['value'] as num).toInt()}%',
                        style: TextStyle(fontSize: 12, color: OrdoColors.foreground)),
                  ),
                ],
              ),
            );
          }),
          const SizedBox(height: 8),
          // Legend
          Wrap(
            spacing: 12,
            runSpacing: 4,
            children: catList.map((c) {
              final color = _parseColor(catsProv.categoryColor(c['id'] as String));
              return Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(width: 8, height: 8, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
                  const SizedBox(width: 4),
                  Text('${c['category']} ${(c['value'] as num).toInt()}%',
                      style: TextStyle(fontSize: 11, color: OrdoColors.mutedForeground)),
                ],
              );
            }).toList(),
          ),
        ],
      ),
    );
  }

  Color _parseColor(String hex) {
    final s = hex.replaceAll('#', '');
    return Color(int.parse(s.padLeft(6, '0'), radix: 16) + 0xFF000000);
  }
}

// ─── Year in Review ────────────────────────────────────────────────────

class _YearInReview extends StatelessWidget {
  final OrdoState state;

  const _YearInReview({required this.state});

  @override
  Widget build(BuildContext context) {
    final catsProv = context.read<CategoriesProvider>();
    final review = yearInReview(state, catsProv.categories);
    final isNew = review['isNew'] as bool;

    return Panel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _StatRow('Average Score', isNew ? 'New' : '${review['avg']}%'),
          _StatRow('Best Week', '${review['bestWeek']}%'),
          _StatRow('Most Consistent', '${review['mostConsistent']}'),
          _StatRow('Days Tracked', '${review['daysTracked']} / 365'),
          const SizedBox(height: 8),
          Row(
            children: [
              Icon(Icons.calendar_month, size: 16, color: OrdoColors.primary),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  isNew
                      ? 'Keep logging — the year review needs a few weeks of honest data to mean anything.'
                      : 'Your discipline this year averaged ${review['avg']}% with a best week of ${review['bestWeek']}%.',
                  style: TextStyle(fontSize: 13, color: OrdoColors.mutedForeground),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _StatRow extends StatelessWidget {
  final String label;
  final String value;

  const _StatRow(this.label, this.value);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: TextStyle(color: OrdoColors.mutedForeground, fontSize: 14)),
          Text(value,
              style: const TextStyle(fontFamily: 'SpaceGrotesk', fontWeight: FontWeight.w600, color: OrdoColors.foreground)),
        ],
      ),
    );
  }
}

// ─── Coach Review ──────────────────────────────────────────────────────

class _CoachReview extends StatelessWidget {
  final OrdoState state;
  final int trend;

  const _CoachReview({required this.state, required this.trend});

  @override
  Widget build(BuildContext context) {
    final catsProv = context.read<CategoriesProvider>();
    final cats = categoryBreakdown(state, catsProv.categories);
    final catList = (cats['cats'] as List).cast<Map<String, dynamic>>();
    final strongest = catList.isNotEmpty
        ? catList.reduce((a, b) => (a['value'] as num) > (b['value'] as num) ? a : b)
        : null;
    final weakest = catList.isNotEmpty
        ? catList.reduce((a, b) => (a['value'] as num) < (b['value'] as num) ? a : b)
        : null;

    return Panel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (strongest != null && weakest != null) ...[
            Row(
              children: [
                Icon(Icons.auto_awesome, size: 16, color: OrdoColors.primary),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'You are strongest in ${strongest['category']} (${strongest['value']}%) and weakest in ${weakest['category']} (${weakest['value']}%). The imbalance is ${(strongest['value'] as num) - (weakest['value'] as num)} points — that gap is a choice, not a coincidence.',
                    style: TextStyle(fontSize: 13, color: OrdoColors.foreground),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Icon(Icons.auto_awesome, size: 16, color: OrdoColors.primary),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Your last three weeks moved ${trend >= 0 ? "up" : "down"} ${trend.abs()} points. One adjustment for next week: move your lowest-completion block earlier in the day, before decision fatigue takes it.',
                    style: TextStyle(fontSize: 13, color: OrdoColors.foreground),
                  ),
                ),
              ],
            ),
          ] else
            Text('Not enough data for a coach review yet. Keep logging!',
                style: TextStyle(fontSize: 13, color: OrdoColors.mutedForeground)),
        ],
      ),
    );
  }
}

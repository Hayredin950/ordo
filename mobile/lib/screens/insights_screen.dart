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
        return SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              PanelTitle(title: 'Weekly Completion', hint: 'Last 10 weeks'),
              const SizedBox(height: 8),
              _WeeklyChart(state),
              const SizedBox(height: 24),
              PanelTitle(title: 'Category Breakdown'),
              const SizedBox(height: 8),
              _CategoryChart(state),
              const SizedBox(height: 24),
              PanelTitle(title: 'Year in Review'),
              const SizedBox(height: 8),
              _YearInReview(state),
              const SizedBox(height: 24),
              _Badges(state),
            ],
          ),
        );
      },
    );
  }
}

class _WeeklyChart extends StatelessWidget {
  final OrdoState state;

  const _WeeklyChart(this.state);

  @override
  Widget build(BuildContext context) {
    final data = weeklyCompletion(state);
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
                    borderRadius: const BorderRadius.vertical(
                        top: Radius.circular(4)),
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
                          style: TextStyle(
                              fontSize: 10, color: OrdoColors.mutedForeground));
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
                        style: TextStyle(
                            fontSize: 10, color: OrdoColors.mutedForeground));
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

class _CategoryChart extends StatelessWidget {
  final OrdoState state;

  const _CategoryChart(this.state);

  @override
  Widget build(BuildContext context) {
    final cats = context.read<CategoriesProvider>().categories;
    final breakdown = categoryBreakdown(state, cats);
    final catList = breakdown['cats'] as List;
    final max = catList.isNotEmpty
        ? (catList.map((c) => (c['value'] as num).toDouble()).reduce((a, b) => a > b ? a : b))
        : 1.0;
    final catsProv = context.read<CategoriesProvider>();
    return Panel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ...catList.map((c) {
            final pct = ((c['value'] as num).toDouble() / max).clamp(0.0, 1.0);
            final color = _parseColor(catsProv.categoryColor(c['id'] as String));
            return Padding(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Row(
                children: [
                  SizedBox(
                    width: 80,
                    child: Text(c['category'] as String? ?? c['id'] as String,
                        style: TextStyle(
                            fontSize: 12, color: OrdoColors.mutedForeground)),
                  ),
                  Expanded(
                    child: LinearProgressIndicator(
                      value: pct,
                      backgroundColor: OrdoColors.border,
                      valueColor: AlwaysStoppedAnimation(color),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text('${(c['value'] as num).toInt()}%',
                      style: TextStyle(
                          fontSize: 12, color: OrdoColors.foreground)),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }

  Color _parseColor(String hex) {
    final s = hex.replaceAll('#', '');
    return Color(int.parse(s.padLeft(6, '0'), radix: 16) + 0xFF000000);
  }
}

class _YearInReview extends StatelessWidget {
  final OrdoState state;

  const _YearInReview(this.state);

  @override
  Widget build(BuildContext context) {
    final review = yearInReview(state, context.read<CategoriesProvider>().categories);
    return Panel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _StatRow('Average Score', '${review['avg']}%'),
          _StatRow('Best Week', '${review['bestWeek']}%'),
          _StatRow('Days Tracked', '${review['daysTracked']} / 365'),
          _StatRow('Most Consistent', '${review['mostConsistent']}'),
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
          Text(label,
              style: TextStyle(color: OrdoColors.mutedForeground, fontSize: 14)),
          Text(value,
              style: const TextStyle(
                  fontFamily: 'SpaceGrotesk',
                  fontWeight: FontWeight.w600,
                  color: OrdoColors.foreground)),
        ],
      ),
    );
  }
}

class _Badges extends StatelessWidget {
  final OrdoState state;

  const _Badges(this.state);

  @override
  Widget build(BuildContext context) {
    final s = streak(state);
    final badgeData = badges(s, DateTime.now().month);
    final earned = (badgeData['earned'] as List).cast<String>();
    return Panel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Badges',
              style: TextStyle(
                  fontFamily: 'SpaceGrotesk',
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                  color: OrdoColors.foreground)),
          const SizedBox(height: 8),
          if (earned.isEmpty)
            const Text('No badges earned yet. Keep going!',
                style: TextStyle(color: OrdoColors.mutedForeground)),
          ...earned.map((e) => Padding(
                padding: const EdgeInsets.symmetric(vertical: 2),
                child: Row(
                  children: [
                    Icon(Icons.emoji_events, color: OrdoColors.primary, size: 16),
                    const SizedBox(width: 8),
                    Text(e,
                        style: const TextStyle(color: OrdoColors.foreground)),
                  ],
                ),
              )),
        ],
      ),
    );
  }
}

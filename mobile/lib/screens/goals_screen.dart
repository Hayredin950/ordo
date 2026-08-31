import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/ordo_state.dart';
import '../services/state_provider.dart';
import '../services/auth_provider.dart';
import '../widgets/app_widgets.dart';
import '../themes/app_theme.dart';

class GoalsScreen extends StatefulWidget {
  final VoidCallback? onLoginRequired;

  const GoalsScreen({super.key, this.onLoginRequired});

  @override
  State<GoalsScreen> createState() => _GoalsScreenState();
}

class _GoalsScreenState extends State<GoalsScreen> {
  String _period = 'year';

  static const _categories = ['health', 'study', 'work', 'finance', 'spiritual', 'relationships'];

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        _periodTabs(),
        Expanded(child: _goalsList()),
      ],
    );
  }

  Widget _periodTabs() {
    const periods = ['year', 'semester', 'month', 'week'];
    return SizedBox(
      height: 40,
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 8),
        itemCount: periods.length,
        itemBuilder: (context, i) {
          final selected = periods[i] == _period;
          return GestureDetector(
            onTap: () => setState(() => _period = periods[i]),
            child: Container(
              margin: const EdgeInsets.symmetric(horizontal: 4),
              padding: const EdgeInsets.symmetric(horizontal: 12),
              decoration: BoxDecoration(
                color: selected ? OrdoColors.primary : OrdoColors.card,
                borderRadius: BorderRadius.circular(999),
                border: Border.all(
                  color: selected ? OrdoColors.primary : OrdoColors.border,
                ),
              ),
              child: Center(
                child: Text(
                  periods[i].toUpperCase(),
                  style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: selected
                          ? OrdoColors.primaryForeground
                          : OrdoColors.mutedForeground),
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _goalsList() {
    return Consumer<OrdoProvider>(
      builder: (context, prov, _) {
        final state = prov.state;
        if (state == null) return const Center(child: CircularProgressIndicator());
        final filtered = state.goals
            .where((g) => g.period == _period ||
                (_period == 'year' && g.parentId == null))
            .toList();
        if (filtered.isEmpty) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.flag_outlined, size: 48, color: OrdoColors.mutedForeground),
                const SizedBox(height: 12),
                Text('No $_period goals yet',
                    style: TextStyle(
                        fontFamily: 'SpaceGrotesk',
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                        color: OrdoColors.foreground)),
                const SizedBox(height: 4),
                Text('Tap + to set a goal',
                    style: TextStyle(color: OrdoColors.mutedForeground)),
              ],
            ),
          );
        }
        return ListView.builder(
          padding: const EdgeInsets.all(16),
          itemCount: filtered.length,
          itemBuilder: (context, i) {
            final g = filtered[i];
            final pct = g.target.clamp(0.0, 100.0);
            return Panel(
              margin: const EdgeInsets.only(bottom: 8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(g.title,
                                style: const TextStyle(
                                    fontWeight: FontWeight.w600,
                                    color: OrdoColors.foreground,
                                    fontSize: 16)),
                            const SizedBox(height: 4),
                            Row(
                              children: [
                                CategoryPill(id: g.category),
                                const SizedBox(width: 8),
                                Text(g.period.toUpperCase(),
                                    style: TextStyle(fontSize: 11, fontWeight: FontWeight.w500, color: OrdoColors.mutedForeground)),
                              ],
                            ),
                          ],
                        ),
                      ),
                      PopupMenuButton<String>(
                        onSelected: (val) {
                          if (!context.read<AuthProvider>().isLoggedIn) {
                            widget.onLoginRequired?.call();
                            return;
                          }
                          if (val == 'delete') {
                            prov.update((s) => s.copyWith(
                              goals: List.from(s.goals)
                                ..removeWhere((goal) => goal.id == g.id),
                            ));
                          } else if (val == 'edit') {
                            _editGoal(context, g);
                          }
                        },
                        itemBuilder: (context) => [
                          const PopupMenuItem(value: 'edit', child: Text('Edit')),
                          const PopupMenuItem(value: 'delete', child: Text('Delete')),
                        ],
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      SizedBox(
                        width: 60,
                        height: 60,
                        child: ProgressRing(value: pct, size: 60),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Target: ${g.target.toInt()}%',
                                style: TextStyle(color: OrdoColors.mutedForeground, fontSize: 13)),
                            const SizedBox(height: 4),
                            LinearProgressIndicator(
                              value: pct / 100,
                              backgroundColor: OrdoColors.border,
                              valueColor: AlwaysStoppedAnimation(OrdoColors.primary),
                              minHeight: 4,
                              borderRadius: BorderRadius.circular(2),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  void _addGoal(BuildContext context) {
    final titleCtrl = TextEditingController();
    final targetCtrl = TextEditingController(text: '80');
    String category = 'work';
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
              padding: EdgeInsets.fromLTRB(24, 24, 24, MediaQuery.of(ctx).viewInsets.bottom + 24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text('Add Goal',
                      style: TextStyle(
                          fontFamily: 'SpaceGrotesk',
                          fontSize: 20,
                          fontWeight: FontWeight.w700)),
                  const SizedBox(height: 16),
                  TextField(
                    controller: titleCtrl,
                    decoration: const InputDecoration(hintText: 'Goal title'),
                    autofocus: true,
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: targetCtrl,
                    decoration: const InputDecoration(hintText: 'Target %', suffixText: '%'),
                    keyboardType: TextInputType.number,
                  ),
                  const SizedBox(height: 12),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: _categories.map((c) {
                      final selected = c == category;
                      return GestureDetector(
                        onTap: () => setSheetState(() => category = c),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                          decoration: BoxDecoration(
                            color: selected ? OrdoColors.primary.withValues(alpha: 0.2) : OrdoColors.card,
                            borderRadius: BorderRadius.circular(999),
                            border: Border.all(
                              color: selected ? OrdoColors.primary : OrdoColors.border,
                              width: selected ? 2 : 1,
                            ),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              CategoryDot(id: c),
                              const SizedBox(width: 6),
                              Text(c[0].toUpperCase() + c.substring(1), style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w500,
                                color: selected ? OrdoColors.primary : OrdoColors.mutedForeground,
                              )),
                            ],
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 16),
                  SizedBox(
                    height: 48,
                    child: ElevatedButton(
                      onPressed: () {
                        if (titleCtrl.text.trim().isNotEmpty) {
                          context.read<OrdoProvider>().update((s) => s.copyWith(
                            goals: [
                              ...s.goals,
                              Goal(
                                id: DateTime.now().millisecondsSinceEpoch.toString(),
                                title: titleCtrl.text.trim(),
                                period: _period,
                                category: category,
                                target: double.tryParse(targetCtrl.text) ?? 80,
                              ),
                            ],
                          ));
                          Navigator.pop(ctx);
                        }
                      },
                      child: const Text('Add'),
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

  void _editGoal(BuildContext context, Goal goal) {
    final titleCtrl = TextEditingController(text: goal.title);
    final targetCtrl = TextEditingController(text: goal.target.toInt().toString());
    String category = goal.category;
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
              padding: EdgeInsets.fromLTRB(24, 24, 24, MediaQuery.of(ctx).viewInsets.bottom + 24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text('Edit Goal',
                      style: TextStyle(
                          fontFamily: 'SpaceGrotesk',
                          fontSize: 20,
                          fontWeight: FontWeight.w700)),
                  const SizedBox(height: 16),
                  TextField(
                    controller: titleCtrl,
                    decoration: const InputDecoration(hintText: 'Goal title'),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: targetCtrl,
                    decoration: const InputDecoration(hintText: 'Target %', suffixText: '%'),
                    keyboardType: TextInputType.number,
                  ),
                  const SizedBox(height: 12),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: _categories.map((c) {
                      final selected = c == category;
                      return GestureDetector(
                        onTap: () => setSheetState(() => category = c),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                          decoration: BoxDecoration(
                            color: selected ? OrdoColors.primary.withValues(alpha: 0.2) : OrdoColors.card,
                            borderRadius: BorderRadius.circular(999),
                            border: Border.all(
                              color: selected ? OrdoColors.primary : OrdoColors.border,
                              width: selected ? 2 : 1,
                            ),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              CategoryDot(id: c),
                              const SizedBox(width: 6),
                              Text(c[0].toUpperCase() + c.substring(1), style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w500,
                                color: selected ? OrdoColors.primary : OrdoColors.mutedForeground,
                              )),
                            ],
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 16),
                  SizedBox(
                    height: 48,
                    child: ElevatedButton(
                      onPressed: () {
                        if (titleCtrl.text.trim().isNotEmpty) {
                          context.read<OrdoProvider>().update((s) {
                            final goals = List<Goal>.from(s.goals);
                            final idx = goals.indexWhere((g) => g.id == goal.id);
                            if (idx >= 0) {
                              goals[idx] = goal.copyWith(
                                title: titleCtrl.text.trim(),
                                target: double.tryParse(targetCtrl.text) ?? goal.target,
                                category: category,
                              );
                            }
                            return s.copyWith(goals: goals);
                          });
                          Navigator.pop(ctx);
                        }
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

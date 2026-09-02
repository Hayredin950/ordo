import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/state_provider.dart';
import '../themes/app_theme.dart';
import 'app_widgets.dart';

class OnboardingChecklist extends StatelessWidget {
  const OnboardingChecklist({super.key});

  @override
  Widget build(BuildContext context) {
    final state = context.watch<OrdoProvider>().state;
    if (state == null) return const SizedBox.shrink();

    final steps = [
      _ChecklistStep(
        label: 'Set your first goal',
        hint: 'Goals tab → add a goal at any time scale.',
        done: state.goals.isNotEmpty,
      ),
      _ChecklistStep(
        label: 'Build a routine',
        hint: 'Routine tab → add blocks to your week.',
        done: state.routine.values.any((blocks) => blocks.isNotEmpty),
      ),
      _ChecklistStep(
        label: 'Connect a notification channel',
        hint: 'Today tab → Telegram (or Slack) panel.',
        done: false,
      ),
    ];

    final completed = steps.where((s) => s.done).length;
    if (completed == steps.length) return const SizedBox.shrink();

    return Panel(
      margin: const EdgeInsets.only(bottom: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          PanelTitle(
            title: 'Getting started',
            hint: '$completed/${steps.length} done — the last one is what makes the nagging work.',
          ),
          const SizedBox(height: 12),
          LinearProgressIndicator(
            value: completed / steps.length,
            backgroundColor: OrdoColors.border,
            color: OrdoColors.primary,
            minHeight: 4,
            borderRadius: BorderRadius.circular(2),
          ),
          const SizedBox(height: 12),
          ...steps.map((step) => Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(
                  step.done ? Icons.check_circle : Icons.circle_outlined,
                  size: 20,
                  color: step.done ? OrdoColors.primary : OrdoColors.mutedForeground,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        step.label,
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w500,
                          color: step.done ? OrdoColors.mutedForeground : OrdoColors.foreground,
                          decoration: step.done ? TextDecoration.lineThrough : null,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        step.hint,
                        style: TextStyle(fontSize: 11, color: OrdoColors.mutedForeground),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          )),
        ],
      ),
    );
  }
}

class _ChecklistStep {
  final String label;
  final String hint;
  final bool done;

  const _ChecklistStep({
    required this.label,
    required this.hint,
    required this.done,
  });
}

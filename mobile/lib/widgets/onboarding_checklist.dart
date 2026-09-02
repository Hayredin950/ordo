import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/ordo_state.dart';
import '../services/channels_provider.dart';
import '../services/db.dart';
import '../services/state_provider.dart';
import '../themes/app_theme.dart';

/// One "getting started" step, in the same order and wording as the web's
/// OnboardingChecklist.
class OnboardingStep {
  final String label;
  final String hint;
  final bool done;

  const OnboardingStep({
    required this.label,
    required this.hint,
    required this.done,
  });
}

List<OnboardingStep> onboardingSteps(OrdoState? state, {required bool telegramLinked}) => [
  OnboardingStep(
    label: 'Set your first goal',
    hint: 'Goals tab → add a goal at any time scale.',
    done: state?.goals.isNotEmpty ?? false,
  ),
  OnboardingStep(
    label: 'Build a routine',
    hint: 'Routine tab → add blocks to your week.',
    done: state?.routine.values.any((blocks) => blocks.isNotEmpty) ?? false,
  ),
  OnboardingStep(
    label: 'Connect a notification channel',
    hint: 'Today tab → Telegram (or Slack) panel.',
    done: telegramLinked,
  ),
];

/// Steps still outstanding — anything above zero keeps the red dot on the bell.
int onboardingPending(OrdoState? state, {required bool telegramLinked}) =>
    onboardingSteps(state, telegramLinked: telegramLinked).where((s) => !s.done).length;

/// Opens the checklist from the notification bell. Records the flags that are
/// already true on the way in — `set_onboarding` only moves them false -> true,
/// and the list itself is always derived from live state, not from those flags.
void showOnboardingChecklist(BuildContext context) {
  final state = context.read<OrdoProvider>().state;
  final steps = onboardingSteps(
    state,
    telegramLinked: context.read<ChannelsProvider>().telegramLinked,
  );
  if (steps.any((s) => s.done)) {
    OrdoDb.setOnboarding(
      goalSet: steps[0].done ? true : null,
      routineSet: steps[1].done ? true : null,
      telegramLinked: steps[2].done ? true : null,
    );
  }

  showModalBottomSheet(
    context: context,
    backgroundColor: OrdoColors.surface,
    shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
    builder: (ctx) => const Padding(
      padding: EdgeInsets.fromLTRB(24, 24, 24, 32),
      child: OnboardingChecklist(),
    ),
  );
}

class OnboardingChecklist extends StatelessWidget {
  const OnboardingChecklist({super.key});

  @override
  Widget build(BuildContext context) {
    final state = context.watch<OrdoProvider>().state;
    final steps = onboardingSteps(
      state,
      telegramLinked: context.watch<ChannelsProvider>().telegramLinked,
    );
    final completed = steps.where((s) => s.done).length;
    final pending = steps.length - completed;

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Getting started',
            style: TextStyle(fontFamily: 'SpaceGrotesk', fontSize: 20, fontWeight: FontWeight.w700)),
        const SizedBox(height: 4),
        Text(
          pending == 0
              ? '$completed/${steps.length} done — you are set up.'
              : '$completed/${steps.length} done — the last one is what makes the nagging work.',
          style: TextStyle(fontSize: 12, color: OrdoColors.mutedForeground),
        ),
        const SizedBox(height: 16),
        LinearProgressIndicator(
          value: completed / steps.length,
          backgroundColor: OrdoColors.border,
          color: OrdoColors.primary,
          minHeight: 4,
          borderRadius: BorderRadius.circular(2),
        ),
        const SizedBox(height: 16),
        ...steps.map((step) => Padding(
          padding: const EdgeInsets.only(bottom: 12),
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
    );
  }
}

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/ordo_state.dart';
import '../services/state_provider.dart';
import '../themes/app_theme.dart';
import '../widgets/app_widgets.dart';

class PreferencesPanel extends StatelessWidget {
  const PreferencesPanel({super.key});

  @override
  Widget build(BuildContext context) {
    final state = context.watch<OrdoProvider>().state;
    if (state == null) return const SizedBox.shrink();

    final hourFormat = state.settings?.hourFormat ?? '24h';

    return Panel(
      margin: const EdgeInsets.only(bottom: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const PanelTitle(
            title: 'Preferences',
            hint: 'How Ordo writes the clock. Synced to your account.',
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: SegButton(
                  active: hourFormat == '24h',
                  onPressed: () => _updateFormat(context, '24h'),
                  label: '24-hour',
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: SegButton(
                  active: hourFormat == '12h',
                  onPressed: () => _updateFormat(context, '12h'),
                  label: '12-hour',
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: OrdoColors.background.withValues(alpha: 0.4),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: OrdoColors.border),
            ),
            child: Row(
              children: [
                Icon(Icons.access_time, size: 18, color: OrdoColors.primary),
                const SizedBox(width: 10),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      hourFormat == '24h' ? '09:00 — 17:30' : '9:00 AM — 5:30 PM',
                      style: const TextStyle(
                        fontFamily: 'SpaceGrotesk',
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: OrdoColors.foreground,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      hourFormat == '24h' ? 'Example block today' : 'Example block today',
                      style: TextStyle(fontSize: 11, color: OrdoColors.mutedForeground),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 10),
          Text(
            'The time pickers when you edit a block are drawn by your device and follow your locale.',
            style: TextStyle(fontSize: 11, color: OrdoColors.mutedForeground),
          ),
        ],
      ),
    );
  }

  void _updateFormat(BuildContext context, String format) {
    context.read<OrdoProvider>().update((s) => OrdoState(
      routine: s.routine,
      overrides: s.overrides,
      log: s.log,
      journal: s.journal,
      goals: s.goals,
      templates: s.templates,
      settings: Settings(hourFormat: format),
    ));
  }
}

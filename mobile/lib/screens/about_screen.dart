import 'package:flutter/material.dart';
import '../themes/app_theme.dart';

class AboutScreen extends StatelessWidget {
  const AboutScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('About Ordo'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Hero
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: OrdoColors.card,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: OrdoColors.border),
            ),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: OrdoColors.primary.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(Icons.auto_awesome, color: OrdoColors.primary, size: 28),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Ordo',
                          style: TextStyle(
                              fontFamily: 'SpaceGrotesk',
                              fontSize: 24,
                              fontWeight: FontWeight.w700,
                              color: OrdoColors.foreground)),
                      const Text('Personal Accountability & Goal Tracking',
                          style: TextStyle(fontSize: 14, color: OrdoColors.mutedForeground)),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          const Text(
            'Plan your year down to the hour. Log reality. Let the data do the nagging.',
            style: TextStyle(fontSize: 15, color: OrdoColors.foreground, height: 1.5),
          ),
          const SizedBox(height: 24),
          // Key Features
          const Text('Key Features',
              style: TextStyle(
                  fontFamily: 'SpaceGrotesk',
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: OrdoColors.primary)),
          const SizedBox(height: 12),
          ...[
            ('🎯', 'Goal Hierarchy', 'Define goals at every scale — year, semester, month, week, day — each rolling up into the one above.'),
            ('📅', 'Time-Block Routines', 'Create a default routine per weekday with per-date overrides. Copy to other days, weeks or ranges.'),
            ('📊', 'Streaks & Heatmap', 'A GitHub-style consistency heatmap over the last six months, milestone badges, and a live streak counter.'),
            ('🤖', 'AI Coach', 'Weekly reflection and catch-up proposals powered by Anthropic Claude when configured, with a rule-based fallback.'),
            ('📲', 'Bot Integrations', 'Morning briefs, block reminders, unlogged must-do nags, evening check-ins and weekly reports via Telegram & Slack.'),
            ('✉️', 'Future-Self Letters', 'Sealed at goal-setting time and delivered by the bot on their deadline — accountability you can\'t ignore.'),
            ('👥', 'Community', 'Pair with a friend to see each other\'s weekly percentage, publish routines to a public template library, or join opt-in challenges.'),
            ('🔄', 'Plan vs. Log', 'The plan and the log are separate objects. Every score, streak, and chart is computed from the log, never the plan.'),
          ].map((item) => _featureTile(item.$1, item.$2, item.$3)),
          const SizedBox(height: 24),
          // Design Philosophy
          const Text('Design Philosophy',
              style: TextStyle(
                  fontFamily: 'SpaceGrotesk',
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: OrdoColors.primary)),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: OrdoColors.card,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: OrdoColors.border),
            ),
            child: const Text(
              'The plan (what should happen) and the log (what did happen) are deliberately separate objects. Every score, streak, and chart is computed from the log, never from the plan. When signed out, everything runs locally; signing in syncs the same document per-user to the cloud.',
              style: TextStyle(fontSize: 13, color: OrdoColors.mutedForeground, height: 1.5),
            ),
          ),
          const SizedBox(height: 16),
          // Version
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: OrdoColors.card,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: OrdoColors.border),
            ),
            child: Row(
              children: [
                const Icon(Icons.info_outline, color: OrdoColors.mutedForeground, size: 20),
                const SizedBox(width: 12),
                const Text('v1.0.0 · Ordo · All rights reserved',
                    style: TextStyle(fontSize: 13, color: OrdoColors.mutedForeground)),
              ],
            ),
          ),
          const SizedBox(height: 32),
          // Tech stack
          const Text('Built With',
              style: TextStyle(
                  fontFamily: 'SpaceGrotesk',
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: OrdoColors.primary)),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: ['TanStack Start', 'React', 'TypeScript', 'Supabase', 'Tailwind CSS', 'Flutter', 'Dart']
                .map((tech) => Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: OrdoColors.surface,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: OrdoColors.border),
                  ),
                  child: Text(tech, style: const TextStyle(fontSize: 12, color: OrdoColors.mutedForeground)),
                ))
                .toList(),
          ),
        ],
      ),
    );
  }

  Widget _featureTile(String icon, String title, String desc) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(icon, style: const TextStyle(fontSize: 20)),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(
                    fontWeight: FontWeight.w600,
                    color: OrdoColors.foreground,
                    fontSize: 14)),
                const SizedBox(height: 2),
                Text(desc, style: const TextStyle(
                    fontSize: 13,
                    color: OrdoColors.mutedForeground,
                    height: 1.4)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

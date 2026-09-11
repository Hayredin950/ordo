import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/alarm_provider.dart';
import '../services/auth_provider.dart';
import '../services/state_provider.dart';
import '../models/ordo_state.dart';
import '../themes/app_theme.dart';
import '../widgets/alarm_settings_sheet.dart';

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final alarm = context.watch<AlarmProvider>();
    final auth = context.watch<AuthProvider>();
    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: Consumer<OrdoProvider>(
        builder: (context, prov, _) {
          final state = prov.state;
          if (state == null) return const Center(child: CircularProgressIndicator());
          final hourFormat = state.settings?.hourFormat ?? '24h';
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              // ── Profile section ──
              if (auth.isLoggedIn) ...[
                _ProfileCard(
                  email: auth.user?.email ?? '',
                  name: auth.user?.email?.split('@').first ?? 'User',
                ),
                const SizedBox(height: 24),
              ],
              const Text('Appearance',
                  style: TextStyle(
                      fontFamily: 'SpaceGrotesk',
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: OrdoColors.primary)),
              const SizedBox(height: 12),
              _SettingsTile(
                icon: Icons.access_time,
                title: 'Time Format',
                subtitle: hourFormat == '12h' ? '12-hour (AM/PM)' : '24-hour',
                onTap: () {
                  final newFormat = hourFormat == '12h' ? '24h' : '12h';
                  prov.update((s) => s.copyWith(
                    settings: Settings(hourFormat: newFormat),
                  ));
                },
              ),
              const SizedBox(height: 24),
              const Text('Focus',
                  style: TextStyle(
                      fontFamily: 'SpaceGrotesk',
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: OrdoColors.primary)),
              const SizedBox(height: 12),
              _SettingsTile(
                icon: alarm.enabled ? Icons.alarm : Icons.alarm_off,
                title: 'Timer Alarm',
                subtitle: alarm.enabled
                    ? '${alarm.sound.label}${alarm.vibrate ? ' + vibrate' : ''}'
                    : 'Off',
                onTap: () => showAlarmSettingsSheet(context),
              ),
              const SizedBox(height: 24),
              const Text('Data',
                  style: TextStyle(
                      fontFamily: 'SpaceGrotesk',
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: OrdoColors.primary)),
              const SizedBox(height: 12),
              _SettingsTile(
                icon: Icons.refresh,
                title: 'Reset All Data',
                subtitle: 'Restore to default state with sample data',
                onTap: () => _showResetDialog(context, prov),
                destructive: true,
              ),
              const SizedBox(height: 24),
              // ── About section ──
              const Text('About',
                  style: TextStyle(
                      fontFamily: 'SpaceGrotesk',
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: OrdoColors.primary)),
              const SizedBox(height: 12),
              _AboutCard(),
              const SizedBox(height: 16),
              _versionTile(),
            ],
          );
        },
      ),
    );
  }

  Widget _versionTile() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: OrdoColors.card,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: OrdoColors.border),
      ),
      child: Row(
        children: [
          const Icon(Icons.info_outline, color: OrdoColors.mutedForeground, size: 22),
          const SizedBox(width: 16),
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Ordo', style: TextStyle(fontWeight: FontWeight.w600, color: OrdoColors.foreground)),
                Text('v1.0.0 · Personal Accountability App',
                    style: TextStyle(fontSize: 12, color: OrdoColors.mutedForeground)),
              ],
            ),
          ),
          const Icon(Icons.chevron_right, color: OrdoColors.mutedForeground, size: 20),
        ],
      ),
    );
  }

  void _showResetDialog(BuildContext context, OrdoProvider prov) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: OrdoColors.card,
        title: const Text('Reset Data',
            style: TextStyle(color: OrdoColors.foreground)),
        content: const Text(
            'This will erase all your data and restore sample data. This cannot be undone.',
            style: TextStyle(color: OrdoColors.mutedForeground)),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text('Cancel', style: TextStyle(color: OrdoColors.mutedForeground)),
          ),
          TextButton(
            onPressed: () {
              prov.reset();
              Navigator.pop(ctx);
            },
            child: const Text('Reset', style: TextStyle(color: OrdoColors.destructive)),
          ),
        ],
      ),
    );
  }
}

class _ProfileCard extends StatelessWidget {
  final String email;
  final String name;

  const _ProfileCard({required this.email, required this.name});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            OrdoColors.primary.withValues(alpha: 0.15),
            OrdoColors.card,
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: OrdoColors.primary.withValues(alpha: 0.3)),
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 24,
            backgroundColor: OrdoColors.primary,
            child: Text(
              name[0].toUpperCase(),
              style: TextStyle(
                color: OrdoColors.primaryForeground,
                fontWeight: FontWeight.w700,
                fontSize: 20,
                fontFamily: 'SpaceGrotesk',
              ),
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(name,
                    style: const TextStyle(
                        fontFamily: 'SpaceGrotesk',
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                        color: OrdoColors.foreground)),
                const SizedBox(height: 2),
                Text(email,
                    style: TextStyle(
                        fontSize: 13, color: OrdoColors.mutedForeground)),
                const SizedBox(height: 6),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: OrdoColors.primary.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Text('Signed in',
                      style: TextStyle(fontSize: 11, color: OrdoColors.primary, fontWeight: FontWeight.w500)),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _AboutCard extends StatelessWidget {
  const _AboutCard();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: OrdoColors.card,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: OrdoColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // App name and icon
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: OrdoColors.primary.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(Icons.auto_awesome, color: OrdoColors.primary, size: 20),
              ),
              const SizedBox(width: 12),
              const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Ordo',
                      style: TextStyle(
                          fontFamily: 'SpaceGrotesk',
                          fontSize: 18,
                          fontWeight: FontWeight.w700,
                          color: OrdoColors.foreground)),
                  Text('Personal Accountability & Goal Tracking',
                      style: TextStyle(fontSize: 12, color: OrdoColors.mutedForeground)),
                ],
              ),
            ],
          ),
          const SizedBox(height: 12),
          const Divider(height: 1, color: OrdoColors.border),
          const SizedBox(height: 12),
          const Text(
            'Plan your year down to the hour. Log reality. Let the data do the nagging.',
            style: TextStyle(fontSize: 13, color: OrdoColors.foreground, height: 1.5),
          ),
          const SizedBox(height: 12),
          const Divider(height: 1, color: OrdoColors.border),
          const SizedBox(height: 12),
          const Text('Key Features',
              style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: OrdoColors.mutedForeground,
                  letterSpacing: 0.5)),
          const SizedBox(height: 8),
          _featureItem(Icons.calendar_today, 'Goal hierarchy — year to day'),
          _featureItem(Icons.repeat, 'Time-block routines with overrides'),
          _featureItem(Icons.auto_stories, 'Streaks, heatmap & badges'),
          _featureItem(Icons.psychology, 'AI-powered weekly reflection'),
          _featureItem(Icons.message, 'Telegram & Slack integrations'),
          _featureItem(Icons.group, 'Challenges & community pairing'),
          const SizedBox(height: 12),
          const Divider(height: 1, color: OrdoColors.border),
          const SizedBox(height: 12),
          const Text(
            'The plan (what should happen) and the log (what did happen) are deliberately '
            'separate. Every score is computed from the log, never the plan.',
            style: TextStyle(fontSize: 12, color: OrdoColors.mutedForeground, height: 1.5),
          ),
        ],
      ),
    );
  }

  Widget _featureItem(IconData icon, String text) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        children: [
          Icon(icon, color: OrdoColors.primary, size: 16),
          const SizedBox(width: 10),
          Expanded(
            child: Text(text,
                style: const TextStyle(fontSize: 13, color: OrdoColors.foreground)),
          ),
        ],
      ),
    );
  }
}

class _SettingsTile extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;
  final bool destructive;

  const _SettingsTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
    this.destructive = false,
  });

  @override
  Widget build(BuildContext context) {
    final titleColor = destructive ? OrdoColors.destructive : OrdoColors.foreground;
    final subtitleColor = destructive ? OrdoColors.destructive.withValues(alpha: 0.7) : OrdoColors.mutedForeground;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: OrdoColors.card,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: OrdoColors.border),
        ),
        child: Row(
          children: [
            Icon(icon, color: titleColor, size: 22),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title,
                      style: TextStyle(
                          fontWeight: FontWeight.w600,
                          color: titleColor)),
                  const SizedBox(height: 2),
                  Text(subtitle,
                      style: TextStyle(
                          fontSize: 12,
                          color: subtitleColor)),
                ],
              ),
            ),
            Icon(Icons.chevron_right, color: OrdoColors.mutedForeground, size: 20),
          ],
        ),
      ),
    );
  }
}

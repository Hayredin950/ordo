import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/alarm_provider.dart';
import '../services/auth_provider.dart';
import '../services/state_provider.dart';
import '../models/ordo_state.dart';
import '../themes/app_theme.dart';
import '../screens/about_screen.dart';

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
              _SettingsRow(
                icon: Icons.access_time,
                title: 'Time Format',
                subtitle: hourFormat == '12h' ? '12-hour (AM/PM)' : '24-hour',
                action: Switch(
                  value: hourFormat == '24h',
                  onChanged: (_) {
                    final next = hourFormat == '12h' ? '24h' : '12h';
                    prov.update((s) => s.copyWith(
                      settings: Settings(hourFormat: next),
                    ));
                  },
                ),
              ),
              const SizedBox(height: 24),
              const Text('Focus',
                  style: TextStyle(
                      fontFamily: 'SpaceGrotesk',
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: OrdoColors.primary)),
              const SizedBox(height: 12),
              _SettingsRow(
                icon: alarm.enabled ? Icons.alarm : Icons.alarm_off,
                title: 'Timer Alarm',
                subtitle: alarm.enabled ? 'Sound when a session ends' : 'Off',
                action: Switch(
                  value: alarm.enabled,
                  onChanged: (_) => alarm.setEnabled(!alarm.enabled),
                ),
              ),
              const SizedBox(height: 12),
              if (alarm.enabled)
_SettingsRow(
                icon: Icons.vibration,
                title: 'Vibrate',
                subtitle: alarm.vibrate ? 'Vibrate on finish' : 'Off',
                action: Switch(
                  value: alarm.vibrate,
                  onChanged: (_) => alarm.setVibrate(!alarm.vibrate),
                ),
              ),
              const SizedBox(height: 24),
              const Text('Data',
                  style: TextStyle(
                      fontFamily: 'SpaceGrotesk',
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: OrdoColors.primary)),
              const SizedBox(height: 12),
              _ActionRow(
                icon: Icons.refresh,
                title: 'Reset All Data',
                subtitle: 'Restore to default state with sample data',
                color: OrdoColors.destructive,
                onTap: () => _showResetDialog(context, prov),
              ),
              const SizedBox(height: 24),
              const Text('About',
                  style: TextStyle(
                      fontFamily: 'SpaceGrotesk',
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: OrdoColors.primary)),
              const SizedBox(height: 12),
              _AboutTile(onTap: () {
                Navigator.push(context, MaterialPageRoute(
                  builder: (_) => const AboutScreen(),
                ));
              }),
            ],
          );
        },
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

class _AboutTile extends StatelessWidget {
  final VoidCallback onTap;

  const _AboutTile({required this.onTap});

  @override
  Widget build(BuildContext context) {
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
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: OrdoColors.primary.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(Icons.auto_awesome, color: OrdoColors.primary, size: 20),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Ordo',
                      style: TextStyle(
                          fontFamily: 'SpaceGrotesk',
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                          color: OrdoColors.foreground)),
                  Text('Personal Accountability & Goal Tracking',
                      style: TextStyle(fontSize: 12, color: OrdoColors.mutedForeground)),
                ],
              ),
            ),
            const Icon(Icons.chevron_right, color: OrdoColors.mutedForeground, size: 20),
          ],
        ),
      ),
    );
  }
}

class _SettingsRow extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final Widget action;

  const _SettingsRow({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.action,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: OrdoColors.card,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: OrdoColors.border),
      ),
      child: Row(
        children: [
          Icon(icon, color: OrdoColors.foreground, size: 22),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title,
                    style: const TextStyle(
                        fontWeight: FontWeight.w600,
                        color: OrdoColors.foreground)),
                const SizedBox(height: 2),
                Text(subtitle,
                    style: const TextStyle(fontSize: 12, color: OrdoColors.mutedForeground)),
              ],
            ),
          ),
          action,
        ],
      ),
    );
  }
}

class _ActionRow extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final Color color;
  final VoidCallback onTap;

  const _ActionRow({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
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
            Icon(icon, color: color, size: 22),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title,
                      style: TextStyle(
                          fontWeight: FontWeight.w600, color: color)),
                  const SizedBox(height: 2),
                  Text(subtitle,
                      style: const TextStyle(fontSize: 12, color: OrdoColors.mutedForeground)),
                ],
              ),
            ),
            const Icon(Icons.chevron_right, color: OrdoColors.mutedForeground, size: 20),
          ],
        ),
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/state_provider.dart';
import '../models/ordo_state.dart';
import '../themes/app_theme.dart';

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
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
              const Text('About',
                  style: TextStyle(
                      fontFamily: 'SpaceGrotesk',
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: OrdoColors.primary)),
              const SizedBox(height: 12),
              _SettingsTile(
                icon: Icons.info_outline,
                title: 'Ordo',
                subtitle: 'Personal Accountability App',
                onTap: () {},
              ),
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

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/auth_provider.dart';
import '../services/state_provider.dart';
import '../models/ordo_state.dart';
import '../themes/app_theme.dart';

/// Three-dot overflow menu matching the web's AccountMenu in AppShell.
/// Shows user info, clock toggle, reset, and sign out.
class AccountMenuButton extends StatelessWidget {
  const AccountMenuButton({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    if (!auth.isLoggedIn) return const SizedBox.shrink();

    return PopupMenuButton<String>(
      icon: const Icon(Icons.more_vert, color: OrdoColors.foreground),
      color: OrdoColors.card,
      onSelected: (value) => _handleTap(context, value),
      itemBuilder: (context) {
        final ordo = context.read<OrdoProvider>();
        final state = ordo.state;
        final hourFormat = state?.settings?.hourFormat ?? '24h';
        final email = auth.user?.email ?? '';

        return [
          // User info header
          PopupMenuItem<String>(
            enabled: false,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  email,
                  style: const TextStyle(
                    fontWeight: FontWeight.w600,
                    color: OrdoColors.foreground,
                    fontSize: 13,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                Text(
                  'Signed in',
                  style: TextStyle(
                    fontSize: 11,
                    color: OrdoColors.mutedForeground,
                  ),
                ),
              ],
            ),
          ),
          const PopupMenuDivider(),

          // Clock format toggle
          PopupMenuItem<String>(
            value: 'clock',
            child: Row(
              children: [
                const Icon(Icons.access_time, size: 20, color: OrdoColors.mutedForeground),
                const SizedBox(width: 12),
                Text(
                  hourFormat == '24h'
                      ? 'Switch to 12-hour (AM/PM)'
                      : 'Switch to 24-hour',
                  style: const TextStyle(color: OrdoColors.foreground),
                ),
              ],
            ),
          ),
          const PopupMenuDivider(),

          // Reset data
          PopupMenuItem<String>(
            value: 'reset',
            child: Row(
              children: [
                const Icon(Icons.restart_alt, size: 20, color: OrdoColors.destructive),
                const SizedBox(width: 12),
                const Text('Reset my data',
                    style: TextStyle(color: OrdoColors.destructive)),
              ],
            ),
          ),
          const PopupMenuDivider(),

          // Sign out
          PopupMenuItem<String>(
            value: 'signout',
            child: Row(
              children: [
                const Icon(Icons.logout, size: 20, color: OrdoColors.mutedForeground),
                const SizedBox(width: 12),
                const Text('Sign out',
                    style: TextStyle(color: OrdoColors.foreground)),
              ],
            ),
          ),
        ];
      },
    );
  }

  void _handleTap(BuildContext context, String value) {
    final auth = context.read<AuthProvider>();
    final ordo = context.read<OrdoProvider>();

    switch (value) {
      case 'clock':
        final state = ordo.state;
        if (state == null) return;
        final current = state.settings?.hourFormat ?? '24h';
        final next = current == '24h' ? '12h' : '24h';
        ordo.update((s) => s.copyWith(settings: Settings(hourFormat: next)));
        break;

      case 'reset':
        _showResetDialog(context, ordo);
        break;

      case 'signout':
        auth.logout();
        break;
    }
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
          style: TextStyle(color: OrdoColors.mutedForeground),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text('Cancel',
                style: TextStyle(color: OrdoColors.mutedForeground)),
          ),
          TextButton(
            onPressed: () {
              prov.reset();
              Navigator.pop(ctx);
            },
            child: const Text('Reset',
                style: TextStyle(color: OrdoColors.destructive)),
          ),
        ],
      ),
    );
  }
}

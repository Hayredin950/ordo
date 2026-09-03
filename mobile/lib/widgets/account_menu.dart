import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../services/auth_provider.dart';
import '../services/state_provider.dart';
import '../models/ordo_state.dart';
import '../themes/app_theme.dart';
import '../screens/settings_screen.dart';

/// Profile menu matching the web's AccountMenu in AppShell.
/// Shows sign-in icon when logged out, profile icon with full menu when logged in.
class AccountMenuButton extends StatelessWidget {
  final VoidCallback? onLoginRequired;

  const AccountMenuButton({super.key, this.onLoginRequired});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final isLoggedIn = auth.isLoggedIn;

    if (!isLoggedIn) {
      return TextButton.icon(
        icon: const Icon(Icons.login, size: 18),
        label: const Text('Sign in', style: TextStyle(fontSize: 13)),
        style: TextButton.styleFrom(
          foregroundColor: OrdoColors.primary,
          padding: const EdgeInsets.symmetric(horizontal: 12),
        ),
        onPressed: onLoginRequired,
      );
    }

    return PopupMenuButton<String>(
      icon: CircleAvatar(
        radius: 14,
        backgroundColor: OrdoColors.primary,
        child: Text(
          (auth.user?.email ?? 'U')[0].toUpperCase(),
          style: TextStyle(
            color: OrdoColors.primaryForeground,
            fontWeight: FontWeight.w700,
            fontSize: 13,
          ),
        ),
      ),
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

          // Settings
          PopupMenuItem<String>(
            value: 'settings',
            child: Row(
              children: [
                const Icon(Icons.settings_outlined, size: 20, color: OrdoColors.mutedForeground),
                const SizedBox(width: 12),
                const Text('Settings', style: TextStyle(color: OrdoColors.foreground)),
              ],
            ),
          ),

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

          // Export submenu header
          PopupMenuItem<String>(
            enabled: false,
            child: Text(
              'Export',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: OrdoColors.mutedForeground,
              ),
            ),
          ),
          PopupMenuItem<String>(
            value: 'export_json',
            child: Row(
              children: [
                const Icon(Icons.code, size: 20, color: OrdoColors.mutedForeground),
                const SizedBox(width: 12),
                const Text('Export JSON', style: TextStyle(color: OrdoColors.foreground)),
              ],
            ),
          ),
          PopupMenuItem<String>(
            value: 'export_csv',
            child: Row(
              children: [
                const Icon(Icons.table_chart_outlined, size: 20, color: OrdoColors.mutedForeground),
                const SizedBox(width: 12),
                const Text('Export CSV', style: TextStyle(color: OrdoColors.foreground)),
              ],
            ),
          ),
          PopupMenuItem<String>(
            value: 'export_ical',
            child: Row(
              children: [
                const Icon(Icons.calendar_today, size: 20, color: OrdoColors.mutedForeground),
                const SizedBox(width: 12),
                const Text('Export iCal', style: TextStyle(color: OrdoColors.foreground)),
              ],
            ),
          ),
          const PopupMenuDivider(),

          // Undo
          PopupMenuItem<String>(
            value: 'undo',
            child: Row(
              children: [
                const Icon(Icons.undo, size: 20, color: OrdoColors.mutedForeground),
                const SizedBox(width: 12),
                const Text('Undo last change', style: TextStyle(color: OrdoColors.foreground)),
              ],
            ),
          ),

          // Redo — only live once something has been undone this session.
          PopupMenuItem<String>(
            value: 'redo',
            enabled: ordo.canRedo,
            child: Row(
              children: [
                Icon(Icons.redo,
                    size: 20,
                    color: ordo.canRedo
                        ? OrdoColors.mutedForeground
                        : OrdoColors.mutedForeground.withValues(alpha: 0.4)),
                const SizedBox(width: 12),
                Text('Redo',
                    style: TextStyle(
                        color: ordo.canRedo
                            ? OrdoColors.foreground
                            : OrdoColors.mutedForeground.withValues(alpha: 0.4))),
              ],
            ),
          ),

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
      case 'settings':
        Navigator.push(context, MaterialPageRoute(
          builder: (_) => const SettingsScreen(),
        ));
        break;

      case 'clock':
        final state = ordo.state;
        if (state == null) return;
        final current = state.settings?.hourFormat ?? '24h';
        final next = current == '24h' ? '12h' : '24h';
        ordo.update((s) => s.copyWith(settings: Settings(hourFormat: next)));
        break;

      case 'export_json':
        _exportJson(context, ordo, auth);
        break;

      case 'export_csv':
        _exportCsv(context, ordo);
        break;

      case 'export_ical':
        _exportIcal(context, ordo);
        break;

      case 'undo':
        _undo(context, ordo);
        break;

      case 'redo':
        _redo(context, ordo);
        break;

      case 'reset':
        _showResetDialog(context, ordo);
        break;

      case 'signout':
        auth.logout();
        break;
    }
  }

  Future<void> _undo(BuildContext context, OrdoProvider prov) async {
    final ok = await prov.undo();
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(ok ? 'Undone' : 'Nothing left to undo'),
      action: ok
          ? SnackBarAction(label: 'Redo', onPressed: () => prov.redo())
          : null,
    ));
  }

  Future<void> _redo(BuildContext context, OrdoProvider prov) async {
    final ok = await prov.redo();
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(ok ? 'Redone' : 'Nothing to redo'),
    ));
  }

  void _exportJson(BuildContext context, OrdoProvider prov, AuthProvider auth) {
    final state = prov.state;
    if (state == null) return;
    final json = jsonEncode({
      'exportedAt': DateTime.now().toIso8601String(),
      'user': auth.user != null ? {'id': auth.user!.id, 'email': auth.user!.email} : null,
      'state': state.toJson(),
    });
    _shareContent(context, json, 'ordo-export.json', 'application/json');
  }

  void _exportCsv(BuildContext context, OrdoProvider prov) {
    final state = prov.state;
    if (state == null) return;

    // Build block lookup
    final blockMap = <String, Block>{};
    for (final list in state.routine.values) {
      for (final b in list) {
        blockMap[b.id] = b;
      }
    }
    for (final list in state.overrides.values) {
      for (final b in list) {
        blockMap[b.id] = b;
      }
    }

    final rows = <String>[
      'date,block,category,start,end,percent',
    ];
    for (final entry in state.log.entries) {
      for (final logEntry in entry.value.entries) {
        final b = blockMap[logEntry.key];
        rows.add('${entry.key},${_csvEscape(b?.title ?? logEntry.key)},'
            '${b?.category ?? ''},${b?.start ?? ''},${b?.end ?? ''},${logEntry.value}');
      }
    }
    rows.sort((a, b) {
      if (a == rows[0]) return -1;
      if (b == rows[0]) return 1;
      return a.compareTo(b);
    });
    _shareContent(context, rows.join('\n'), 'ordo-log.csv', 'text/csv');
  }

  String _csvEscape(String s) {
    if (s.contains(',') || s.contains('"') || s.contains('\n')) {
      return '"${s.replaceAll('"', '""')}"';
    }
    return s;
  }

  void _exportIcal(BuildContext context, OrdoProvider prov) {
    final state = prov.state;
    if (state == null) return;

    const days = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
    final lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Ordo//EN',
      'CALSCALE:GREGOR',
    ];

    final today = DateTime.now();
    for (var offset = 0; offset < 7; offset++) {
      final date = today.add(Duration(days: offset));
      final dow = date.weekday % 7;
      final blocks = state.routine[dow] ?? [];
      final dateStr = '${date.year}${date.month.toString().padLeft(2, '0')}${date.day.toString().padLeft(2, '0')}';

      for (final b in blocks) {
        lines.addAll([
          'BEGIN:VEVENT',
          'UID:${b.id}@ordo',
          'DTSTART:${dateStr}T${b.start.replaceAll(':', '')}00',
          'DTEND:${dateStr}T${b.end.replaceAll(':', '')}00',
          'SUMMARY:${_icalEscape(b.title)}',
          'CATEGORIES:${b.category}',
          'RRULE:FREQ=WEEKLY;BYDAY=${days[dow]}',
          'END:VEVENT',
        ]);
      }
    }
    lines.add('END:VCALENDAR');
    _shareContent(context, lines.join('\r\n'), 'ordo-routine.ics', 'text/calendar');
  }

  String _icalEscape(String s) => s.replaceAll(RegExp(r'([\\;,])'), r'\\$1').replaceAll('\n', '\\n');

  void _shareContent(BuildContext context, String content, String filename, String mimeType) {
    // Copy to clipboard and show confirmation
    Clipboard.setData(ClipboardData(text: content));
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('$filename copied to clipboard'),
        action: SnackBarAction(
          label: 'OK',
          textColor: OrdoColors.primary,
          onPressed: () {},
        ),
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

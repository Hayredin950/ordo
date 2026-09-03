import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/alarm_provider.dart';
import '../themes/app_theme.dart';

/// Alarm settings for the focus timer, shared by the timer panel's bell button
/// and the Settings screen so there is only one place the wording lives.
void showAlarmSettingsSheet(BuildContext context) {
  showModalBottomSheet(
    context: context,
    backgroundColor: OrdoColors.surface,
    shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
    builder: (_) => const Padding(
      padding: EdgeInsets.fromLTRB(24, 24, 24, 32),
      child: AlarmSettings(),
    ),
  );
}

class AlarmSettings extends StatelessWidget {
  const AlarmSettings({super.key});

  @override
  Widget build(BuildContext context) {
    final alarm = context.watch<AlarmProvider>();

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Alarm',
            style: TextStyle(
                fontFamily: 'SpaceGrotesk', fontSize: 20, fontWeight: FontWeight.w700)),
        const SizedBox(height: 4),
        Text('Rings when a focus session ends, then gives up after 30 seconds.',
            style: TextStyle(fontSize: 12, color: OrdoColors.mutedForeground)),
        const SizedBox(height: 16),
        _ToggleRow(
          label: 'Alarm on finish',
          value: alarm.enabled,
          onChanged: alarm.setEnabled,
        ),
        _ToggleRow(
          label: 'Vibrate',
          value: alarm.vibrate,
          onChanged: alarm.setVibrate,
        ),
        const SizedBox(height: 16),
        Text('TONE',
            style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                letterSpacing: 1,
                color: OrdoColors.mutedForeground)),
        const SizedBox(height: 8),
        ...AlarmSound.values.map((tone) => _ToneRow(
              tone: tone,
              selected: alarm.sound == tone,
              onTap: () => alarm.setSound(tone),
            )),
      ],
    );
  }
}

class _ToggleRow extends StatelessWidget {
  final String label;
  final bool value;
  final ValueChanged<bool> onChanged;

  const _ToggleRow({required this.label, required this.value, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Text(label,
              style: const TextStyle(fontSize: 13, color: OrdoColors.foreground)),
        ),
        Switch(
          value: value,
          onChanged: onChanged,
          activeThumbColor: OrdoColors.primary,
        ),
      ],
    );
  }
}

class _ToneRow extends StatelessWidget {
  final AlarmSound tone;
  final bool selected;
  final VoidCallback onTap;

  const _ToneRow({required this.tone, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
        decoration: BoxDecoration(
          color: selected ? OrdoColors.primary.withValues(alpha: 0.10) : OrdoColors.card,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: selected ? OrdoColors.primary : OrdoColors.border,
            width: selected ? 1.5 : 1,
          ),
        ),
        child: Row(
          children: [
            Icon(
              selected ? Icons.check_circle : Icons.circle_outlined,
              size: 18,
              color: selected ? OrdoColors.primary : OrdoColors.mutedForeground,
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(tone.label,
                  style: const TextStyle(fontSize: 13, color: OrdoColors.foreground)),
            ),
            // Tapping the row already previews; this just says so.
            Icon(
              tone.asset == null ? Icons.vibration : Icons.play_arrow_rounded,
              size: 16,
              color: OrdoColors.mutedForeground,
            ),
          ],
        ),
      ),
    );
  }
}

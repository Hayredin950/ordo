import 'package:flutter/material.dart';
import '../themes/app_theme.dart';

const _minMinutes = 1;
const _maxMinutes = 180;

/// Asks for a session length in minutes. Returns null if dismissed.
Future<int?> showCustomDurationSheet(BuildContext context, int initialMinutes) {
  return showModalBottomSheet<int>(
    context: context,
    backgroundColor: OrdoColors.surface,
    shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
    builder: (_) => _CustomDurationSheet(initialMinutes: initialMinutes),
  );
}

class _CustomDurationSheet extends StatefulWidget {
  final int initialMinutes;

  const _CustomDurationSheet({required this.initialMinutes});

  @override
  State<_CustomDurationSheet> createState() => _CustomDurationSheetState();
}

class _CustomDurationSheetState extends State<_CustomDurationSheet> {
  late int _minutes = widget.initialMinutes.clamp(_minMinutes, _maxMinutes);

  void _nudge(int by) =>
      setState(() => _minutes = (_minutes + by).clamp(_minMinutes, _maxMinutes));

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 24, 24, 32),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Custom session',
              style: TextStyle(
                  fontFamily: 'SpaceGrotesk', fontSize: 20, fontWeight: FontWeight.w700)),
          const SizedBox(height: 4),
          Text('Anything from $_minMinutes to $_maxMinutes minutes.',
              style: TextStyle(fontSize: 12, color: OrdoColors.mutedForeground)),
          const SizedBox(height: 20),
          Center(
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.baseline,
              textBaseline: TextBaseline.alphabetic,
              children: [
                Text('$_minutes',
                    style: const TextStyle(
                        fontFamily: 'SpaceGrotesk',
                        fontSize: 44,
                        fontWeight: FontWeight.w700,
                        color: OrdoColors.foreground)),
                const SizedBox(width: 6),
                Text('min',
                    style: TextStyle(fontSize: 14, color: OrdoColors.mutedForeground)),
              ],
            ),
          ),
          const SizedBox(height: 8),
          Slider(
            value: _minutes.toDouble(),
            min: _minMinutes.toDouble(),
            max: _maxMinutes.toDouble(),
            divisions: _maxMinutes - _minMinutes,
            activeColor: OrdoColors.primary,
            inactiveColor: OrdoColors.border,
            onChanged: (v) => setState(() => _minutes = v.round()),
          ),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              _Nudge(label: '−5', onTap: () => _nudge(-5)),
              _Nudge(label: '−1', onTap: () => _nudge(-1)),
              _Nudge(label: '+1', onTap: () => _nudge(1)),
              _Nudge(label: '+5', onTap: () => _nudge(5)),
            ],
          ),
          const SizedBox(height: 20),
          SizedBox(
            width: double.infinity,
            height: 44,
            child: ElevatedButton(
              onPressed: () => Navigator.pop(context, _minutes),
              style: ElevatedButton.styleFrom(
                backgroundColor: OrdoColors.primary,
                foregroundColor: OrdoColors.primaryForeground,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
              child: Text('Set $_minutes min'),
            ),
          ),
        ],
      ),
    );
  }
}

class _Nudge extends StatelessWidget {
  final String label;
  final VoidCallback onTap;

  const _Nudge({required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 4),
        child: OutlinedButton(
          onPressed: onTap,
          style: OutlinedButton.styleFrom(
            foregroundColor: OrdoColors.foreground,
            side: BorderSide(color: OrdoColors.border),
            padding: const EdgeInsets.symmetric(vertical: 10),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          ),
          child: Text(label, style: const TextStyle(fontWeight: FontWeight.w600)),
        ),
      ),
    );
  }
}

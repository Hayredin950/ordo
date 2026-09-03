import 'dart:async';
import 'dart:math';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/alarm_provider.dart';
import '../themes/app_theme.dart';
import 'alarm_settings_sheet.dart';
import 'app_widgets.dart';
import 'duration_sheet.dart';

class _Preset {
  final String label;
  final int minutes;
  const _Preset(this.label, this.minutes);
}

const _presets = [
  _Preset('Deep work', 50),
  _Preset('Standard', 25),
  _Preset('Short', 15),
];

class FocusTimer extends StatefulWidget {
  const FocusTimer({super.key});

  @override
  State<FocusTimer> createState() => _FocusTimerState();
}

class _FocusTimerState extends State<FocusTimer> {
  static const _defaultTotal = 25 * 60;

  int _total = _defaultTotal;
  int _secondsLeft = _defaultTotal;

  /// Wall-clock finish line, non-null exactly while the timer runs. Counting
  /// down to a deadline rather than up from a tick count is what makes pause
  /// and resume behave — and it stays honest while the app is backgrounded.
  DateTime? _deadline;
  Timer? _tick;
  bool _finished = false;

  bool get _running => _deadline != null;
  bool get _isCustom => !_presets.any((p) => p.minutes * 60 == _total);

  @override
  void dispose() {
    _tick?.cancel();
    super.dispose();
  }

  // ── Timer logic ──────────────────────────────────────────────────────

  int _remaining() {
    final deadline = _deadline;
    if (deadline == null) return _secondsLeft;
    final ms = deadline.difference(DateTime.now()).inMilliseconds;
    return ms <= 0 ? 0 : (ms / 1000).ceil();
  }

  void _start() {
    _tick?.cancel();
    final from = _secondsLeft > 0 ? _secondsLeft : _total;
    setState(() {
      _finished = false;
      _secondsLeft = from;
      _deadline = DateTime.now().add(Duration(seconds: from));
    });
    _tick = Timer.periodic(const Duration(milliseconds: 200), (_) => _onTick());
  }

  void _pause() {
    _tick?.cancel();
    _tick = null;
    setState(() {
      _secondsLeft = _remaining();
      _deadline = null;
    });
  }

  void _onTick() {
    final left = _remaining();
    if (left <= 0) {
      _complete();
    } else if (left != _secondsLeft) {
      setState(() => _secondsLeft = left);
    }
  }

  void _complete() {
    _tick?.cancel();
    _tick = null;
    setState(() {
      _secondsLeft = 0;
      _deadline = null;
      _finished = true;
    });

    final alarm = context.read<AlarmProvider>();
    alarm.fire();
    if (!alarm.enabled) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: const Text("Time's up — log the block you just worked."),
      duration: const Duration(seconds: 10),
      action: SnackBarAction(label: 'Stop', onPressed: alarm.stop),
    ));
  }

  // ── Controls ─────────────────────────────────────────────────────────

  /// Everything that puts a fresh session on the clock silences a still-ringing
  /// alarm first, so the tone never bleeds into the next block.
  void _resetTo(int seconds) {
    _tick?.cancel();
    _tick = null;
    context.read<AlarmProvider>().stop();
    setState(() {
      _finished = false;
      _deadline = null;
      _total = seconds;
      _secondsLeft = seconds;
    });
  }

  void _toggle() {
    if (_running) {
      _pause();
    } else {
      context.read<AlarmProvider>().stop();
      _start();
    }
  }

  void _reset() => _resetTo(_total);

  void _select(int minutes) => _resetTo(minutes * 60);

  Future<void> _pickCustom() async {
    final minutes = await showCustomDurationSheet(context, _total ~/ 60);
    if (minutes != null && mounted) _select(minutes);
  }

  // ── Derived values ───────────────────────────────────────────────────

  String get _display {
    final m = (_secondsLeft ~/ 60).toString().padLeft(2, '0');
    final s = (_secondsLeft % 60).toString().padLeft(2, '0');
    return '$m:$s';
  }

  double get _elapsed => _total > 0 ? 1 - _secondsLeft / _total : 0;

  String get _buttonLabel {
    if (_running) return 'Pause';
    if (_finished) return 'Restart';
    if (_secondsLeft < _total) return 'Resume';
    return 'Start';
  }

  IconData get _buttonIcon =>
      _running ? Icons.pause_rounded : Icons.play_arrow_rounded;

  // ── Build ────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final alarm = context.watch<AlarmProvider>();

    return Panel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Title row
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Focus timer',
                        style: TextStyle(
                            fontFamily: 'SpaceGrotesk',
                            fontSize: 16,
                            fontWeight: FontWeight.w600,
                            color: OrdoColors.foreground)),
                    const SizedBox(height: 2),
                    Text('One block at a time — the timer is the task.',
                        style: TextStyle(
                            fontSize: 12, color: OrdoColors.mutedForeground)),
                  ],
                ),
              ),
              IconButton(
                tooltip: alarm.enabled ? 'Alarm: ${alarm.sound.label}' : 'Alarm off',
                onPressed: () => showAlarmSettingsSheet(context),
                icon: Icon(
                  alarm.enabled
                      ? Icons.notifications_active_outlined
                      : Icons.notifications_off_outlined,
                  size: 20,
                  color: alarm.ringing ? OrdoColors.primary : OrdoColors.mutedForeground,
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),

          // Presets plus Custom — four chips do not share a phone line.
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                ..._presets.map((p) => Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: _PresetChip(
                        label: p.label,
                        active: _total == p.minutes * 60,
                        onTap: () => _select(p.minutes),
                      ),
                    )),
                _PresetChip(
                  label: _isCustom ? 'Custom · ${_total ~/ 60}m' : 'Custom',
                  active: _isCustom,
                  icon: Icons.tune,
                  onTap: _pickCustom,
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // Timer ring + countdown
          Center(
            child: SizedBox(
              width: 144,
              height: 144,
              child: Stack(
                alignment: Alignment.center,
                children: [
                  SizedBox.expand(
                    child: CustomPaint(
                      painter: _RingPainter(
                        progress: 1.0,
                        color: OrdoColors.border,
                        strokeWidth: 8,
                      ),
                    ),
                  ),
                  SizedBox.expand(
                    child: CustomPaint(
                      painter: _RingPainter(
                        progress: _elapsed.clamp(0.0, 1.0),
                        color: _finished ? OrdoColors.destructive : OrdoColors.primary,
                        strokeWidth: 8,
                      ),
                    ),
                  ),
                  Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        _display,
                        style: const TextStyle(
                          fontFamily: 'SpaceGrotesk',
                          fontSize: 32,
                          fontWeight: FontWeight.w700,
                          color: OrdoColors.foreground,
                        ),
                      ),
                      if (_finished)
                        Text("Time's up",
                            style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                                color: OrdoColors.destructive))
                      else
                        Text('${_total ~/ 60} min session',
                            style: TextStyle(
                                fontSize: 11, color: OrdoColors.mutedForeground)),
                    ],
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),

          // Only shown while the alarm is actually sounding.
          if (alarm.ringing) ...[
            SizedBox(
              width: double.infinity,
              height: 40,
              child: ElevatedButton.icon(
                onPressed: alarm.stop,
                icon: const Icon(Icons.alarm_off_rounded, size: 20),
                label: const Text('Stop alarm'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: OrdoColors.destructive,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
              ),
            ),
            const SizedBox(height: 8),
          ],

          // Start / Pause + Reset
          Row(
            children: [
              Expanded(
                child: SizedBox(
                  height: 40,
                  child: ElevatedButton.icon(
                    onPressed: _toggle,
                    icon: Icon(_buttonIcon, size: 20),
                    label: Text(_buttonLabel),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: OrdoColors.primary,
                      foregroundColor: OrdoColors.primaryForeground,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8),
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: SizedBox(
                  height: 40,
                  child: OutlinedButton.icon(
                    onPressed: _reset,
                    icon: const Icon(Icons.replay_rounded, size: 20),
                    label: const Text('Reset'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: OrdoColors.mutedForeground,
                      side: BorderSide(color: OrdoColors.border),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8),
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // Hint text
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.timer_outlined,
                  size: 14, color: OrdoColors.mutedForeground),
              const SizedBox(width: 6),
              Text('Log the linked block when it\'s done.',
                  style: TextStyle(
                      fontSize: 12, color: OrdoColors.mutedForeground)),
            ],
          ),
        ],
      ),
    );
  }
}

// ── Helper widgets ─────────────────────────────────────────────────────

class _RingPainter extends CustomPainter {
  final double progress;
  final Color color;
  final double strokeWidth;

  _RingPainter({
    required this.progress,
    required this.color,
    required this.strokeWidth,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = (min(size.width, size.height) - strokeWidth) / 2;
    final arcRect = Rect.fromCircle(center: center, radius: radius);
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth
      ..strokeCap = StrokeCap.round;

    canvas.drawArc(arcRect, -pi / 2, 2 * pi * progress, false, paint);
  }

  @override
  bool shouldRepaint(_RingPainter old) =>
      old.progress != progress || old.color != color;
}

class _PresetChip extends StatelessWidget {
  final String label;
  final bool active;
  final IconData? icon;
  final VoidCallback onTap;

  const _PresetChip({
    required this.label,
    required this.active,
    required this.onTap,
    this.icon,
  });

  @override
  Widget build(BuildContext context) {
    final color = active ? OrdoColors.primary : OrdoColors.mutedForeground;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: active ? OrdoColors.primary.withValues(alpha: 0.15) : OrdoColors.muted,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: active ? OrdoColors.primary : OrdoColors.border,
            width: active ? 1.5 : 1,
          ),
        ),
        child: Row(
          children: [
            if (icon != null) ...[
              Icon(icon, size: 13, color: color),
              const SizedBox(width: 4),
            ],
            Text(
              label,
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: color,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

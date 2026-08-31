import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import '../themes/app_theme.dart';
import 'app_widgets.dart';

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

class _FocusTimerState extends State<FocusTimer> with TickerProviderStateMixin {
  static const _defaultTotal = 25 * 60;

  late int _total = _defaultTotal;
  late int _secondsLeft = _defaultTotal;
  bool _running = false;
  Ticker? _ticker;

  @override
  void dispose() {
    _ticker?.dispose();
    super.dispose();
  }

  // ── Timer logic ──────────────────────────────────────────────────────

  void _startTicker() {
    _ticker?.dispose();
    _ticker = createTicker(_onTick);
    _ticker!.start();
  }

  void _stopTicker() {
    _ticker?.stop();
  }

  void _onTick(Duration elapsed) {
    final elapsedSec = elapsed.inSeconds;
    final remaining = _total - elapsedSec;
    if (remaining <= 0) {
      setState(() {
        _secondsLeft = 0;
        _running = false;
      });
      _ticker?.stop();
    } else {
      setState(() => _secondsLeft = remaining);
    }
  }

  void _toggle() {
    setState(() {
      _running = !_running;
    });
    if (_running) {
      _startTicker();
    } else {
      _stopTicker();
    }
  }

  void _reset() {
    _stopTicker();
    setState(() {
      _running = false;
      _secondsLeft = _total;
    });
  }

  void _select(int minutes) {
    _stopTicker();
    setState(() {
      _running = false;
      _total = minutes * 60;
      _secondsLeft = minutes * 60;
    });
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
    if (_secondsLeft == 0) return 'Restart';
    return 'Start';
  }

  IconData get _buttonIcon =>
      _running ? Icons.pause_rounded : Icons.play_arrow_rounded;

  // ── Build ────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return Panel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Title row
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
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
            ],
          ),
          const SizedBox(height: 4),

          // Preset chips
          Row(
            children: _presets
                .map((p) => Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: _PresetChip(
                        label: p.label,
                        active: _total == p.minutes * 60,
                        onTap: () => _select(p.minutes),
                      ),
                    ))
                .toList(),
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
                  // Background ring
                  SizedBox.expand(
                    child: CustomPaint(
                      painter: _RingPainter(
                        progress: 1.0,
                        color: OrdoColors.border,
                        strokeWidth: 8,
                      ),
                    ),
                  ),
                  // Progress ring
                  SizedBox.expand(
                    child: CustomPaint(
                      painter: _RingPainter(
                        progress: _elapsed.clamp(0.0, 1.0),
                        color: OrdoColors.primary,
                        strokeWidth: 8,
                      ),
                    ),
                  ),
                  // Time display
                  Text(
                    _display,
                    style: const TextStyle(
                      fontFamily: 'SpaceGrotesk',
                      fontSize: 32,
                      fontWeight: FontWeight.w700,
                      color: OrdoColors.foreground,
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),

          // Start / Pause + Reset buttons
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
  final VoidCallback onTap;

  const _PresetChip({
    required this.label,
    required this.active,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
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
        child: Text(
          label,
          style: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w600,
            color: active ? OrdoColors.primary : OrdoColors.mutedForeground,
          ),
        ),
      ),
    );
  }
}

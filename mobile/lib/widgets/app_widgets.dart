import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/categories_provider.dart';

class Panel extends StatelessWidget {
  final Widget? child;
  final EdgeInsetsGeometry? padding;
  final Color? color;
  final double? borderRadius;
  final VoidCallback? onTap;
  final EdgeInsetsGeometry? margin;

  const Panel({
    super.key,
    this.child,
    this.padding,
    this.color,
    this.borderRadius,
    this.onTap,
    this.margin,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: margin,
        padding: padding ?? const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: color ?? theme.cardColor,
          border: Border.all(color: theme.dividerColor, width: 1),
          borderRadius: BorderRadius.circular(borderRadius ?? 16),
        ),
        child: child,
      ),
    );
  }
}

class PanelTitle extends StatelessWidget {
  final String title;
  final String? hint;
  final Widget? action;

  const PanelTitle({
    super.key,
    required this.title,
    this.hint,
    this.action,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (action != null) action!,
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Expanded(
              child: Text(title, style: const TextStyle(fontFamily: 'SpaceGrotesk', fontSize: 18, fontWeight: FontWeight.w600, color: Color(0xFFF0EEE9))),
            ),
            if (action != null) const SizedBox(width: 8),
          ],
        ),
        if (hint != null) ...[
          const SizedBox(height: 4),
          Text(hint!, style: TextStyle(fontSize: 12, color: const Color(0xFF9498A2))),
        ],
      ],
    );
  }
}

class CategoryPill extends StatelessWidget {
  final String id;
  final bool showIcon;

  const CategoryPill({super.key, required this.id, this.showIcon = false});

  @override
  Widget build(BuildContext context) {
    final cats = context.read<CategoriesProvider>();
    final color = _parseColor(cats.categoryColor(id));
    final label = cats.categoryLabel(id);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.18),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        if (showIcon) ...[
          Icon(Icons.circle, size: 10, color: color),
          const SizedBox(width: 4),
        ],
        Text(label, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w500, color: color)),
      ]),
    );
  }

  Color _parseColor(String hex) {
    final s = hex.replaceAll('#', '');
    return Color(int.parse(s.padLeft(6, '0'), radix: 16) + 0xFF000000);
  }
}

class CategoryDot extends StatelessWidget {
  final String id;

  const CategoryDot({super.key, required this.id});

  @override
  Widget build(BuildContext context) {
    final cats = context.read<CategoriesProvider>();
    final color = _parseColor(cats.categoryColor(id));
    return Container(width: 10, height: 10, decoration: BoxDecoration(color: color, shape: BoxShape.circle));
  }

  Color _parseColor(String hex) {
    final s = hex.replaceAll('#', '');
    return Color(int.parse(s.padLeft(6, '0'), radix: 16) + 0xFF000000);
  }
}

class Stat extends StatelessWidget {
  final String value;
  final String label;

  const Stat({super.key, required this.value, required this.label});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      decoration: BoxDecoration(
        color: Theme.of(context).cardColor,
        border: Border.all(color: Theme.of(context).dividerColor, width: 1),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(value, style: const TextStyle(fontFamily: 'SpaceGrotesk', fontSize: 22, fontWeight: FontWeight.w700, color: Color(0xFFF0EEE9))),
          const SizedBox(height: 2),
          Text(label, style: TextStyle(fontSize: 11, color: const Color(0xFF9498A2), height: 1.3)),
        ],
      ),
    );
  }
}

class SegButton extends StatelessWidget {
  final bool active;
  final VoidCallback onPressed;
  final String label;

  const SegButton({
    super.key,
    required this.active,
    required this.onPressed,
    required this.label,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onPressed,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: active ? Theme.of(context).colorScheme.primary : Theme.of(context).cardColor,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: active ? Theme.of(context).colorScheme.primary : Theme.of(context).dividerColor,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w500,
            color: active ? Theme.of(context).colorScheme.onPrimary : const Color(0xFF9498A2),
          ),
        ),
      ),
    );
  }
}

class ProgressRing extends StatelessWidget {
  final double value;
  final String label;
  final double size;
  final double strokeWidth;

  const ProgressRing({
    super.key,
    required this.value,
    this.label = '',
    this.size = 80,
    this.strokeWidth = 7,
  });

  @override
  Widget build(BuildContext context) {
    final pct = (value / 100).clamp(0.0, 1.0);
    return SizedBox(
      width: size,
      height: size,
      child: Stack(
        alignment: Alignment.center,
        children: [
          CustomPaint(
            size: Size(size, size),
            painter: _RingPainter(progress: 1.0, strokeWidth: strokeWidth, color: const Color(0xFF2A2E36)),
          ),
          CustomPaint(
            size: Size(size, size),
            painter: _RingPainter(progress: pct, strokeWidth: strokeWidth, color: Theme.of(context).colorScheme.primary),
          ),
          Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                '${value.toInt()}%',
                style: const TextStyle(fontFamily: 'SpaceGrotesk', fontSize: 18, fontWeight: FontWeight.w700, color: Color(0xFFF0EEE9)),
              ),
              if (label.isNotEmpty) Text(label, style: TextStyle(fontSize: 10, color: const Color(0xFF9498A2))),
            ],
          ),
        ],
      ),
    );
  }
}

class _RingPainter extends CustomPainter {
  final double progress;
  final double strokeWidth;
  final Color color;

  _RingPainter({required this.progress, required this.strokeWidth, required this.color});

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = (math.min(size.width, size.height) / 2) - strokeWidth;
    final rect = Rect.fromCircle(center: center, radius: radius);
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth
      ..strokeCap = StrokeCap.round;
    canvas.drawArc(rect, -math.pi / 2, 2 * math.pi * progress, false, paint);
  }

  @override
  bool shouldRepaint(covariant _RingPainter oldDelegate) =>
      color != oldDelegate.color ||
      strokeWidth != oldDelegate.strokeWidth ||
      progress != oldDelegate.progress;
}

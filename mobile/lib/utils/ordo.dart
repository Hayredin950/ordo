import '../models/ordo_state.dart';

String dateKey(DateTime d) =>
    '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

int dayOfWeek(DateTime d) => d.weekday % 7;

DateTime addDays(DateTime d, int n) => DateTime(d.year, d.month, d.day + n);

DateTime startOfWeek(DateTime d) => addDays(d, -(d.weekday % 7));

String formatTime(String hhmm, {bool hour12 = false}) {
  final m = RegExp(r'^(\d{1,2}):(\d{2})').firstMatch(hhmm);
  if (m == null) return hhmm;
  final hours = int.parse(m.group(1)!);
  final minutes = m.group(2)!;
  if (!hour12) return '${hours.toString().padLeft(2, '0')}:$minutes';
  final suffix = hours < 12 ? 'AM' : 'PM';
  final h12 = hours % 12 == 0 ? 12 : hours % 12;
  return '$h12:$minutes $suffix';
}

String formatTimeRange(String start, String end, {bool hour12 = false}) {
  if (hour12) {
    return '${formatTime(start, hour12: true)} – ${formatTime(end, hour12: true)}';
  }
  return '${formatTime(start)}–${formatTime(end)}';
}

List<Block> blocksFor(OrdoState state, DateTime d) {
  final key = dateKey(d);
  final list = state.overrides[key] ?? state.routine[dayOfWeek(d)] ?? [];
  return List<Block>.from(list)..sort((a, b) => a.start.compareTo(b.start));
}

int dayScore(OrdoState state, DateTime d) {
  final blocks = blocksFor(state, d);
  if (blocks.isEmpty) return -1;
  final entries = state.log[dateKey(d)] ?? {};
  final total = blocks.fold(0, (sum, blk) => sum + (entries[blk.id] ?? 0));
  return (total / blocks.length).round();
}

int rangeScore(OrdoState state, DateTime from, int days) {
  var sum = 0;
  var n = 0;
  for (var i = 0; i < days; i++) {
    final s = dayScore(state, addDays(from, i));
    if (s >= 0) {
      sum += s;
      n++;
    }
  }
  return n > 0 ? (sum / n).round() : 0;
}

Streak streak(OrdoState state) {
  var current = 0;
  var best = 0;
  var run = 0;
  for (var i = 120; i >= 0; i--) {
    final s = dayScore(state, addDays(DateTime.now(), -i));
    if (s >= 70) {
      run++;
      if (run > best) best = run;
    } else if (s >= 0) {
      run = 0;
    }
    if (i == 0 || run > 0) current = run;
  }
  return Streak(current: current, best: best);
}

Map<String, dynamic> categoryBreakdown(OrdoState state, List<Category> cats, {int days = 28}) {
  final acc = <String, Map<String, double>>{};
  for (var i = 0; i < days; i++) {
    final d = addDays(DateTime.now(), -i);
    final key = dateKey(d);
    final entries = state.log[key] ?? {};
    for (final blk in blocksFor(state, d)) {
      if (!acc.containsKey(blk.category)) {
        acc[blk.category] = {'sum': 0, 'n': 0};
      }
      acc[blk.category]!['sum'] = (acc[blk.category]!['sum'] ?? 0) + (entries[blk.id] ?? 0);
      acc[blk.category]!['n'] = (acc[blk.category]!['n'] ?? 0) + 1;
    }
  }
  final known = cats.map((c) => {'id': c.id, 'label': c.label}).toList();
  final extra = acc.keys.where((id) => !cats.any((c) => c.id == id)).map((id) => {'id': id, 'label': id}).toList();
  return {
    'cats': [...known, ...extra].map((c) => {
      'category': c['label'],
      'id': c['id'],
      'value': (acc[c['id']]?['n'] ?? 0) > 0 ? (((acc[c['id']]?['sum'] ?? 0) / (acc[c['id']]?['n'] ?? 1)).round()) : 0,
    }).toList(),
  };
}

List<Map<String, dynamic>> missedDebt(OrdoState state) {
  final out = <Map<String, dynamic>>[];
  for (var i = 1; i <= 14; i++) {
    final d = addDays(DateTime.now(), -i);
    final entries = state.log[dateKey(d)] ?? {};
    for (final blk in blocksFor(state, d)) {
      if (blk.priority == 'must' && (entries[blk.id] ?? 0) < 50) {
        out.add({'date': dateKey(d), 'block': blk});
      }
    }
  }
  return out.take(8).toList();
}

Block newBlock() => Block(
  id: DateTime.now().millisecondsSinceEpoch.toString(),
  title: 'New block',
  start: '08:00',
  end: '09:00',
  category: 'work',
  priority: 'must',
);

List<Block> cloneBlocks(List<Block> blocks) => blocks.map((b) => b.copyWith(id: DateTime.now().millisecondsSinceEpoch.toString())).toList();

Streak streakFromState(OrdoState state) => streak(state);

class Streak {
  final int current;
  final int best;
  const Streak({required this.current, required this.best});
}

class HourFormat {
  static const twentyFour = '24h';
  static const twelve = '12h';
}

String hourFormatOf(OrdoState? state) => state?.settings?.hourFormat ?? '24h';

bool isHour12(OrdoState? state) => hourFormatOf(state) == '12h';

List<Map<String, dynamic>> weeklyCompletion(OrdoState state) {
  final out = <Map<String, dynamic>>[];
  for (var w = 9; w >= 0; w--) {
    final from = startOfWeek(addDays(DateTime.now(), -7 * w));
    out.add({
      'label': '${from.month}/${from.day}',
      'value': rangeScore(state, from, 7).toDouble(),
    });
  }
  return out;
}

List<Map<String, dynamic>> categoryBalance(OrdoState state, List<Category> cats) {
  final cats2 = categoryBreakdown(state, cats);
  return (cats2['cats'] as List).map((e) => {'category': e['category'], 'id': e['id'], 'value': (e['value'] as num).toDouble()}).toList();
}

Map<String, dynamic> yearInReview(OrdoState state, List<Category> cats) {
  final days = 365;
  var sum = 0.0;
  var n = 0;
  var bestWeek = 0;
  for (var i = days - 1; i >= 0; i--) {
    final s = dayScore(state, addDays(DateTime.now(), -i));
    if (s >= 0) {
      sum += s;
      n++;
    }
  }
  for (var w = 51; w >= 0; w--) {
    final ws = rangeScore(state, startOfWeek(addDays(DateTime.now(), -7 * w)), 7);
    if (ws > bestWeek) bestWeek = ws;
  }
  final cats2 = categoryBreakdown(state, cats, days: 365);
  final catList = (cats2['cats'] as List).cast<Map<String, dynamic>>();
  String? mostConsistentLabel;
  if (catList.isNotEmpty) {
    var bestVal = -1;
    for (final c in catList) {
      final v = (c['value'] as num).toInt();
      if (v > bestVal) {
        bestVal = v;
        mostConsistentLabel = c['category'] as String?;
      }
    }
  }
  final avg = n > 0 ? (sum / n).round() : 0;
  return {
    'avg': avg,
    'bestWeek': bestWeek,
    'mostConsistent': mostConsistentLabel ?? '—',
    'daysTracked': n,
    'isNew': n < 7,
    'avgDouble': n > 0 ? (sum / n) : 0.0,
  };
}

Map<String, dynamic> badges(Streak s, int month) {
  final earned = <String>[];
  if (s.best >= 7) earned.add('7-day streak');
  if (s.best >= 30) earned.add('30-day streak');
  if (s.best >= 60) earned.add('60-day streak');
  if (month >= 70) earned.add('70% month');
  if (s.current >= 3 && month < 40) earned.add('Comeback');
  return {'earned': earned, 'current': s.current, 'best': s.best};
}

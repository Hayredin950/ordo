import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart' as supa;
import '../models/ordo_state.dart';

class OrdoProvider extends ChangeNotifier {
  final _client = supa.Supabase.instance.client;
  OrdoState? _state;
  bool _loading = true;
  bool _dirty = false;

  OrdoState? get state => _state;
  bool get loading => _loading;

  supa.User? get _user => _client.auth.currentUser;

  Future<void> init() async {
    _loading = true;
    notifyListeners();

    if (_user == null) {
      _state = defaultState();
      _loading = false;
      notifyListeners();
      return;
    }

    await _loadFromSupabase();
    _loading = false;
    notifyListeners();
  }

  Future<void> _loadFromSupabase() async {
    try {
      final res = await _client
          .from('user_state')
          .select('state')
          .eq('user_id', _user!.id)
          .maybeSingle();

      if (res != null && res['state'] != null) {
        _state = OrdoState.fromJson(res['state'] as Map<String, dynamic>);
      } else {
        _state = defaultState();
        await _saveToSupabase();
      }
    } catch (e) {
      _state = defaultState();
    }
  }

  Future<void> _saveToSupabase() async {
    if (_state == null || _user == null) return;
    try {
      await _client.from('user_state').upsert({
        'user_id': _user!.id,
        'state': _state!.toJson(),
      });
    } catch (e) {
      debugPrint('Failed to save state: $e');
    }
  }

  void update(OrdoState Function(OrdoState) fn) {
    _state = fn(_state!);
    _dirty = true;
    notifyListeners();
    _debounceSave();
  }

  Future<void> _debounceSave() async {
    await Future.delayed(const Duration(milliseconds: 500));
    if (_dirty) {
      _dirty = false;
      await _saveToSupabase();
    }
  }

  void reset() {
    _state = defaultState();
    notifyListeners();
    _saveToSupabase();
  }

  Future<void> reload() async {
    _loading = true;
    notifyListeners();
    await _loadFromSupabase();
    _loading = false;
    notifyListeners();
  }

  void setLocalState() {
    _state = defaultState();
    _loading = false;
    notifyListeners();
  }
}

OrdoState defaultState() {
  final routine = <int, List<Block>>{};
  final weekday = [
    Block(id: 'wb1', title: 'Fajr + reflection', start: '05:30', end: '06:00', category: 'spiritual', priority: 'must'),
    Block(id: 'wb2', title: 'Workout', start: '06:00', end: '07:00', category: 'health', priority: 'must'),
    Block(id: 'wb3', title: 'Deep work block', start: '09:00', end: '11:30', category: 'work', priority: 'must'),
    Block(id: 'wb4', title: 'Study: algorithms', start: '14:00', end: '16:00', category: 'study', priority: 'must'),
    Block(id: 'wb5', title: 'Read 30 pages', start: '21:00', end: '22:00', category: 'study', priority: 'nice'),
  ];
  final weekend = [
    Block(id: 'we1', title: 'Long run', start: '07:00', end: '08:30', category: 'health', priority: 'must'),
    Block(id: 'we2', title: 'Weekly review', start: '10:00', end: '11:00', category: 'work', priority: 'must'),
    Block(id: 'we3', title: 'Family time', start: '16:00', end: '18:00', category: 'relationships', priority: 'nice'),
    Block(id: 'we4', title: 'Budget check', start: '19:00', end: '19:30', category: 'finance', priority: 'nice'),
  ];
  for (var i = 0; i < 7; i++) {
    routine[i] = i == 0 || i == 6
        ? weekend.map((b) => b.copyWith(id: '${b.id}_${DateTime.now().millisecondsSinceEpoch}')).toList()
        : weekday.map((b) => b.copyWith(id: '${b.id}_${DateTime.now().millisecondsSinceEpoch}')).toList();
  }

  final goals = [
    Goal(id: 'g-year', title: 'Become undeniably disciplined', period: 'year', category: 'work', target: 80),
    Goal(id: 'g-sem', title: 'Ship Ordo + pass semester', period: 'semester', category: 'study', target: 85, parentId: 'g-year'),
    Goal(id: 'g-month', title: 'Train 20 days this month', period: 'month', category: 'health', target: 75, parentId: 'g-sem'),
    Goal(id: 'g-week', title: '10h focused study', period: 'week', category: 'study', target: 90, parentId: 'g-month'),
  ];

  return OrdoState(
    routine: routine,
    overrides: {},
    log: {},
    journal: {},
    goals: goals,
    templates: [],
    settings: const Settings(hourFormat: '24h'),
  );
}

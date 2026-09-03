import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:supabase_flutter/supabase_flutter.dart' as supa;
import '../models/ordo_state.dart';
import '../utils/ordo.dart';
import 'db.dart';

/// The 12h/24h preference, watched so flipping it in Settings repaints every
/// clock on screen. Documents written before preferences existed carry no
/// `settings` key; those read as 24h.
bool hour12Of(BuildContext context) =>
    isHour12(context.watch<OrdoProvider>().state);

class OrdoProvider extends ChangeNotifier {
  final _client = supa.Supabase.instance.client;
  OrdoState? _state;
  bool _loading = true;
  Timer? _saveTimer;

  /// True once a signed-in load has actually come back from Postgres. Until it
  /// does, `_state` is the demo document, and pushing that up would overwrite
  /// the real one — so saves stay off.
  bool _synced = false;

  /// Documents that [undo] stepped away from, newest last. The undo history
  /// itself lives in Postgres; this branch is session-scoped, so redo is
  /// available until the app closes, not across devices.
  final List<OrdoState> _redoStack = [];
  static const _redoLimit = 30;

  OrdoState? get state => _state;
  bool get loading => _loading;
  bool get canRedo => _redoStack.isNotEmpty;

  supa.User? get _user => _client.auth.currentUser;

  @override
  void dispose() {
    _saveTimer?.cancel();
    super.dispose();
  }

  Future<void> init() async {
    _loading = true;
    notifyListeners();

    if (_user == null) {
      _state = defaultState();
      _synced = false;
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

      _synced = true;
      if (res != null && res['state'] != null) {
        _state = OrdoState.fromJson(res['state'] as Map<String, dynamic>);
      } else {
        // No document yet — adopt the local one, same as the web does.
        _state ??= defaultState();
        await _saveToSupabase();
      }
    } catch (e) {
      debugPrint('[sync] load failed: $e');
      _state ??= defaultState();
      _synced = false;
    }
  }

  /// Writes go through `save_state()`, which also pushes the outgoing document
  /// onto the undo stack. The client has no INSERT/UPDATE privilege on
  /// `user_state`, so a direct upsert here would be denied.
  Future<void> _saveToSupabase() async {
    if (_state == null || _user == null || !_synced) return;
    try {
      await _client.rpc('save_state', params: {'p_state': _state!.toJson()});
    } catch (e) {
      debugPrint('[sync] save failed: $e');
    }
  }

  void update(OrdoState Function(OrdoState) fn) {
    _state = fn(_state!);
    // A fresh edit abandons whatever branch redo was holding.
    _redoStack.clear();
    notifyListeners();
    _debounceSave();
  }

  void _debounceSave() {
    if (_user == null || !_synced) return;
    _saveTimer?.cancel();
    _saveTimer = Timer(const Duration(milliseconds: 600), _saveToSupabase);
  }

  /// Pops the server-side history via `undo_state()` and remembers the document
  /// we left, so [redo] can put it back. False means there was nothing to undo.
  Future<bool> undo() async {
    final before = _state;
    if (before == null) return false;

    final doc = await OrdoDb.undoState();
    if (doc == null) return false;

    // The server document has already moved; a pending save would push the
    // pre-undo document straight back.
    _saveTimer?.cancel();
    _redoStack.add(before);
    if (_redoStack.length > _redoLimit) _redoStack.removeAt(0);
    _state = OrdoState.fromJson(doc);
    notifyListeners();
    return true;
  }

  /// Re-applies the most recently undone document. It saves through the normal
  /// path, so the document it replaces lands back on the undo stack.
  Future<bool> redo() async {
    if (_redoStack.isEmpty) return false;
    _saveTimer?.cancel();
    _state = _redoStack.removeLast();
    notifyListeners();
    await _saveToSupabase();
    return true;
  }

  void reset() {
    _state = defaultState();
    _redoStack.clear();
    notifyListeners();
    _debounceSave();
  }

  Future<void> reload() async {
    _loading = true;
    notifyListeners();
    await _loadFromSupabase();
    _loading = false;
    notifyListeners();
  }

  void setLocalState() {
    _saveTimer?.cancel();
    _state = defaultState();
    _redoStack.clear();
    _synced = false;
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

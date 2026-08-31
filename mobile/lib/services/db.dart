import 'package:supabase_flutter/supabase_flutter.dart';

class OrdoDb {
  static final _client = Supabase.instance.client;

  static User? get _user => _client.auth.currentUser;

  // --- Peers ---
  static Future<List<Map<String, dynamic>>> listPeers() async {
    if (_user == null) return [];
    try {
      final res = await _client.rpc('peer_progress');
      return List<Map<String, dynamic>>.from(res);
    } catch (_) {
      return [];
    }
  }

  static Future<void> pairWithEmail(String email) async {
    await _client.rpc('pair_with_email', params: {'target_email': email});
  }

  static Future<void> unpair(String peerId) async {
    await _client.rpc('unpair', params: {'target_user': peerId});
  }

  // --- Challenges ---
  static Future<List<Map<String, dynamic>>> listChallenges() async {
    if (_user == null) return [];
    try {
      final res = await _client.rpc('list_challenges');
      return List<Map<String, dynamic>>.from(res);
    } catch (_) {
      return [];
    }
  }

  static Future<void> createChallenge(String name, String startsOn, String endsOn) async {
    await _client.rpc('create_challenge', params: {
      'p_name': name,
      'p_starts_on': startsOn,
      'p_ends_on': endsOn,
    });
  }

  static Future<void> joinChallenge(String challengeId) async {
    await _client.rpc('join_challenge', params: {'p_challenge': challengeId});
  }

  static Future<Map<String, dynamic>> challengeLeaderboard(String challengeId) async {
    try {
      final res = await _client.rpc('challenge_leaderboard', params: {'p_challenge': challengeId});
      if (res is Map) return Map<String, dynamic>.from(res);
      // If it returns a list, wrap it
      return {'leaderboard': List<Map<String, dynamic>>.from(res as List), 'myRank': null};
    } catch (_) {
      return {'leaderboard': [], 'myRank': null};
    }
  }

  // --- Future Letters ---
  static Future<List<Map<String, dynamic>>> listLetters() async {
    if (_user == null) return [];
    try {
      final res = await _client
          .from('future_letters')
          .select()
          .order('created_at', ascending: false);
      return List<Map<String, dynamic>>.from(res);
    } catch (_) {
      return [];
    }
  }

  static Future<void> createLetter(String goalTitle, String body, String deadline) async {
    await _client.from('future_letters').insert({
      'user_id': _user!.id,
      'goal_title': goalTitle,
      'body': body,
      'deadline': deadline,
    });
  }

  static Future<void> deleteLetter(String id) async {
    await _client.from('future_letters').delete().eq('id', id);
  }

  // --- Public Templates ---
  static Future<List<Map<String, dynamic>>> listPublicTemplates() async {
    if (_user == null) return [];
    try {
      final res = await _client
          .from('public_templates')
          .select()
          .order('copies', ascending: false);
      return List<Map<String, dynamic>>.from(res);
    } catch (_) {
      return [];
    }
  }

  static Future<void> publishTemplate(String name, List<dynamic> blocks) async {
    await _client.rpc('publish_template', params: {
      'p_name': name,
      'p_blocks': blocks,
    });
  }

  static Future<void> copyPublicTemplate(String templateId) async {
    await _client.rpc('copy_public_template', params: {
      'p_template': templateId,
    });
  }

  // --- Announcements ---
  static Future<List<Map<String, dynamic>>> listAnnouncements() async {
    if (_user == null) return [];
    try {
      final res = await _client
          .from('announcements')
          .select()
          .eq('active', true)
          .order('created_at', ascending: false);
      return List<Map<String, dynamic>>.from(res);
    } catch (_) {
      return [];
    }
  }

  // --- Categories (admin) ---
  static Future<List<Map<String, dynamic>>> listCategories() async {
    try {
      final res = await _client
          .from('app_categories')
          .select()
          .order('sort');
      return List<Map<String, dynamic>>.from(res);
    } catch (_) {
      return [];
    }
  }

  // --- Account ---
  static Future<void> deleteAccount() async {
    if (_user == null) throw Exception('Not logged in');
    await _client.rpc('delete_account');
  }

  // --- Undo ---
  static Future<bool> undoState() async {
    if (_user == null) return false;
    try {
      await _client.rpc('undo_state');
      return true;
    } catch (_) {
      return false;
    }
  }
}

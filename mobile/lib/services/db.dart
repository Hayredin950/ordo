import 'package:supabase_flutter/supabase_flutter.dart';

/// A row of `telegram_links` — the chat this account is bound to.
class TelegramLink {
  final String chatId;
  final String username;

  const TelegramLink({required this.chatId, required this.username});
}

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
    await _client.rpc('pair_with_email', params: {'p_email': email});
  }

  static Future<void> unpair(String peerId) async {
    await _client.rpc('unpair', params: {'p_peer': peerId});
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

  /// `create_challenge` takes a length in days and derives the dates itself;
  /// it rejects anything outside 7–90.
  static Future<void> createChallenge(String name, int days) async {
    await _client.rpc('create_challenge', params: {
      'p_name': name,
      'p_days': days,
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
      'p_id': templateId,
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

  // --- Notification channels ---
  static Future<TelegramLink?> telegramLink() async {
    if (_user == null) return null;
    try {
      final res = await _client
          .from('telegram_links')
          .select('chat_id, username')
          .maybeSingle();
      if (res == null) return null;
      return TelegramLink(
        chatId: '${res['chat_id']}',
        username: (res['username'] as String?) ?? '',
      );
    } catch (_) {
      return null;
    }
  }

  /// Mints a single-use code; the bot redeems it when the user sends
  /// `/link CODE`. Expires after 15 minutes, server-side.
  static Future<String> createTelegramCode() async {
    if (_user == null) throw Exception('Not logged in');
    final res = await _client.rpc('create_telegram_code');
    return '$res';
  }

  static Future<void> unlinkTelegram() async {
    if (_user == null) return;
    await _client.from('telegram_links').delete().eq('user_id', _user!.id);
  }

  static Future<String?> slackLink() async {
    if (_user == null) return null;
    try {
      final res = await _client.from('slack_links').select('channel').maybeSingle();
      return res?['channel'] as String?;
    } catch (_) {
      return null;
    }
  }

  static Future<String> linkSlack(String channel) async {
    if (_user == null) throw Exception('Not logged in');
    final trimmed = channel.trim();
    final res = await _client
        .from('slack_links')
        .upsert(
          {'user_id': _user!.id, 'channel': trimmed.startsWith('#') ? trimmed : '#$trimmed'},
          onConflict: 'user_id',
        )
        .select('channel')
        .single();
    return res['channel'] as String;
  }

  static Future<void> unlinkSlack() async {
    if (_user == null) return;
    await _client.from('slack_links').delete().eq('user_id', _user!.id);
  }

  // --- Onboarding ---
  /// Records progress for reporting; `set_onboarding` only ever flips flags to
  /// true, and a null argument leaves that flag alone. Failures are swallowed —
  /// the checklist reads live state, so this is bookkeeping only.
  static Future<void> setOnboarding({
    bool? goalSet,
    bool? routineSet,
    bool? telegramLinked,
  }) async {
    if (_user == null) return;
    try {
      await _client.rpc('set_onboarding', params: {
        'p_goal_set': goalSet,
        'p_routine_set': routineSet,
        'p_telegram_linked': telegramLinked,
      });
    } catch (_) {
      // Bookkeeping only — never surface this.
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

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

  // --- Accountability pairing ---
  /// `get_accountability_partners` is the same privacy shape `peer_progress`
  /// had — a name, an address and one weekly percentage, never a task — plus
  /// `paired_at`. Note the key is `weekly`: this screen used to read
  /// `weekly_pct`, which no version of either function has ever returned, so
  /// every partner showed 0%.
  static Future<List<Map<String, dynamic>>> listPeers() async {
    if (_user == null) return [];
    try {
      final res = await _client.rpc('get_accountability_partners');
      return List<Map<String, dynamic>>.from(res as List);
    } catch (_) {
      return [];
    }
  }

  /// Pending invites in both directions: `direction` is 'incoming' or
  /// 'outgoing'. Reading `pairing_requests` directly no longer works — the
  /// table is RLS-locked and has no policy, by design.
  static Future<List<Map<String, dynamic>>> listPairingRequests() async {
    if (_user == null) return [];
    try {
      final res = await _client.rpc('list_pairing_requests');
      return List<Map<String, dynamic>>.from(res as List);
    } catch (_) {
      return [];
    }
  }

  /// Sends an invite. It does **not** pair anyone: the target has to accept.
  /// The result is identical whether or not that address has an Ordo account,
  /// so this cannot be used to find out who is registered.
  static Future<void> pairWithEmail(String email) async {
    await _client.rpc('pair_with_email', params: {'p_email': email});
  }

  static Future<void> respondToPairingRequest(String requestId, String response) async {
    await _client.rpc('respond_to_pairing_request', params: {
      'p_request_id': requestId,
      'p_response': response,
    });
  }

  static Future<void> cancelPairingRequest(String requestId) async {
    await _client.rpc('cancel_pairing_request', params: {'p_request_id': requestId});
  }

  static Future<void> unpair(String peerId) async {
    await _client.rpc('unpair_user', params: {'p_peer': peerId});
  }

  // --- Challenges ---
  /// Each row carries `status` (derived from the dates server-side, so it can
  /// never go stale), `day_index`/`total_days`, `my_score`, and `invite_code`
  /// when you are the owner or a member.
  static Future<List<Map<String, dynamic>>> listChallenges() async {
    if (_user == null) return [];
    try {
      final res = await _client.rpc('list_challenges');
      return List<Map<String, dynamic>>.from(res as List);
    } catch (_) {
      return [];
    }
  }

  /// PostgREST picks the overload by the keys sent, so passing all eight lands
  /// on the full signature rather than the two-argument compatibility shim.
  static Future<void> createChallenge(
    String name,
    int days, {
    String category = 'general',
    bool private = false,
    int minDailyMinutes = 30,
  }) async {
    final start = DateTime.now();
    final end = start.add(Duration(days: days < 2 ? 30 : days));
    await _client.rpc('create_challenge', params: {
      'p_name': name,
      'p_category': category,
      'p_description': '',
      'p_start_at': start.toUtc().toIso8601String(),
      'p_end_at': end.toUtc().toIso8601String(),
      'p_visibility': private ? 'private' : 'public',
      'p_max_participants': null,
      'p_min_daily_minutes': minDailyMinutes,
    });
  }

  static Future<void> joinChallenge(String challengeId) async {
    await _client.rpc('join_challenge', params: {'p_challenge': challengeId});
  }

  /// Returns the id of the challenge the code opened, so the caller can scroll
  /// to it. Case and surrounding space are forgiven server-side.
  static Future<String> joinChallengeByCode(String code) async {
    final res = await _client.rpc('join_challenge_by_code', params: {'p_code': code});
    return '$res';
  }

  /// Leaving is not an erase: the row stays on the leaderboard flagged
  /// `has_left`, so walking out of a bad run does not delete the score.
  static Future<void> leaveChallenge(String challengeId) async {
    await _client.rpc('leave_challenge', params: {'p_challenge': challengeId});
  }

  /// Owner only. A cancelled challenge is stamped but never scored — null reads
  /// as "no result", where a 0 would read as "everyone failed".
  static Future<void> cancelChallenge(String challengeId) async {
    await _client.rpc('cancel_challenge', params: {'p_challenge': challengeId});
  }

  /// Top five plus your own row, with the ranks the server computed. Ties share
  /// a rank, so a position in this list is not a rank — 0005 declared
  /// `rank integer` while returning rank()'s bigint, which made the whole call
  /// raise 42804, and this screen quietly rendered an empty board instead.
  static Future<Map<String, dynamic>> challengeLeaderboard(String challengeId) async {
    try {
      final res = await _client.rpc('get_challenge_leaderboard', params: {
        'p_challenge': challengeId,
      });
      final rows = List<Map<String, dynamic>>.from(res as List);
      Map<String, dynamic>? mine;
      for (final r in rows) {
        if (r['is_me'] == true) {
          mine = r;
          break;
        }
      }
      return {
        'leaderboard': rows,
        'myRank': mine?['rank'],
        'totalMembers': rows.isEmpty ? 0 : rows.first['total_members'] ?? rows.length,
      };
    } catch (_) {
      return {'leaderboard': <Map<String, dynamic>>[], 'myRank': null, 'totalMembers': 0};
    }
  }

  /// Your own three components, so the card can say *why* a score is what it
  /// is. Scoped to the caller: a peer's breakdown would leak how they spend
  /// their days. Null when you are not a member.
  static Future<Map<String, dynamic>?> challengeBreakdown(String challengeId) async {
    try {
      final res = await _client.rpc('get_challenge_breakdown', params: {
        'p_challenge': challengeId,
      });
      final rows = List<Map<String, dynamic>>.from(res as List);
      return rows.isEmpty ? null : rows.first;
    } catch (_) {
      return null;
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
  /// Pops the newest entry off the server-side history and returns the document
  /// it restored. Null means there was nothing to undo — `undo_state()` raises
  /// P0002 in that case.
  static Future<Map<String, dynamic>?> undoState() async {
    if (_user == null) return null;
    try {
      final res = await _client.rpc('undo_state');
      return res is Map ? Map<String, dynamic>.from(res) : null;
    } catch (_) {
      return null;
    }
  }
}

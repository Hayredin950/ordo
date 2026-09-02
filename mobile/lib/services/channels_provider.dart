import 'dart:async';

import 'package:flutter/foundation.dart';
import 'api.dart';
import 'db.dart';

/// Telegram + Slack link state, mirroring the web's TelegramPanel logic:
/// `/api/health` says whether the server holds a bot token, the link rows say
/// whether this account is bound to a chat, and an outstanding link code is
/// polled until the bot redeems it (the bot links the chat server-side, so
/// nothing pushes that back to the app).
///
/// Shared rather than panel-local because the notification bell counts the
/// "connect a channel" checklist step from the same status.
class ChannelsProvider extends ChangeNotifier {
  static const _codeTtl = Duration(minutes: 15);

  HealthStatus? _health;
  TelegramLink? _telegram;
  String? _slackChannel;
  String? _pendingCode;
  bool _loaded = false;
  bool _busy = false;
  bool _refreshing = false;
  Timer? _poll;
  Timer? _codeExpiry;

  bool get telegramConfigured => _health?.telegram ?? false;
  bool get slackConfigured => _health?.slack ?? false;
  String get botUsername => _health?.telegramBot ?? '';
  TelegramLink? get telegram => _telegram;
  bool get telegramLinked => _telegram != null;
  String? get slackChannel => _slackChannel;
  String? get pendingCode => _pendingCode;

  /// False until the first refresh lands, so the panel can hold off on saying
  /// "not connected" before it knows.
  bool get loaded => _loaded;
  bool get busy => _busy;

  @override
  void dispose() {
    _poll?.cancel();
    _codeExpiry?.cancel();
    super.dispose();
  }

  Future<void> refresh() async {
    if (_refreshing) return;
    _refreshing = true;
    try {
      // Health is per-deployment, not per-user; re-fetched only if it failed.
      _health ??= await OrdoApi.health();
      _telegram = await OrdoDb.telegramLink();
      _slackChannel = await OrdoDb.slackLink();
      _loaded = true;
      if (_telegram != null) _onLinked();
      notifyListeners();
    } finally {
      _refreshing = false;
    }
  }

  /// Sign-out: drop the previous account's rows so the next one starts clean.
  void clear() {
    _stopPolling();
    _telegram = null;
    _slackChannel = null;
    _pendingCode = null;
    _loaded = false;
    notifyListeners();
  }

  Future<String> generateTelegramCode() async {
    _busy = true;
    notifyListeners();
    try {
      final code = await OrdoDb.createTelegramCode();
      _pendingCode = code;
      _startPolling();
      return code;
    } finally {
      _busy = false;
      notifyListeners();
    }
  }

  Future<void> unlinkTelegram() async {
    _busy = true;
    notifyListeners();
    try {
      await OrdoDb.unlinkTelegram();
      _telegram = null;
      _pendingCode = null;
      _stopPolling();
    } finally {
      _busy = false;
      notifyListeners();
    }
  }

  Future<String> linkSlack(String channel) async {
    _busy = true;
    notifyListeners();
    try {
      final saved = await OrdoDb.linkSlack(channel);
      _slackChannel = saved;
      return saved;
    } finally {
      _busy = false;
      notifyListeners();
    }
  }

  Future<void> unlinkSlack() async {
    _busy = true;
    notifyListeners();
    try {
      await OrdoDb.unlinkSlack();
      _slackChannel = null;
    } finally {
      _busy = false;
      notifyListeners();
    }
  }

  void _onLinked() {
    _pendingCode = null;
    _stopPolling();
    OrdoDb.setOnboarding(telegramLinked: true);
  }

  /// Same 3s cadence as the web, but bounded by the code's own 15-minute TTL —
  /// a phone should not hold a timer open forever the way a closed tab cannot.
  void _startPolling() {
    _stopPolling();
    _poll = Timer.periodic(const Duration(seconds: 3), (_) async {
      final link = await OrdoDb.telegramLink();
      if (link == null) return;
      _telegram = link;
      _onLinked();
      notifyListeners();
    });
    _codeExpiry = Timer(_codeTtl, () {
      if (_telegram != null) return;
      _pendingCode = null;
      _stopPolling();
      notifyListeners();
    });
  }

  void _stopPolling() {
    _poll?.cancel();
    _poll = null;
    _codeExpiry?.cancel();
    _codeExpiry = null;
  }
}

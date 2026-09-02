import 'dart:convert';

import 'package:http/http.dart' as http;
import '../config.dart';

/// What this deployment can actually do — the mobile mirror of the web's
/// `/api/health` client (src/lib/api.ts). The notification panel uses it to say
/// whether a bot token exists, so the UI never offers a channel the server
/// cannot honour.
class HealthStatus {
  final bool github;
  final bool google;
  final bool telegram;
  final bool slack;
  final bool anthropic;

  /// Bot handle, so the UI can spell out where to send `/link CODE`.
  final String telegramBot;

  const HealthStatus({
    this.github = false,
    this.google = false,
    this.telegram = false,
    this.slack = false,
    this.anthropic = false,
    this.telegramBot = '',
  });

  factory HealthStatus.fromJson(Map<String, dynamic> json) => HealthStatus(
    github: json['github'] == true,
    google: json['google'] == true,
    telegram: json['telegram'] == true,
    slack: json['slack'] == true,
    anthropic: json['anthropic'] == true,
    telegramBot: (json['telegramBot'] as String?) ?? '',
  );
}

class OrdoApi {
  /// Null when the deployment is unreachable — callers treat that as "nothing
  /// configured" rather than guessing a channel is available.
  static Future<HealthStatus?> health() async {
    try {
      final res = await http
          .get(Uri.parse('$apiUrl/api/health'))
          .timeout(const Duration(seconds: 10));
      if (res.statusCode != 200) return null;
      final body = jsonDecode(res.body);
      if (body is! Map || body['status'] is! Map) return null;
      return HealthStatus.fromJson(Map<String, dynamic>.from(body['status'] as Map));
    } catch (_) {
      return null;
    }
  }
}

import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart' as supa;

class AuthProvider extends ChangeNotifier {
  final _client = supa.Supabase.instance.client;
  bool _loading = true;

  supa.User? get user => _client.auth.currentUser;
  bool get loading => _loading;
  bool get isLoggedIn => _client.auth.currentSession != null;
  bool get isAdmin => _client.auth.currentUser?.appMetadata['role'] == 'admin';

  bool get githubEnabled => true;
  bool get googleEnabled => true;

  AuthProvider() {
    _client.auth.onAuthStateChange.listen((_) {
      _loading = false;
      notifyListeners();
    });
    _init();
  }

  Future<void> _init() async {
    _loading = false;
    notifyListeners();
  }

  Future<void> login(String email, String password) async {
    _loading = true;
    notifyListeners();
    await _client.auth.signInWithPassword(email: email, password: password);
    _loading = false;
    notifyListeners();
  }

  Future<String?> signup(String email, String password, [String? name]) async {
    _loading = true;
    notifyListeners();
    final res = await _client.auth.signUp(
      email: email,
      password: password,
      data: name != null ? {'name': name} : null,
    );
    _loading = false;
    notifyListeners();
    if (res.user != null && res.session == null) {
      return 'code';
    }
    return null;
  }

  Future<void> sendOtp(String email) async {
    await _client.auth.signInWithOtp(email: email);
  }

  Future<void> verifyOtp(String email, String token) async {
    _loading = true;
    notifyListeners();
    await _client.auth.verifyOTP(
      email: email,
      token: token,
      type: supa.OtpType.email,
    );
    _loading = false;
    notifyListeners();
  }

  Future<void> oauthSignIn(String provider) async {
    _loading = true;
    notifyListeners();
    final providerEnum = provider == 'github'
        ? supa.OAuthProvider.github
        : supa.OAuthProvider.google;
    await _client.auth.signInWithOAuth(
      providerEnum,
      redirectTo: 'io.supabase.ordo://login-callback/',
    );
    _loading = false;
    notifyListeners();
  }

  Future<void> logout() async {
    await _client.auth.signOut();
    notifyListeners();
  }

  String? get token => _client.auth.currentSession?.accessToken;
}

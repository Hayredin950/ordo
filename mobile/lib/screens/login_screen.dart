import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/auth_provider.dart';
import '../themes/app_theme.dart';

class LoginScreen extends StatefulWidget {
  final VoidCallback? onBack;

  const LoginScreen({super.key, this.onBack});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _emailCtrl = TextEditingController();
  final _passCtrl = TextEditingController();
  final _nameCtrl = TextEditingController();
  final _codeCtrl = TextEditingController();

  String _mode = 'login'; // login, signup, code, verify
  String _pending = 'signin'; // signin or signup
  bool _busy = false;
  String? _error;
  int _cooldown = 0;

  @override
  void dispose() {
    _emailCtrl.dispose();
    _passCtrl.dispose();
    _nameCtrl.dispose();
    _codeCtrl.dispose();
    super.dispose();
  }

  void _startCooldown() {
    _cooldown = 60;
    Future.doWhile(() async {
      await Future.delayed(const Duration(seconds: 1));
      if (!mounted) return false;
      if (_cooldown <= 0) return false;
      setState(() => _cooldown--);
      return _cooldown > 0;
    });
  }

  Future<void> _submit() async {
    setState(() { _error = null; _busy = true; });
    final auth = context.read<AuthProvider>();
    try {
      if (_mode == 'signup') {
        final result = await auth.signup(_emailCtrl.text, _passCtrl.text, _nameCtrl.text);
        if (result == 'code') {
          await auth.sendOtp(_emailCtrl.text);
          setState(() { _pending = 'signup'; });
          _startCooldown();
          setState(() => _mode = 'verify');
        }
      } else if (_mode == 'login') {
        await auth.login(_emailCtrl.text, _passCtrl.text);
        if (mounted) Navigator.of(context).pop();
      } else if (_mode == 'code') {
        await auth.sendOtp(_emailCtrl.text);
        setState(() { _pending = 'signin'; });
        _startCooldown();
        setState(() => _mode = 'verify');
      }
    } catch (e) {
      setState(() => _error = e.toString().replaceAll('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _submitCode() async {
    setState(() { _error = null; _busy = true; });
    try {
      await context.read<AuthProvider>().verifyOtp(_emailCtrl.text, _codeCtrl.text);
      if (mounted) Navigator.of(context).pop();
    } catch (e) {
      setState(() => _error = 'Invalid code. Please try again.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _resend() async {
    setState(() { _busy = true; _error = null; });
    try {
      await context.read<AuthProvider>().sendOtp(_emailCtrl.text);
      _startCooldown();
    } catch (e) {
      setState(() => _error = 'Could not resend code.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _oauth(String provider) async {
    setState(() { _busy = true; _error = null; });
    try {
      await context.read<AuthProvider>().oauthSignIn(provider);
      if (mounted) Navigator.of(context).pop();
    } catch (e) {
      setState(() => _error = e.toString().replaceAll('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: Container(
              constraints: const BoxConstraints(maxWidth: 400),
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: OrdoColors.card,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: OrdoColors.border),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (widget.onBack != null)
                    Align(
                      alignment: Alignment.centerLeft,
                      child: IconButton(
                        icon: Icon(Icons.arrow_back, color: OrdoColors.mutedForeground),
                        onPressed: widget.onBack,
                      ),
                    ),
                  Image.asset(
                    'assets/logo.png',
                    width: 80,
                    height: 80,
                  ),
                  const SizedBox(height: 12),
                  Text('Ordo',
                      style: TextStyle(
                          fontFamily: 'SpaceGrotesk',
                          fontSize: 36,
                          fontWeight: FontWeight.w700,
                          color: OrdoColors.primary)),
                  const SizedBox(height: 8),
                  Text('Discipline, measured.',
                      style: TextStyle(
                          fontSize: 14,
                          color: OrdoColors.mutedForeground)),
                  const SizedBox(height: 4),
                  Text('Sign in to sync your accountability data.',
                      style: TextStyle(
                          fontSize: 12,
                          color: OrdoColors.mutedForeground)),
                  const SizedBox(height: 24),
                  _buildOAuthButtons(),
                  if (_mode != 'verify') ...[
                    _buildDivider(),
                    const SizedBox(height: 8),
                    _buildForm(),
                  ] else
                    _buildCodeVerification(),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildOAuthButtons() {
    final auth = context.watch<AuthProvider>();
    return Column(
      children: [
        Row(
          children: [
            if (auth.githubEnabled)
              Expanded(
                child: _OAuthButton(
                  label: 'GitHub',
                  icon: Icons.code,
                  busy: _busy,
                  onTap: () => _oauth('github'),
                ),
              ),
            if (auth.githubEnabled && auth.googleEnabled)
              const SizedBox(width: 12),
            if (auth.googleEnabled)
              Expanded(
                child: _OAuthButton(
                  label: 'Google',
                  icon: Icons.g_mobiledata,
                  busy: _busy,
                  onTap: () => _oauth('google'),
                ),
              ),
          ],
        ),
      ],
    );
  }

  Widget _buildDivider() {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 16),
      child: Row(
        children: [
          Expanded(child: Container(height: 1, color: OrdoColors.border)),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Text('or', style: TextStyle(fontSize: 12, color: OrdoColors.mutedForeground)),
          ),
          Expanded(child: Container(height: 1, color: OrdoColors.border)),
        ],
      ),
    );
  }

  Widget _buildForm() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (_mode == 'signup') ...[
          TextField(
            controller: _nameCtrl,
            decoration: const InputDecoration(hintText: 'Name (optional)'),
          ),
          const SizedBox(height: 12),
        ],
        TextField(
          controller: _emailCtrl,
          decoration: const InputDecoration(hintText: 'Email'),
          keyboardType: TextInputType.emailAddress,
        ),
        if (_mode != 'code') ...[
          const SizedBox(height: 12),
          TextField(
            controller: _passCtrl,
            decoration: const InputDecoration(hintText: 'Password'),
            obscureText: true,
          ),
        ] else ...[
          const SizedBox(height: 8),
          Text(
            'No password needed — we email you a 6-digit code instead.',
            style: TextStyle(fontSize: 12, color: OrdoColors.mutedForeground),
          ),
        ],
        if (_error != null) ...[
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: OrdoColors.destructive.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(_error!,
                style: TextStyle(color: OrdoColors.destructive, fontSize: 13)),
          ),
        ],
        const SizedBox(height: 16),
        SizedBox(
          height: 48,
          child: ElevatedButton(
            onPressed: _busy ? null : _submit,
            child: _busy
                ? const SizedBox(
                    width: 20, height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2, color: OrdoColors.primaryForeground))
                : Text(_mode == 'login'
                    ? 'Sign in'
                    : _mode == 'signup'
                        ? 'Create account'
                        : 'Email me a code'),
          ),
        ),
        const SizedBox(height: 12),
        _buildModeLinks(),
      ],
    );
  }

  Widget _buildModeLinks() {
    if (_mode == 'login') {
      return Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          _TextButton('Create an account', () => setState(() { _mode = 'signup'; _error = null; })),
          const SizedBox(width: 8),
          _TextButton('Sign in with a code', () => setState(() { _mode = 'code'; _error = null; })),
        ],
      );
    } else if (_mode == 'signup') {
      return _TextButton('Already have an account?', () => setState(() { _mode = 'login'; _error = null; }));
    } else {
      return _TextButton('Back to sign in', () => setState(() { _mode = 'login'; _error = null; }));
    }
  }

  Widget _buildCodeVerification() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          _pending == 'signup'
              ? 'Enter the 6-digit code we emailed to confirm this address.'
              : 'Enter the 6-digit code we emailed you.',
          style: TextStyle(fontSize: 13, color: OrdoColors.mutedForeground),
        ),
        const SizedBox(height: 4),
        Text(
          'Sent to ${_emailCtrl.text}',
          style: TextStyle(fontSize: 13, color: OrdoColors.foreground, fontWeight: FontWeight.w500),
        ),
        const SizedBox(height: 16),
        TextField(
          controller: _codeCtrl,
          autofocus: true,
          textAlign: TextAlign.center,
          keyboardType: TextInputType.number,
          maxLength: 6,
          style: TextStyle(
              fontFamily: 'SpaceGrotesk',
              fontSize: 24,
              fontWeight: FontWeight.w700,
              letterSpacing: 8,
              color: OrdoColors.foreground),
          decoration: InputDecoration(
            hintText: '123456',
            counterText: '',
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
          ),
          onChanged: (v) {
            _codeCtrl.text = v.replaceAll(RegExp(r'[^0-9]'), '').substring(0, v.length.clamp(0, 6));
            _codeCtrl.selection = TextSelection.fromPosition(TextPosition(offset: _codeCtrl.text.length));
          },
          onSubmitted: (_) {
            if (_codeCtrl.text.length == 6) _submitCode();
          },
        ),
        if (_error != null) ...[
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: OrdoColors.destructive.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(_error!,
                style: TextStyle(color: OrdoColors.destructive, fontSize: 13)),
          ),
        ],
        const SizedBox(height: 16),
        SizedBox(
          height: 48,
          child: ElevatedButton(
            onPressed: (_busy || _codeCtrl.text.length < 6) ? null : _submitCode,
            child: _busy
                ? const SizedBox(
                    width: 20, height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2, color: OrdoColors.primaryForeground))
                : Text(_pending == 'signup' ? 'Confirm email' : 'Sign in'),
          ),
        ),
        const SizedBox(height: 12),
        _TextButton(
          _cooldown > 0 ? 'Resend code in ${_cooldown}s' : 'Resend code',
          _cooldown > 0 ? null : _resend,
        ),
        const SizedBox(height: 4),
        _TextButton('Back to sign in', () => setState(() { _mode = 'login'; _error = null; })),
      ],
    );
  }
}

class _OAuthButton extends StatelessWidget {
  final String label;
  final IconData icon;
  final bool busy;
  final VoidCallback onTap;

  const _OAuthButton({
    required this.label,
    required this.icon,
    required this.busy,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 44,
      child: OutlinedButton(
        onPressed: busy ? null : onTap,
        style: OutlinedButton.styleFrom(
          side: BorderSide(color: OrdoColors.border),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 18, color: OrdoColors.foreground),
            const SizedBox(width: 8),
            Text(label, style: TextStyle(color: OrdoColors.foreground, fontSize: 14)),
          ],
        ),
      ),
    );
  }
}

class _TextButton extends StatelessWidget {
  final String label;
  final VoidCallback? onTap;

  const _TextButton(this.label, [this.onTap]);

  @override
  Widget build(BuildContext context) {
    return TextButton(
      onPressed: onTap,
      child: Text(label, style: TextStyle(color: OrdoColors.primary, fontSize: 13)),
    );
  }
}

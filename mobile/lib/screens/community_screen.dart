import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../services/auth_provider.dart';
import '../services/db.dart';
import '../widgets/app_widgets.dart';
import '../themes/app_theme.dart';

class CommunityScreen extends StatefulWidget {
  final VoidCallback? onLoginRequired;

  const CommunityScreen({super.key, this.onLoginRequired});

  @override
  State<CommunityScreen> createState() => _CommunityScreenState();
}

class _CommunityScreenState extends State<CommunityScreen> {
  List<Map<String, dynamic>> _peers = [];
  List<Map<String, dynamic>> _challenges = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    final peers = await OrdoDb.listPeers();
    final challenges = await OrdoDb.listChallenges();
    if (mounted) {
      setState(() {
        _peers = peers;
        _challenges = challenges;
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return _loading
        ? const Center(child: CircularProgressIndicator(color: OrdoColors.primary))
        : RefreshIndicator(
            onRefresh: _loadData,
            child: SingleChildScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _PeerSection(peers: _peers, onRefresh: _loadData, onLoginRequired: widget.onLoginRequired),
                  const SizedBox(height: 24),
                  _ChallengeSection(challenges: _challenges, onRefresh: _loadData, onLoginRequired: widget.onLoginRequired),
                  const SizedBox(height: 24),
                  _FutureLettersSection(onLoginRequired: widget.onLoginRequired),
                ],
              ),
            ),
          );
  }
}

class _PeerSection extends StatelessWidget {
  final List<Map<String, dynamic>> peers;
  final VoidCallback onRefresh;
  final VoidCallback? onLoginRequired;

  const _PeerSection({required this.peers, required this.onRefresh, this.onLoginRequired});

  @override
  Widget build(BuildContext context) {
    return Panel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Peer Pairing',
                  style: TextStyle(
                      fontFamily: 'SpaceGrotesk',
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                      color: OrdoColors.foreground)),
              IconButton(
                icon: Icon(Icons.person_add, color: OrdoColors.primary, size: 20),
                onPressed: () {
                  if (!context.read<AuthProvider>().isLoggedIn) {
                    onLoginRequired?.call();
                    return;
                  }
                  _showPairDialog(context);
                },
              ),
            ],
          ),
          const SizedBox(height: 8),
          if (peers.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 16),
              child: Center(
                child: Text(
                  'No accountability partner yet.\nTap the icon to pair with someone.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: OrdoColors.mutedForeground, fontSize: 13),
                ),
              ),
            )
          else
            ...peers.map((p) {
              final weekly = p['weekly_pct'] ?? 0;
              final name = p['name'] ?? p['email'] ?? 'Unknown';
              return Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Row(
                  children: [
                    CircleAvatar(
                      backgroundColor: OrdoColors.primary,
                      radius: 16,
                      child: Text(
                        name[0].toString().toUpperCase(),
                        style: TextStyle(
                            color: OrdoColors.primaryForeground,
                            fontWeight: FontWeight.w700,
                            fontSize: 13),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(name,
                              style: const TextStyle(
                                  color: OrdoColors.foreground,
                                  fontWeight: FontWeight.w500)),
                          Text('Paired',
                              style: TextStyle(
                                  fontSize: 11,
                                  color: OrdoColors.mutedForeground)),
                        ],
                      ),
                    ),
                    Text('${(weekly as num).toInt()}%',
                        style: TextStyle(
                            color: OrdoColors.primary,
                            fontWeight: FontWeight.w600)),
                  ],
                ),
              );
            }),
        ],
      ),
    );
  }

  void _showPairDialog(BuildContext context) {
    final ctrl = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: OrdoColors.card,
        title: const Text('Pair with someone',
            style: TextStyle(color: OrdoColors.foreground)),
        content: TextField(
          controller: ctrl,
          decoration: const InputDecoration(hintText: "Partner's email"),
          keyboardType: TextInputType.emailAddress,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text('Cancel', style: TextStyle(color: OrdoColors.mutedForeground)),
          ),
          TextButton(
            onPressed: () async {
              if (ctrl.text.trim().isNotEmpty) {
                try {
                  await OrdoDb.pairWithEmail(ctrl.text.trim());
                  if (!ctx.mounted) return;
                  Navigator.pop(ctx);
                  onRefresh();
                } catch (e) {
                  if (!ctx.mounted) return;
                  Navigator.pop(ctx);
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text('Error: ${e.toString().replaceAll('Exception: ', '')}')),
                    );
                  }
                }
              }
            },
            child: const Text('Pair', style: TextStyle(color: OrdoColors.primary)),
          ),
        ],
      ),
    );
  }
}

class _ChallengeSection extends StatelessWidget {
  final List<Map<String, dynamic>> challenges;
  final VoidCallback onRefresh;
  final VoidCallback? onLoginRequired;

  const _ChallengeSection({required this.challenges, required this.onRefresh, this.onLoginRequired});

  @override
  Widget build(BuildContext context) {
    return Panel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Challenges',
                  style: TextStyle(
                      fontFamily: 'SpaceGrotesk',
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                      color: OrdoColors.foreground)),
              IconButton(
                icon: Icon(Icons.add_circle_outline, color: OrdoColors.primary, size: 20),
                onPressed: () {
                  if (!context.read<AuthProvider>().isLoggedIn) {
                    onLoginRequired?.call();
                    return;
                  }
                  _showCreateDialog(context);
                },
              ),
            ],
          ),
          const SizedBox(height: 8),
          if (challenges.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 16),
              child: Center(
                child: Text(
                  'No active challenges.\nCreate one to compete with peers!',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: OrdoColors.mutedForeground, fontSize: 13),
                ),
              ),
            )
          else
            ...challenges.map((c) {
              final name = c['name'] ?? '';
              final members = c['member_count'] ?? c['members'] ?? 0;
              final joined = c['joined'] ?? false;
              final endsOn = c['ends_on'] ?? '';
              return Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Row(
                  children: [
                    Icon(
                        joined ? Icons.check_circle : Icons.emoji_events,
                        color: joined ? Colors.green : OrdoColors.primary,
                        size: 20),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(name,
                              style: const TextStyle(
                                  color: OrdoColors.foreground,
                                  fontWeight: FontWeight.w600)),
                          Text('$members members${endsOn.isNotEmpty ? ' · ends $endsOn' : ''}',
                              style: TextStyle(
                                  fontSize: 12,
                                  color: OrdoColors.mutedForeground)),
                        ],
                      ),
                    ),
                    if (!joined)
                      SizedBox(
                        width: 60,
                        height: 32,
                        child: ElevatedButton(
                          onPressed: () async {
                            try {
                              await OrdoDb.joinChallenge(c['id']);
                              onRefresh();
                            } catch (e) {
                              if (context.mounted) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(content: Text('Error joining challenge')),
                                );
                              }
                            }
                          },
                          style: ElevatedButton.styleFrom(
                              padding: EdgeInsets.zero,
                              textStyle: const TextStyle(fontSize: 11)),
                          child: const Text('Join'),
                        ),
                      ),
                  ],
                ),
              );
            }),
        ],
      ),
    );
  }

  void _showCreateDialog(BuildContext context) {
    final nameCtrl = TextEditingController();
    final endsCtrl = TextEditingController(
        text: DateFormat('yyyy-MM-dd').format(DateTime.now().add(const Duration(days: 7))));
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: OrdoColors.card,
        title: const Text('Create Challenge',
            style: TextStyle(color: OrdoColors.foreground)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: nameCtrl,
              decoration: const InputDecoration(hintText: 'Challenge name'),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: endsCtrl,
              decoration: const InputDecoration(hintText: 'End date (YYYY-MM-DD)'),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text('Cancel', style: TextStyle(color: OrdoColors.mutedForeground)),
          ),
          TextButton(
            onPressed: () async {
              if (nameCtrl.text.trim().isNotEmpty) {
                try {
                  final now = DateFormat('yyyy-MM-dd').format(DateTime.now());
                  await OrdoDb.createChallenge(nameCtrl.text.trim(), now, endsCtrl.text);
                  if (!ctx.mounted) return;
                  Navigator.pop(ctx);
                  onRefresh();
                } catch (e) {
                  if (!ctx.mounted) return;
                  Navigator.pop(ctx);
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Error creating challenge')),
                    );
                  }
                }
              }
            },
            child: const Text('Create', style: TextStyle(color: OrdoColors.primary)),
          ),
        ],
      ),
    );
  }
}

class _FutureLettersSection extends StatefulWidget {
  final VoidCallback? onLoginRequired;

  const _FutureLettersSection({this.onLoginRequired});

  @override
  State<_FutureLettersSection> createState() => _FutureLettersSectionState();
}

class _FutureLettersSectionState extends State<_FutureLettersSection> {
  List<Map<String, dynamic>> _letters = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final letters = await OrdoDb.listLetters();
    if (mounted) setState(() { _letters = letters; _loading = false; });
  }

  @override
  Widget build(BuildContext context) {
    return Panel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Future Letters',
                  style: TextStyle(
                      fontFamily: 'SpaceGrotesk',
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                      color: OrdoColors.foreground)),
              IconButton(
                icon: Icon(Icons.add, color: OrdoColors.primary, size: 20),
                onPressed: () {
                  if (!context.read<AuthProvider>().isLoggedIn) {
                    widget.onLoginRequired?.call();
                    return;
                  }
                  _showCreateDialog(context);
                },
              ),
            ],
          ),
          const SizedBox(height: 8),
          if (_loading)
            const Center(child: CircularProgressIndicator())
          else if (_letters.isEmpty)
            Text(
              'Write a letter to your future self.\nIt will be delivered when you reach your goal.',
              style: TextStyle(color: OrdoColors.mutedForeground, fontSize: 13),
            )
          else
            ..._letters.map((l) {
              final delivered = l['delivered'] ?? false;
              final deadline = l['deadline'] ?? '';
              return Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Row(
                  children: [
                    Icon(
                        delivered ? Icons.mark_email_read : Icons.mail_outline,
                        color: delivered ? Colors.green : OrdoColors.primary,
                        size: 20),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(l['goal_title'] ?? '',
                              style: const TextStyle(
                                  color: OrdoColors.foreground,
                                  fontWeight: FontWeight.w500)),
                          Text(
                              delivered ? 'Delivered' : 'Delivers on $deadline',
                              style: TextStyle(fontSize: 12, color: OrdoColors.mutedForeground)),
                        ],
                      ),
                    ),
                  ],
                ),
              );
            }),
        ],
      ),
    );
  }

  void _showCreateDialog(BuildContext context) {
    final goalCtrl = TextEditingController();
    final bodyCtrl = TextEditingController();
    final deadlineCtrl = TextEditingController(
        text: DateFormat('yyyy-MM-dd').format(DateTime.now().add(const Duration(days: 30))));
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: OrdoColors.card,
        title: const Text('Write a Letter',
            style: TextStyle(color: OrdoColors.foreground)),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: goalCtrl,
                decoration: const InputDecoration(hintText: 'Goal title'),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: bodyCtrl,
                decoration: const InputDecoration(hintText: 'Your letter...'),
                maxLines: 4,
              ),
              const SizedBox(height: 8),
              TextField(
                controller: deadlineCtrl,
                decoration: const InputDecoration(hintText: 'Deadline (YYYY-MM-DD)'),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text('Cancel', style: TextStyle(color: OrdoColors.mutedForeground)),
          ),
          TextButton(
            onPressed: () async {
              if (goalCtrl.text.isNotEmpty && bodyCtrl.text.isNotEmpty) {
                try {
                  await OrdoDb.createLetter(
                      goalCtrl.text, bodyCtrl.text, deadlineCtrl.text);
                  if (!ctx.mounted) return;
                  Navigator.pop(ctx);
                  _load();
                } catch (e) {
                  if (!ctx.mounted) return;
                  Navigator.pop(ctx);
                }
              }
            },
            child: const Text('Send', style: TextStyle(color: OrdoColors.primary)),
          ),
        ],
      ),
    );
  }
}

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
    if (_loading) return const Center(child: CircularProgressIndicator(color: OrdoColors.primary));
    final auth = context.watch<AuthProvider>();

    return RefreshIndicator(
      onRefresh: _loadData,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // ── Not logged in ──
          if (!auth.isLoggedIn) ...[
            Panel(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  PanelTitle(title: 'Community', hint: 'Pair with a friend or join a challenge.'),
                  const SizedBox(height: 8),
                  Text('Sign in to pair accounts, join challenges and publish your discipline to the leaderboard.',
                      style: TextStyle(fontSize: 13, color: OrdoColors.mutedForeground)),
                ],
              ),
            ),
          ] else ...[
            // ── Accountability pairing ──
            _PeerSection(peers: _peers, onRefresh: _loadData),
            const SizedBox(height: 16),

            // ── Challenges with leaderboard ──
            _ChallengeSection(challenges: _challenges, onRefresh: _loadData),
            const SizedBox(height: 16),

            // ── Settings & data ──
            _SettingsSection(onLoginRequired: widget.onLoginRequired),
          ],
        ],
      ),
    );
  }
}

// ─── Peer Section ──────────────────────────────────────────────────────

class _PeerSection extends StatefulWidget {
  final List<Map<String, dynamic>> peers;
  final VoidCallback onRefresh;

  const _PeerSection({required this.peers, required this.onRefresh});

  @override
  State<_PeerSection> createState() => _PeerSectionState();
}

class _PeerSectionState extends State<_PeerSection> {
  final _emailCtrl = TextEditingController();
  bool _busy = false;

  @override
  Widget build(BuildContext context) {
    return Panel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          PanelTitle(
            title: 'Accountability pairing',
            hint: 'Each of you sees the other\'s weekly % — never task details.',
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _emailCtrl,
                  decoration: InputDecoration(
                    hintText: 'friend@example.com',
                    isDense: true,
                    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                  style: TextStyle(color: OrdoColors.foreground),
                  keyboardType: TextInputType.emailAddress,
                ),
              ),
              const SizedBox(width: 8),
              SizedBox(
                height: 40,
                child: ElevatedButton.icon(
                  onPressed: _busy ? null : _addPeer,
                  icon: _busy
                      ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                      : const Icon(Icons.person_add, size: 18),
                  label: const Text('Pair'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          if (widget.peers.isEmpty)
            Text('No peers yet. Add someone by email — they must have an Ordo account.',
                style: TextStyle(fontSize: 13, color: OrdoColors.mutedForeground))
          else
            ...widget.peers.map((p) {
              final weekly = p['weekly_pct'] ?? 0;
              final name = p['name'] ?? p['email'] ?? 'Unknown';
              return Container(
                margin: const EdgeInsets.only(bottom: 8),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: OrdoColors.card,
                  border: Border.all(color: OrdoColors.border),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Row(
                  children: [
                    CircleAvatar(
                      backgroundColor: OrdoColors.primary,
                      radius: 16,
                      child: Text(name[0].toString().toUpperCase(),
                          style: TextStyle(color: OrdoColors.primaryForeground, fontWeight: FontWeight.w700, fontSize: 13)),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(name, style: const TextStyle(color: OrdoColors.foreground, fontWeight: FontWeight.w500)),
                          Text('${p['email'] ?? ''}', style: TextStyle(fontSize: 11, color: OrdoColors.mutedForeground)),
                        ],
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(color: OrdoColors.muted, borderRadius: BorderRadius.circular(6)),
                      child: Text('${(weekly as num).toInt()}%',
                          style: const TextStyle(fontFamily: 'SpaceGrotesk', fontWeight: FontWeight.w600, fontSize: 14)),
                    ),
                    const SizedBox(width: 8),
                    GestureDetector(
                      onTap: () async {
                        await OrdoDb.unpair(p['id']);
                        widget.onRefresh();
                      },
                      child: Icon(Icons.delete_outline, size: 18, color: OrdoColors.mutedForeground),
                    ),
                  ],
                ),
              );
            }),
        ],
      ),
    );
  }

  Future<void> _addPeer() async {
    if (_emailCtrl.text.trim().isEmpty) return;
    setState(() => _busy = true);
    try {
      await OrdoDb.pairWithEmail(_emailCtrl.text.trim());
      _emailCtrl.clear();
      widget.onRefresh();
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Pairing added — they can see your weekly %, nothing else.')),
      );
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error: $e')),
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }
}

// ─── Challenge Section ─────────────────────────────────────────────────

class _ChallengeSection extends StatefulWidget {
  final List<Map<String, dynamic>> challenges;
  final VoidCallback onRefresh;

  const _ChallengeSection({required this.challenges, required this.onRefresh});

  @override
  State<_ChallengeSection> createState() => _ChallengeSectionState();
}

class _ChallengeSectionState extends State<_ChallengeSection> {
  final _nameCtrl = TextEditingController();
  final _daysCtrl = TextEditingController(text: '30');
  String? _openBoardId;
  Map<String, dynamic>? _board;
  bool _boardBusy = false;

  @override
  Widget build(BuildContext context) {
    return Panel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          PanelTitle(
            title: 'Challenges',
            hint: 'Opt-in tests of willpower, ranked by completion rate.',
          ),
          const SizedBox(height: 8),
          // Create form
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _nameCtrl,
                  decoration: InputDecoration(
                    hintText: 'e.g. 30 days of study',
                    isDense: true,
                    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                  style: TextStyle(color: OrdoColors.foreground),
                ),
              ),
              const SizedBox(width: 8),
              SizedBox(
                width: 60,
                child: TextField(
                  controller: _daysCtrl,
                  keyboardType: TextInputType.number,
                  decoration: InputDecoration(
                    isDense: true,
                    contentPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                    suffixText: 'd',
                  ),
                  style: TextStyle(color: OrdoColors.foreground),
                ),
              ),
              const SizedBox(width: 8),
              GestureDetector(
                onTap: _createChallenge,
                child: Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(color: OrdoColors.primary, borderRadius: BorderRadius.circular(8)),
                  child: Icon(Icons.flag, color: OrdoColors.primaryForeground, size: 18),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // Challenge list
          if (widget.challenges.isEmpty)
            Text('No challenges yet — start one.', style: TextStyle(fontSize: 13, color: OrdoColors.mutedForeground))
          else
            ...widget.challenges.map((c) {
              final name = c['name'] ?? '';
              final members = c['member_count'] ?? c['members'] ?? 0;
              final joined = c['joined'] ?? false;
              final startsOn = c['starts_on'] ?? '';
              final endsOn = c['ends_on'] ?? '';
              final id = c['id'] ?? '';
              final isOpen = _openBoardId == id;

              return Container(
                margin: const EdgeInsets.only(bottom: 10),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: OrdoColors.card,
                  border: Border.all(color: OrdoColors.border),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(joined ? Icons.check_circle : Icons.emoji_events,
                            color: joined ? Colors.green : OrdoColors.primary, size: 20),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(name, style: const TextStyle(fontWeight: FontWeight.w600, color: OrdoColors.foreground)),
                              Text('$members members · $startsOn → $endsOn',
                                  style: TextStyle(fontSize: 12, color: OrdoColors.mutedForeground)),
                            ],
                          ),
                        ),
                        if (joined)
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                            decoration: BoxDecoration(color: OrdoColors.primary.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(6)),
                            child: Text('Joined', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w500, color: OrdoColors.primary)),
                          ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        if (!joined)
                          OutlinedButton(
                            onPressed: () async {
                              try {
                                await OrdoDb.joinChallenge(id);
                                widget.onRefresh();
                              } catch (e) {
                                if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(content: Text('Error joining challenge')),
                                );
                              }
                            },
                            style: OutlinedButton.styleFrom(
                              foregroundColor: OrdoColors.mutedForeground,
                              side: BorderSide(color: OrdoColors.border),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                            ),
                            child: const Text('Join'),
                          ),
                        const SizedBox(width: 8),
                        OutlinedButton.icon(
                          onPressed: () => _toggleBoard(id),
                          icon: Icon(isOpen ? Icons.expand_less : Icons.expand_more, size: 18),
                          label: const Text('Leaderboard'),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: OrdoColors.mutedForeground,
                            side: BorderSide(color: OrdoColors.border),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                          ),
                        ),
                      ],
                    ),
                    // Leaderboard
                    if (isOpen) ...[
                      const SizedBox(height: 8),
                      Container(height: 1, color: OrdoColors.border),
                      const SizedBox(height: 8),
                      if (_boardBusy)
                        const Center(child: Padding(
                          padding: EdgeInsets.all(12),
                          child: SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)),
                        ))
                      else if (_board != null)
                        _buildLeaderboard(_board!)
                      else
                        Text('Could not load leaderboard.', style: TextStyle(fontSize: 12, color: OrdoColors.mutedForeground)),
                    ],
                  ],
                ),
              );
            }),
        ],
      ),
    );
  }

  Widget _buildLeaderboard(Map<String, dynamic> data) {
    final rows = (data['leaderboard'] as List?) ?? [];
    final myRank = data['myRank'] as int?;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (rows.isEmpty)
          Text('No participants yet.', style: TextStyle(fontSize: 12, color: OrdoColors.mutedForeground))
        else
          ...rows.take(5).toList().asMap().entries.map((e) {
            final r = e.value as Map<String, dynamic>;
            return Padding(
              padding: const EdgeInsets.symmetric(vertical: 3),
              child: Row(
                children: [
                  SizedBox(width: 24, child: Text('#${e.key + 1}',
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: OrdoColors.mutedForeground))),
                  Expanded(child: Text(r['name'] ?? 'Anonymous',
                      style: TextStyle(fontSize: 13, color: OrdoColors.foreground), overflow: TextOverflow.ellipsis)),
                  Text('${r['score']}%',
                      style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: OrdoColors.foreground)),
                ],
              ),
            );
          }),
        if (myRank != null)
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Text('Your rank: #$myRank',
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: OrdoColors.primary)),
          )
        else
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Text("You haven't joined this challenge.",
                style: TextStyle(fontSize: 12, color: OrdoColors.mutedForeground)),
          ),
      ],
    );
  }

  Future<void> _createChallenge() async {
    if (_nameCtrl.text.trim().isEmpty) return;
    final days = int.tryParse(_daysCtrl.text) ?? 30;
    try {
      final now = DateFormat('yyyy-MM-dd').format(DateTime.now());
      final ends = DateFormat('yyyy-MM-dd').format(DateTime.now().add(Duration(days: days)));
      await OrdoDb.createChallenge(_nameCtrl.text.trim(), now, ends);
      _nameCtrl.clear();
      widget.onRefresh();
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Challenge created — you\'re the first member.')),
      );
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error: $e')),
      );
    }
  }

  Future<void> _toggleBoard(String challengeId) async {
    if (_openBoardId == challengeId) {
      setState(() { _openBoardId = null; _board = null; });
      return;
    }
    setState(() { _openBoardId = challengeId; _boardBusy = true; _board = null; });
    try {
      final res = await OrdoDb.challengeLeaderboard(challengeId);
      if (mounted) setState(() { _board = res; _boardBusy = false; });
    } catch (e) {
      if (mounted) setState(() { _board = null; _boardBusy = false; });
    }
  }
}

// ─── Settings & Data Section ───────────────────────────────────────────

class _SettingsSection extends StatelessWidget {
  final VoidCallback? onLoginRequired;

  const _SettingsSection({this.onLoginRequired});

  @override
  Widget build(BuildContext context) {
    return Panel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          PanelTitle(title: 'Settings & data', hint: 'Your data, your rules — GDPR-style controls.'),
          const SizedBox(height: 8),
          Text('Data & privacy', style: TextStyle(fontWeight: FontWeight.w500, color: OrdoColors.foreground)),
          const SizedBox(height: 4),
          Text(
            'Everything is exportable (JSON, CSV, iCal) from the header. Version history keeps the last 30 snapshots — use the Undo button in the menu to step back.',
            style: TextStyle(fontSize: 13, color: OrdoColors.mutedForeground),
          ),
          const SizedBox(height: 16),
          // Delete account
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              border: Border.all(color: OrdoColors.destructive.withValues(alpha: 0.4)),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Delete account', style: TextStyle(fontWeight: FontWeight.w500, color: OrdoColors.destructive)),
                const SizedBox(height: 4),
                Text(
                  'Permanently removes your account, sync state, pairings, letters and memberships. This cannot be undone.',
                  style: TextStyle(fontSize: 13, color: OrdoColors.mutedForeground),
                ),
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton(
                    onPressed: () => _confirmDelete(context),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: OrdoColors.destructive,
                      side: BorderSide(color: OrdoColors.destructive),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    ),
                    child: const Text('Delete my account'),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  void _confirmDelete(BuildContext context) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: OrdoColors.card,
        title: const Text('Delete your Ordo account?', style: TextStyle(color: OrdoColors.foreground)),
        content: const Text(
          'All synced data is wiped from the server. Export anything you want to keep first. This cannot be undone.',
          style: TextStyle(color: OrdoColors.mutedForeground),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text('Keep my account', style: TextStyle(color: OrdoColors.mutedForeground)),
          ),
          TextButton(
            onPressed: () async {
              Navigator.pop(ctx);
              try {
                await OrdoDb.deleteAccount();
                if (context.mounted) {
                  context.read<AuthProvider>().logout();
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Account and all data deleted.')),
                  );
                }
              } catch (e) {
                if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text('Error: $e')),
                );
              }
            },
            child: Text('Delete forever', style: TextStyle(color: OrdoColors.destructive)),
          ),
        ],
      ),
    );
  }
}

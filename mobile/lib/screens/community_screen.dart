import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../services/auth_provider.dart';
import '../services/categories_provider.dart';
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
  List<Map<String, dynamic>> _requests = [];
  List<Map<String, dynamic>> _challenges = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    final results = await Future.wait([
      OrdoDb.listPeers(),
      OrdoDb.listPairingRequests(),
      OrdoDb.listChallenges(),
    ]);
    if (mounted) {
      setState(() {
        _peers = results[0];
        _requests = results[1];
        _challenges = results[2];
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
            _PeerSection(peers: _peers, requests: _requests, onRefresh: _loadData),
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
  final List<Map<String, dynamic>> requests;
  final VoidCallback onRefresh;

  const _PeerSection({required this.peers, required this.requests, required this.onRefresh});

  @override
  State<_PeerSection> createState() => _PeerSectionState();
}

class _PeerSectionState extends State<_PeerSection> {
  final _emailCtrl = TextEditingController();
  bool _busy = false;
  String? _reqBusy;

  @override
  void dispose() {
    _emailCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final incoming = widget.requests.where((r) => r['direction'] == 'incoming').toList();
    final outgoing = widget.requests.where((r) => r['direction'] == 'outgoing').toList();

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
                  onPressed: _busy ? null : _invitePeer,
                  icon: _busy
                      ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                      : const Icon(Icons.person_add, size: 18),
                  label: const Text('Invite'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // Invites waiting on this account. Accepting is what creates the
          // pairing — sending one never does.
          if (incoming.isNotEmpty) ...[
            Text('Waiting on you',
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: OrdoColors.foreground)),
            const SizedBox(height: 6),
            ...incoming.map((r) => _requestTile(r, incoming: true)),
          ],
          if (outgoing.isNotEmpty) ...[
            Text('Sent',
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: OrdoColors.foreground)),
            const SizedBox(height: 6),
            ...outgoing.map((r) => _requestTile(r, incoming: false)),
          ],

          if (widget.peers.isEmpty && widget.requests.isEmpty)
            Text('No partners yet. Invite someone by email — they choose whether to accept.',
                style: TextStyle(fontSize: 13, color: OrdoColors.mutedForeground))
          else
            ...widget.peers.map((p) {
              // `weekly` is null until there is a logged day in the last week;
              // 0 would claim they did nothing, which is a different statement.
              final weekly = p['weekly'] as num?;
              final name = '${p['name'] ?? p['email'] ?? 'Unknown'}';
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
                      child: Text(name.isEmpty ? '?' : name[0].toUpperCase(),
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
                      child: Text(weekly == null ? '—' : '${weekly.toInt()}%',
                          style: const TextStyle(fontFamily: 'SpaceGrotesk', fontWeight: FontWeight.w600, fontSize: 14)),
                    ),
                    const SizedBox(width: 8),
                    GestureDetector(
                      onTap: () => _unpair('${p['id']}'),
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

  Widget _requestTile(Map<String, dynamic> r, {required bool incoming}) {
    final id = '${r['id']}';
    final email = '${r['peer_email'] ?? ''}';
    final name = r['peer_name'] as String?;
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
          Icon(incoming ? Icons.mark_email_unread_outlined : Icons.send_outlined,
              size: 18, color: OrdoColors.mutedForeground),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(name == null || name.isEmpty ? email : name,
                    style: const TextStyle(color: OrdoColors.foreground), overflow: TextOverflow.ellipsis),
                if (name != null && name.isNotEmpty)
                  Text(email, style: TextStyle(fontSize: 11, color: OrdoColors.mutedForeground)),
              ],
            ),
          ),
          if (_reqBusy == id)
            const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
          else if (incoming) ...[
            GestureDetector(
              onTap: () => _respond(id, 'accept'),
              child: const Icon(Icons.check, size: 20, color: Colors.green),
            ),
            const SizedBox(width: 12),
            GestureDetector(
              onTap: () => _respond(id, 'decline'),
              child: Icon(Icons.close, size: 20, color: OrdoColors.destructive),
            ),
          ] else
            GestureDetector(
              onTap: () => _withdraw(id),
              child: Text('Withdraw', style: TextStyle(fontSize: 12, color: OrdoColors.mutedForeground)),
            ),
        ],
      ),
    );
  }

  void _toast(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _invitePeer() async {
    if (_emailCtrl.text.trim().isEmpty) return;
    setState(() => _busy = true);
    try {
      await OrdoDb.pairWithEmail(_emailCtrl.text.trim());
      _emailCtrl.clear();
      widget.onRefresh();
      // Deliberately identical whether or not that address has an account:
      // anything else turns this field into an account-enumeration probe.
      _toast('Invite sent — they have to accept before either of you sees anything.');
    } catch (e) {
      _toast('$e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _respond(String id, String response) async {
    setState(() => _reqBusy = id);
    try {
      await OrdoDb.respondToPairingRequest(id, response);
      widget.onRefresh();
      _toast(response == 'accept' ? 'Paired.' : 'Invite declined.');
    } catch (e) {
      _toast('$e');
    } finally {
      if (mounted) setState(() => _reqBusy = null);
    }
  }

  Future<void> _withdraw(String id) async {
    setState(() => _reqBusy = id);
    try {
      await OrdoDb.cancelPairingRequest(id);
      widget.onRefresh();
      _toast('Invite withdrawn');
    } catch (e) {
      _toast('$e');
    } finally {
      if (mounted) setState(() => _reqBusy = null);
    }
  }

  Future<void> _unpair(String peerId) async {
    try {
      await OrdoDb.unpair(peerId);
      widget.onRefresh();
      _toast('Pairing removed');
    } catch (e) {
      _toast('$e');
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

/// Status is derived server-side from the dates on every read, so these four
/// are the only values that can arrive.
const Map<String, Color> _statusColor = {
  'active': OrdoColors.primary,
  'upcoming': OrdoColors.mutedForeground,
  'completed': OrdoColors.mutedForeground,
  'cancelled': OrdoColors.destructive,
};

class _ChallengeSectionState extends State<_ChallengeSection> {
  final _nameCtrl = TextEditingController();
  final _daysCtrl = TextEditingController(text: '30');
  final _floorCtrl = TextEditingController(text: '30');
  final _codeCtrl = TextEditingController();
  String _category = 'general';
  bool _private = false;
  bool _createBusy = false;
  bool _codeBusy = false;

  String? _openBoardId;
  Map<String, dynamic>? _board;
  Map<String, dynamic>? _breakdown;
  bool _boardBusy = false;
  String? _routineChallengeId;
  Map<String, dynamic>? _routineData;
  bool _routineBusy = false;

  @override
  void dispose() {
    _nameCtrl.dispose();
    _daysCtrl.dispose();
    _floorCtrl.dispose();
    _codeCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final cats = context.watch<CategoriesProvider>().all();

    return Panel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          PanelTitle(
            title: 'Challenges',
            hint: 'Score = 70% completion, 20% consistency, 10% participation. '
                'Rank is public; your days are not.',
          ),
          const SizedBox(height: 8),

          // Create form. The name gets its own line on a phone; the numbers and
          // the action share the next one because none of them needs the width.
          TextField(
            controller: _nameCtrl,
            maxLength: 80,
            decoration: InputDecoration(
              hintText: 'e.g. 30 days of study',
              isDense: true,
              counterText: '',
              contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
            ),
            style: TextStyle(color: OrdoColors.foreground),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(child: _dropdown<String>(
                value: _category,
                items: [
                  const DropdownMenuItem(value: 'general', child: Text('Any category')),
                  ...cats.map((c) => DropdownMenuItem(value: c.id, child: Text(c.label))),
                ],
                onChanged: (v) => setState(() => _category = v ?? 'general'),
              )),
              const SizedBox(width: 8),
              Expanded(child: _dropdown<bool>(
                value: _private,
                items: const [
                  DropdownMenuItem(value: false, child: Text('Public')),
                  DropdownMenuItem(value: true, child: Text('Invite code only')),
                ],
                onChanged: (v) => setState(() => _private = v ?? false),
              )),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              SizedBox(width: 72, child: _numField(_daysCtrl, 'd')),
              const SizedBox(width: 6),
              Text('days', style: TextStyle(fontSize: 11, color: OrdoColors.mutedForeground)),
              const SizedBox(width: 10),
              SizedBox(width: 72, child: _numField(_floorCtrl, 'm')),
              const SizedBox(width: 6),
              Expanded(
                child: Text('min/day to count',
                    style: TextStyle(fontSize: 11, color: OrdoColors.mutedForeground)),
              ),
              SizedBox(
                height: 40,
                child: ElevatedButton.icon(
                  onPressed: _createBusy ? null : _createChallenge,
                  icon: _createBusy
                      ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                      : const Icon(Icons.flag, size: 16),
                  label: const Text('Create'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _codeCtrl,
                  textCapitalization: TextCapitalization.characters,
                  decoration: InputDecoration(
                    hintText: 'Have a code? e.g. K7MPQ2XZ',
                    isDense: true,
                    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                  style: TextStyle(color: OrdoColors.foreground, fontFamily: 'SpaceGrotesk'),
                  onSubmitted: (_) => _joinByCode(),
                ),
              ),
              const SizedBox(width: 8),
              SizedBox(
                height: 40,
                child: OutlinedButton.icon(
                  onPressed: _codeBusy ? null : _joinByCode,
                  icon: _codeBusy
                      ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                      : const Icon(Icons.vpn_key_outlined, size: 16),
                  label: const Text('Join'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: OrdoColors.mutedForeground,
                    side: BorderSide(color: OrdoColors.border),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),

          if (widget.challenges.isEmpty)
            Text('No challenges yet — start one.',
                style: TextStyle(fontSize: 13, color: OrdoColors.mutedForeground))
          else
            ...widget.challenges.map(_challengeCard),
        ],
      ),
    );
  }

  Widget _dropdown<T>({
    required T value,
    required List<DropdownMenuItem<T>> items,
    required ValueChanged<T?> onChanged,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12),
      decoration: BoxDecoration(
        border: Border.all(color: OrdoColors.border),
        borderRadius: BorderRadius.circular(8),
      ),
      child: DropdownButton<T>(
        value: value,
        isExpanded: true,
        isDense: true,
        dropdownColor: OrdoColors.card,
        underline: const SizedBox(),
        style: TextStyle(color: OrdoColors.foreground, fontSize: 13),
        items: items,
        onChanged: onChanged,
      ),
    );
  }

  Widget _numField(TextEditingController ctrl, String suffix) {
    return TextField(
      controller: ctrl,
      keyboardType: TextInputType.number,
      decoration: InputDecoration(
        isDense: true,
        contentPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
        suffixText: suffix,
      ),
      style: TextStyle(color: OrdoColors.foreground),
    );
  }

  Widget _challengeCard(Map<String, dynamic> c) {
    final id = '${c['id']}';
    final status = '${c['status'] ?? 'active'}';
    final joined = c['joined'] == true;
    final isOwner = c['is_owner'] == true;
    final members = (c['members'] as num?)?.toInt() ?? 0;
    final dayIndex = (c['day_index'] as num?)?.toInt() ?? 0;
    final totalDays = (c['total_days'] as num?)?.toInt() ?? 0;
    final myScore = c['my_score'] as num?;
    final inviteCode = c['invite_code'] as String?;
    final joinable = !joined && status != 'completed' && status != 'cancelled';
    final isOpen = _openBoardId == id;
    final pct = totalDays == 0 ? 0.0 : (dayIndex / totalDays).clamp(0.0, 1.0);

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
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(joined ? Icons.check_circle : Icons.emoji_events,
                  color: joined ? Colors.green : OrdoColors.primary, size: 20),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        if (c['visibility'] == 'private') ...[
                          Icon(Icons.lock_outline, size: 12, color: OrdoColors.mutedForeground),
                          const SizedBox(width: 4),
                        ],
                        Expanded(
                          child: Text('${c['name'] ?? ''}',
                              style: const TextStyle(fontWeight: FontWeight.w600, color: OrdoColors.foreground)),
                        ),
                      ],
                    ),
                    Text(
                      '${_fmtDay(c['start_at'])} → ${_fmtDay(c['end_at'])} · '
                      '$members member${members == 1 ? '' : 's'} · '
                      '${(c['min_daily_minutes'] as num?)?.toInt() ?? 0} min/day',
                      style: TextStyle(fontSize: 12, color: OrdoColors.mutedForeground),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: (_statusColor[status] ?? OrdoColors.mutedForeground).withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  status.isEmpty ? '' : status[0].toUpperCase() + status.substring(1),
                  style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w500,
                      color: _statusColor[status] ?? OrdoColors.mutedForeground),
                ),
              ),
            ],
          ),

          if (joined && status != 'cancelled') ...[
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(3),
                    child: LinearProgressIndicator(
                      value: pct.toDouble(),
                      minHeight: 6,
                      backgroundColor: OrdoColors.muted,
                      valueColor: const AlwaysStoppedAnimation(OrdoColors.primary),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                // `my_score` is null until the window opens — a 0 there would
                // read as "you failed" rather than "nothing has happened yet".
                Text(
                  'Day $dayIndex / $totalDays${myScore == null ? '' : ' · ${myScore.toInt()}%'}',
                  style: TextStyle(fontSize: 11, color: OrdoColors.mutedForeground),
                ),
              ],
            ),
          ],

          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 4,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              if (joinable)
                _smallButton('Join', () => _join(id)),
              if (joined && status == 'active')
                _smallButton('Leave', () => _leave(id)),
              _smallButton(
                'Leaderboard',
                () => _toggleBoard(id),
                icon: isOpen ? Icons.expand_less : Icons.expand_more,
              ),
              // The code is a capability: the server only returns it to the
              // owner and to members, so its presence is the permission check.
              if (inviteCode != null)
                _smallButton(inviteCode, () => _copyCode(inviteCode), icon: Icons.copy, mono: true),
               if (isOwner && (status == 'upcoming' || status == 'active'))
                 _smallButton('Cancel', () => _cancel(id),
                     icon: Icons.block, color: OrdoColors.destructive),
               if (isOwner && (status == 'upcoming' || status == 'active'))
                 _smallButton(_routineChallengeId == id ? 'Save' : 'Routine',
                     () => _toggleRoutine(id),
                     icon: _routineChallengeId == id ? Icons.save : Icons.edit),
             ],
           ),

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
               Text('Could not load the leaderboard.',
                   style: TextStyle(fontSize: 12, color: OrdoColors.mutedForeground)),
             // Challenge routine display
             if (_routineChallengeId == id) ...[
               const SizedBox(height: 8),
               Container(height: 1, color: OrdoColors.border),
               const SizedBox(height: 8),
               if (_routineBusy)
                 const Center(child: Padding(
                   padding: EdgeInsets.all(8),
                   child: SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)),
                 ))
               else if (_routineData != null)
                 _buildRoutine(_routineData!),
               if (_routineData != null) ...[
                 const SizedBox(height: 4),
                 Text(
                   _routineData!['locked_at'] != null
                       ? 'Routine is locked — cannot edit'
                       : 'Locked until first member joins',
                   style: TextStyle(fontSize: 11, color: OrdoColors.mutedForeground),
                 ),
               ],
             ],
           ],
         ],
       ),
     );
   }

  Widget _smallButton(String label, VoidCallback onTap,
      {IconData? icon, Color? color, bool mono = false}) {
    final fg = color ?? OrdoColors.mutedForeground;
    return OutlinedButton(
      onPressed: onTap,
      style: OutlinedButton.styleFrom(
        foregroundColor: fg,
        side: BorderSide(color: OrdoColors.border),
        padding: const EdgeInsets.symmetric(horizontal: 10),
        minimumSize: const Size(0, 34),
        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      ),
      child: Row(
        children: [
          if (icon != null) ...[Icon(icon, size: 16), const SizedBox(width: 4)],
          Text(label,
              style: TextStyle(fontSize: 12, fontFamily: mono ? 'SpaceGrotesk' : null)),
        ],
      ),
    );
  }

  Widget _buildLeaderboard(Map<String, dynamic> data) {
    final rows = List<Map<String, dynamic>>.from((data['leaderboard'] as List?) ?? []);
    final myRank = (data['myRank'] as num?)?.toInt();
    final total = (data['totalMembers'] as num?)?.toInt() ?? rows.length;
    final isFinal = rows.any((r) => r['is_final'] == true);
    final b = _breakdown;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (rows.isEmpty)
          Text('No participants yet.', style: TextStyle(fontSize: 12, color: OrdoColors.mutedForeground))
        else
          ...rows.map((r) {
            final isMe = r['is_me'] == true;
            return Padding(
              padding: const EdgeInsets.symmetric(vertical: 3),
              child: Row(
                children: [
                  // The server's rank, not the list position — ties share a
                  // number, and "top five plus your own row" is not contiguous.
                  SizedBox(
                    width: 26,
                    child: Text('#${r['rank']}',
                        style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: isMe ? OrdoColors.primary : OrdoColors.mutedForeground)),
                  ),
                  Expanded(
                    child: Text(
                      '${r['name'] ?? 'Anonymous'}${r['has_left'] == true ? ' (left)' : ''}',
                      style: TextStyle(
                          fontSize: 13,
                          fontWeight: isMe ? FontWeight.w600 : FontWeight.w400,
                          color: isMe ? OrdoColors.primary : OrdoColors.foreground),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  Text('${(r['score'] as num?)?.toInt() ?? 0}%',
                      style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w500,
                          color: isMe ? OrdoColors.primary : OrdoColors.foreground)),
                ],
              ),
            );
          }),
        Padding(
          padding: const EdgeInsets.only(top: 6),
          child: Text(
            '${myRank != null ? 'You are #$myRank of $total' : '$total ranked · you have not joined'}'
            '${isFinal ? ' · final' : ''}',
            style: TextStyle(
                fontSize: 12,
                fontWeight: myRank != null ? FontWeight.w500 : FontWeight.w400,
                color: myRank != null ? OrdoColors.primary : OrdoColors.mutedForeground),
          ),
        ),
        if (b != null)
          Padding(
            padding: const EdgeInsets.only(top: 2),
            child: Text(
              'Completion ${_pctText(b['completion'])} · consistency ${_pctText(b['consistency'])}'
              ' · participation ${_pctText(b['participation'])} '
              '(${b['active_days'] ?? 0} of ${b['window_days'] ?? 0} days logged)',
              style: TextStyle(fontSize: 11, color: OrdoColors.mutedForeground),
            ),
          ),
       ],
     );
   }

   Widget _buildRoutine(Map<String, dynamic> data) {
     final routine = data['routine'] as Map<String, dynamic>? ?? {};
     final locked = data['locked_at'] != null;
     return Container(
       padding: const EdgeInsets.all(8),
       decoration: BoxDecoration(
         color: OrdoColors.card,
         border: Border.all(color: OrdoColors.border),
         borderRadius: BorderRadius.circular(8),
       ),
       child: Column(
         crossAxisAlignment: CrossAxisAlignment.start,
         children: [
           if (locked)
             Text('Locked routine', style: TextStyle(fontSize: 11, color: OrdoColors.mutedForeground)),
           ...routine.entries.map((e) {
             final day = e.key;
             final blocks = e.value as List;
             return Padding(
               padding: const EdgeInsets.symmetric(vertical: 2),
               child: Text(
                 'Day $day: ${blocks.map((b) => '${b['title'] ?? ''} (${b['category'] ?? ''}, ${b['start'] ?? ''}–${b['end'] ?? ''})').join(', ')}',
                 style: TextStyle(fontSize: 11, color: OrdoColors.foreground),
               ),
             );
           }),
         ],
       ),
     );
   }

   void _toast(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _createChallenge() async {
    if (_nameCtrl.text.trim().isEmpty) return;
    setState(() => _createBusy = true);
    try {
      await OrdoDb.createChallenge(
        _nameCtrl.text.trim(),
        int.tryParse(_daysCtrl.text) ?? 30,
        category: _category,
        private: _private,
        minDailyMinutes: int.tryParse(_floorCtrl.text) ?? 30,
      );
      _nameCtrl.clear();
      widget.onRefresh();
      _toast(_private
          ? 'Created. Share the invite code to let people in.'
          : 'Created — you are the first member.');
    } catch (e) {
      _toast('$e');
    } finally {
      if (mounted) setState(() => _createBusy = false);
    }
  }

  Future<void> _joinByCode() async {
    if (_codeCtrl.text.trim().isEmpty) return;
    setState(() => _codeBusy = true);
    try {
      final id = await OrdoDb.joinChallengeByCode(_codeCtrl.text.trim());
      _codeCtrl.clear();
      widget.onRefresh();
      _toast('Joined.');
      // Open the board of whatever the code let us into, so it is obvious
      // which of the listed challenges just changed.
      await _openBoard(id);
    } catch (e) {
      _toast('Could not join with that code');
    } finally {
      if (mounted) setState(() => _codeBusy = false);
    }
  }

  Future<void> _join(String id) async {
    try {
      await OrdoDb.joinChallenge(id);
      widget.onRefresh();
      _toast('Joined. Rank is by score — nobody sees what your days contain.');
    } catch (e) {
      _toast('Could not join');
    }
  }

  Future<void> _leave(String id) async {
    try {
      await OrdoDb.leaveChallenge(id);
      widget.onRefresh();
      _toast('Left the challenge — your score so far stays ranked.');
    } catch (e) {
      _toast('Could not leave');
    }
  }

  Future<void> _cancel(String id) async {
    try {
      await OrdoDb.cancelChallenge(id);
      widget.onRefresh();
      _toast('Cancelled. It will not be scored.');
    } catch (e) {
      _toast('Could not cancel');
    }
  }

  Future<void> _copyCode(String code) async {
    await Clipboard.setData(ClipboardData(text: code));
    _toast('Invite code copied');
  }

   Future<void> _toggleRoutine(String challengeId) async {
     if (_routineChallengeId == challengeId) {
       setState(() {
         _routineChallengeId = null;
         _routineData = null;
       });
       return;
     }
     setState(() {
       _routineChallengeId = challengeId;
       _routineBusy = true;
       _routineData = null;
     });
     try {
       final data = await OrdoDb.getChallengeRoutine(challengeId);
       if (mounted) {
         setState(() {
           _routineData = data;
           _routineBusy = false;
         });
       }
     } catch (_) {
       if (mounted) setState(() => _routineBusy = false);
     }
   }

   Future<void> _toggleBoard(String challengeId) async {
     if (_openBoardId == challengeId) {
       setState(() {
         _openBoardId = null;
         _board = null;
         _breakdown = null;
       });
       return;
     }
     await _openBoard(challengeId);
   }

  Future<void> _openBoard(String challengeId) async {
    setState(() {
      _openBoardId = challengeId;
      _boardBusy = true;
      _board = null;
      _breakdown = null;
    });
    // Both calls swallow their own failures, so a missing breakdown (which is
    // what a non-member gets) cannot blank out the leaderboard beside it.
    final results = await Future.wait([
      OrdoDb.challengeLeaderboard(challengeId),
      OrdoDb.challengeBreakdown(challengeId),
    ]);
    if (!mounted) return;
    setState(() {
      _board = results[0];
      _breakdown = results[1];
      _boardBusy = false;
    });
  }
}

/// Null means "no result yet", which is not the same statement as 0%.
String _pctText(dynamic v) => v == null ? '—%' : '${(v as num).toInt()}%';

String _fmtDay(dynamic iso) {
  final parsed = DateTime.tryParse('${iso ?? ''}');
  return parsed == null ? '—' : DateFormat('MMM d').format(parsed.toLocal());
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
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('Error: $e')),
                  );
                }
              }
            },
            child: Text('Delete forever', style: TextStyle(color: OrdoColors.destructive)),
          ),
        ],
      ),
    );
  }
}

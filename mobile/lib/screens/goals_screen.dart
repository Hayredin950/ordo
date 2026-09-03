import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/ordo_state.dart';
import '../services/state_provider.dart';
import '../services/auth_provider.dart';
import '../services/db.dart';
import '../utils/ordo.dart';
import '../widgets/app_widgets.dart';
import '../themes/app_theme.dart';

const _periods = ['year', 'semester', 'month', 'week', 'day'];

class GoalsScreen extends StatefulWidget {
  final VoidCallback? onLoginRequired;

  const GoalsScreen({super.key, this.onLoginRequired});

  @override
  State<GoalsScreen> createState() => _GoalsScreenState();
}

class _GoalsScreenState extends State<GoalsScreen> {
  static const _categories = ['health', 'study', 'work', 'finance', 'spiritual', 'relationships'];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Consumer<OrdoProvider>(
        builder: (context, prov, _) {
          final state = prov.state;
          if (state == null) return const Center(child: CircularProgressIndicator());

          return RefreshIndicator(
            onRefresh: () async => Future.delayed(const Duration(milliseconds: 300)),
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                // ── Goal hierarchy (all periods with rollup %) ──
                PanelTitle(title: 'Goal hierarchy', hint: 'Year rolls down to the day; the day rolls back up.'),
                const SizedBox(height: 8),
                ..._periods.map((p) {
                  final periodGoals = state.goals.where((g) => g.period == p).toList();
                  final actual = _periodScore(state, p);
                  return _PeriodSection(
                    period: p,
                    goals: periodGoals,
                    rollup: actual,
                    onLoginRequired: widget.onLoginRequired,
                  );
                }),
                const SizedBox(height: 24),

                // ── New goal form ──
                _NewGoalForm(),
                const SizedBox(height: 24),

                // ── Future-self letter (moved from community to match web) ──
                _FutureSelfLetter(onLoginRequired: widget.onLoginRequired),
              ],
            ),
          );
        },
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () {
          if (!context.read<AuthProvider>().isLoggedIn) {
            widget.onLoginRequired?.call();
            return;
          }
          _showQuickAddGoal(context);
        },
        backgroundColor: OrdoColors.primary,
        child: Icon(Icons.add, color: OrdoColors.primaryForeground),
      ),
    );
  }

  int _periodScore(OrdoState state, String period) {
    final today = DateTime.now();
    switch (period) {
      case 'day':
        return rangeScore(state, today, 1);
      case 'week':
        return rangeScore(state, startOfWeek(today), 7);
      case 'month':
        return rangeScore(state, addDays(today, -29), 30);
      case 'semester':
        return rangeScore(state, addDays(today, -119), 120);
      default:
        return rangeScore(state, addDays(today, -179), 180);
    }
  }

  void _showQuickAddGoal(BuildContext context) {
    final titleCtrl = TextEditingController();
    final targetCtrl = TextEditingController(text: '80');
    String category = 'work';
    String period = 'week';

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: OrdoColors.surface,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setSheetState) {
            return Padding(
              padding: EdgeInsets.fromLTRB(24, 24, 24, MediaQuery.of(ctx).viewInsets.bottom + 24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text('Add Goal', style: TextStyle(fontFamily: 'SpaceGrotesk', fontSize: 20, fontWeight: FontWeight.w700)),
                  const SizedBox(height: 16),
                  TextField(controller: titleCtrl, decoration: const InputDecoration(hintText: 'What do you want to be true?'), autofocus: true),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12),
                          decoration: BoxDecoration(border: Border.all(color: OrdoColors.border), borderRadius: BorderRadius.circular(8)),
                          child: DropdownButton<String>(
                            value: period,
                            isExpanded: true,
                            dropdownColor: OrdoColors.card,
                            underline: const SizedBox(),
                            items: _periods.map((p) => DropdownMenuItem(value: p, child: Text(p, style: TextStyle(color: OrdoColors.foreground)))).toList(),
                            onChanged: (v) => setSheetState(() => period = v ?? 'week'),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12),
                          decoration: BoxDecoration(border: Border.all(color: OrdoColors.border), borderRadius: BorderRadius.circular(8)),
                          child: DropdownButton<String>(
                            value: category,
                            isExpanded: true,
                            dropdownColor: OrdoColors.card,
                            underline: const SizedBox(),
                            items: _categories.map((c) => DropdownMenuItem(value: c, child: Text(c[0].toUpperCase() + c.substring(1), style: TextStyle(color: OrdoColors.foreground)))).toList(),
                            onChanged: (v) => setSheetState(() => category = v ?? 'work'),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  TextField(controller: targetCtrl, decoration: const InputDecoration(hintText: 'Target %', suffixText: '%'), keyboardType: TextInputType.number),
                  const SizedBox(height: 16),
                  SizedBox(
                    height: 48,
                    child: ElevatedButton(
                      onPressed: () {
                        if (titleCtrl.text.trim().isNotEmpty) {
                          context.read<OrdoProvider>().update((s) => s.copyWith(
                            goals: [...s.goals, Goal(
                              id: DateTime.now().millisecondsSinceEpoch.toString(),
                              title: titleCtrl.text.trim(),
                              period: period, category: category,
                              target: double.tryParse(targetCtrl.text) ?? 80,
                            )],
                          ));
                          Navigator.pop(ctx);
                        }
                      },
                      child: const Text('Add'),
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }
}

// ─── Period Section ────────────────────────────────────────────────────

class _PeriodSection extends StatelessWidget {
  final String period;
  final List<Goal> goals;
  final int rollup;
  final VoidCallback? onLoginRequired;

  const _PeriodSection({
    required this.period,
    required this.goals,
    required this.rollup,
    this.onLoginRequired,
  });

  @override
  Widget build(BuildContext context) {
    return Panel(
      margin: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(period.toUpperCase(),
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, letterSpacing: 1, color: OrdoColors.mutedForeground)),
              Text('rollup $rollup%',
                  style: TextStyle(fontSize: 11, color: OrdoColors.mutedForeground)),
            ],
          ),
          const SizedBox(height: 8),
          if (goals.isEmpty)
            Text('No $period goal set.', style: TextStyle(fontSize: 13, color: OrdoColors.mutedForeground))
          else
            ...goals.map((g) => _GoalTile(goal: g, rollup: rollup, onLoginRequired: onLoginRequired)),
        ],
      ),
    );
  }
}

// ─── Goal Tile ─────────────────────────────────────────────────────────

class _GoalTile extends StatelessWidget {
  final Goal goal;
  final int rollup;
  final VoidCallback? onLoginRequired;

  const _GoalTile({required this.goal, required this.rollup, this.onLoginRequired});

  @override
  Widget build(BuildContext context) {
    final progress = (rollup / goal.target).clamp(0.0, 1.0);
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
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
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(goal.title, style: const TextStyle(fontWeight: FontWeight.w500, color: OrdoColors.foreground)),
                    const SizedBox(height: 4),
                    CategoryPill(id: goal.category),
                  ],
                ),
              ),
              PopupMenuButton<String>(
                onSelected: (val) {
                  if (!context.read<AuthProvider>().isLoggedIn) {
                    onLoginRequired?.call();
                    return;
                  }
                  if (val == 'delete') {
                    context.read<OrdoProvider>().update((s) => s.copyWith(
                      goals: List.from(s.goals)..removeWhere((g) => g.id == goal.id),
                    ));
                  }
                },
                itemBuilder: (context) => [
                  const PopupMenuItem(value: 'delete', child: Text('Delete')),
                ],
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: LinearProgressIndicator(
                  value: progress,
                  backgroundColor: OrdoColors.border,
                  valueColor: AlwaysStoppedAnimation(OrdoColors.primary),
                  minHeight: 6,
                  borderRadius: BorderRadius.circular(3),
                ),
              ),
              const SizedBox(width: 10),
              Text('$rollup% / ${goal.target.toInt()}%',
                  style: TextStyle(fontSize: 12, color: OrdoColors.mutedForeground)),
            ],
          ),
        ],
      ),
    );
  }
}

// ─── New Goal Form (inline panel) ──────────────────────────────────────

class _NewGoalForm extends StatefulWidget {
  @override
  State<_NewGoalForm> createState() => _NewGoalFormState();
}

class _NewGoalFormState extends State<_NewGoalForm> {
  final _titleCtrl = TextEditingController();
  String _period = 'week';
  String _category = 'work';

  static const _categories = ['health', 'study', 'work', 'finance', 'spiritual', 'relationships'];

  @override
  Widget build(BuildContext context) {
    return Panel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          PanelTitle(title: 'New goal'),
          const SizedBox(height: 8),
          TextField(
            controller: _titleCtrl,
            decoration: InputDecoration(
              hintText: 'What do you want to be true?',
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
            ),
            style: TextStyle(color: OrdoColors.foreground),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  decoration: BoxDecoration(border: Border.all(color: OrdoColors.border), borderRadius: BorderRadius.circular(8)),
                  child: DropdownButton<String>(
                    value: _period,
                    isExpanded: true,
                    dropdownColor: OrdoColors.card,
                    underline: const SizedBox(),
                    items: _periods.map((p) => DropdownMenuItem(value: p, child: Text(p, style: TextStyle(color: OrdoColors.foreground)))).toList(),
                    onChanged: (v) => setState(() => _period = v ?? 'week'),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  decoration: BoxDecoration(border: Border.all(color: OrdoColors.border), borderRadius: BorderRadius.circular(8)),
                  child: DropdownButton<String>(
                    value: _category,
                    isExpanded: true,
                    dropdownColor: OrdoColors.card,
                    underline: const SizedBox(),
                    items: _categories.map((c) => DropdownMenuItem(value: c, child: Text(c[0].toUpperCase() + c.substring(1), style: TextStyle(color: OrdoColors.foreground)))).toList(),
                    onChanged: (v) => setState(() => _category = v ?? 'work'),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: () {
                if (_titleCtrl.text.trim().isEmpty) return;
                context.read<OrdoProvider>().update((s) => s.copyWith(
                  goals: [...s.goals, Goal(
                    id: DateTime.now().millisecondsSinceEpoch.toString(),
                    title: _titleCtrl.text.trim(),
                    period: _period, category: _category, target: 80,
                  )],
                ));
                _titleCtrl.clear();
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Goal added')),
                );
              },
              icon: const Icon(Icons.add, size: 18),
              label: const Text('Add goal'),
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Future-Self Letter ────────────────────────────────────────────────

class _FutureSelfLetter extends StatefulWidget {
  final VoidCallback? onLoginRequired;

  const _FutureSelfLetter({this.onLoginRequired});

  @override
  State<_FutureSelfLetter> createState() => _FutureSelfLetterState();
}

class _FutureSelfLetterState extends State<_FutureSelfLetter> {
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
          PanelTitle(
            title: 'Future-self letter',
            hint: 'Sealed until the deadline, delivered by the bot — win or lose.',
          ),
          const SizedBox(height: 8),
          if (!context.read<AuthProvider>().isLoggedIn)
            Text('Sign in to write a letter to your future self. It stays sealed until the deadline you set, then the bot delivers it — win or lose.',
                style: TextStyle(fontSize: 13, color: OrdoColors.mutedForeground))
          else ...[
            // Create letter form
            _LetterForm(onCreated: _load),
            const SizedBox(height: 12),
            // Existing letters
            if (_loading)
              const Center(child: CircularProgressIndicator())
            else if (_letters.isEmpty)
              Text('No letters sealed yet.', style: TextStyle(fontSize: 13, color: OrdoColors.mutedForeground))
            else
              ..._letters.map((l) {
                final delivered = l['delivered'] ?? false;
                final deadline = l['deadline'] ?? '';
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
                      Icon(delivered ? Icons.mark_email_read : Icons.mail_outline,
                          color: delivered ? Colors.green : OrdoColors.primary, size: 20),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(l['goal_title'] ?? '', style: const TextStyle(fontWeight: FontWeight.w500, color: OrdoColors.foreground)),
                            Text(
                              delivered ? 'delivered ✓' : 'delivers $deadline · sealed',
                              style: TextStyle(fontSize: 12, color: OrdoColors.mutedForeground),
                            ),
                          ],
                        ),
                      ),
                      GestureDetector(
                        onTap: () async {
                          await OrdoDb.deleteLetter(l['id']);
                          _load();
                        },
                        child: Icon(Icons.delete_outline, size: 18, color: OrdoColors.mutedForeground),
                      ),
                    ],
                  ),
                );
              }),
          ],
        ],
      ),
    );
  }
}

class _LetterForm extends StatefulWidget {
  final VoidCallback onCreated;

  const _LetterForm({required this.onCreated});

  @override
  State<_LetterForm> createState() => _LetterFormState();
}

class _LetterFormState extends State<_LetterForm> {
  final _titleCtrl = TextEditingController();
  final _bodyCtrl = TextEditingController();
  late final TextEditingController _deadlineCtrl;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    final defaultDate = DateTime.now().add(const Duration(days: 30));
    _deadlineCtrl = TextEditingController(
      text: '${defaultDate.year}-${defaultDate.month.toString().padLeft(2, '0')}-${defaultDate.day.toString().padLeft(2, '0')}',
    );
    // The Seal button is enabled from these three fields, so every keystroke
    // has to rebuild — without this it stays disabled from its first frame.
    for (final c in [_titleCtrl, _bodyCtrl, _deadlineCtrl]) {
      c.addListener(_onFieldChanged);
    }
  }

  void _onFieldChanged() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    for (final c in [_titleCtrl, _bodyCtrl, _deadlineCtrl]) {
      c.removeListener(_onFieldChanged);
      c.dispose();
    }
    super.dispose();
  }

  bool get _canSeal =>
      !_busy &&
      _titleCtrl.text.trim().isNotEmpty &&
      _bodyCtrl.text.trim().isNotEmpty &&
      _deadlineCtrl.text.trim().isNotEmpty;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        TextField(
          controller: _titleCtrl,
          decoration: InputDecoration(hintText: 'Sealed for which goal? e.g. Ship Ordo'),
          style: TextStyle(color: OrdoColors.foreground),
        ),
        const SizedBox(height: 8),
        GestureDetector(
          onTap: () async {
            final now = DateTime.now();
            final parts = _deadlineCtrl.text.split('-');
            final initial = parts.length == 3
                ? DateTime.tryParse(_deadlineCtrl.text) ?? now.add(const Duration(days: 30))
                : now.add(const Duration(days: 30));
            final picked = await showDatePicker(
              context: context,
              initialDate: initial,
              firstDate: now,
              lastDate: now.add(const Duration(days: 3650)),
            );
            if (picked != null) {
              setState(() {
                _deadlineCtrl.text = '${picked.year}-${picked.month.toString().padLeft(2, '0')}-${picked.day.toString().padLeft(2, '0')}';
              });
            }
          },
          child: AbsorbPointer(
            child: TextField(
              controller: _deadlineCtrl,
              decoration: const InputDecoration(
                hintText: 'Delivery date',
                suffixIcon: Icon(Icons.calendar_today, size: 18),
              ),
              style: TextStyle(color: OrdoColors.foreground),
            ),
          ),
        ),
        const SizedBox(height: 8),
        TextField(
          controller: _bodyCtrl,
          decoration: InputDecoration(hintText: 'What do you want to tell the person who reaches that day?'),
          maxLines: 4,
          style: TextStyle(color: OrdoColors.foreground),
        ),
        const SizedBox(height: 12),
        SizedBox(
          width: double.infinity,
          child: ElevatedButton.icon(
            onPressed: !_canSeal
                ? null
                : () async {
                    setState(() => _busy = true);
                    try {
                      await OrdoDb.createLetter(_titleCtrl.text.trim(), _bodyCtrl.text.trim(), _deadlineCtrl.text);
                      _titleCtrl.clear();
                      _bodyCtrl.clear();
                      widget.onCreated();
                      if (mounted) ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Letter sealed — the bot delivers it on the deadline.')),
                      );
                    } catch (e) {
                      if (mounted) ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text('Error: $e')),
                      );
                    } finally {
                      if (mounted) setState(() => _busy = false);
                    }
                  },
            icon: _busy
                ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                : const Icon(Icons.lock, size: 18),
            label: const Text('Seal the letter'),
          ),
        ),
      ],
    );
  }
}

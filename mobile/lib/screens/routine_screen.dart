import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/ordo_state.dart';
import '../services/state_provider.dart';
import '../services/auth_provider.dart';
import '../services/categories_provider.dart';
import '../utils/ordo.dart';
import '../widgets/app_widgets.dart';
import '../themes/app_theme.dart';

const _dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

class RoutineScreen extends StatefulWidget {
  final VoidCallback? onLoginRequired;

  const RoutineScreen({super.key, this.onLoginRequired});

  @override
  State<RoutineScreen> createState() => _RoutineScreenState();
}

class _RoutineScreenState extends State<RoutineScreen> {
  int _selectedDay = DateTime.now().weekday % 7;
  bool _showSidebar = false;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Column(
        children: [
          _dayTabs(),
          Expanded(
            child: _showSidebar
                ? _sidebarContent()
                : _blocksList(),
          ),
        ],
      ),
      floatingActionButton: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Sidebar toggle FAB
          FloatingActionButton.small(
            heroTag: 'sidebar',
            onPressed: () => setState(() => _showSidebar = !_showSidebar),
            backgroundColor: OrdoColors.secondary,
            child: Icon(
              _showSidebar ? Icons.close : Icons.dashboard_outlined,
              color: OrdoColors.mutedForeground,
              size: 20,
            ),
          ),
          const SizedBox(height: 8),
          FloatingActionButton(
            heroTag: 'add',
            onPressed: () {
              if (!context.read<AuthProvider>().isLoggedIn) {
                widget.onLoginRequired?.call();
                return;
              }
              _addBlock(context);
            },
            backgroundColor: OrdoColors.primary,
            child: Icon(Icons.add, color: OrdoColors.primaryForeground),
          ),
        ],
      ),
    );
  }

  Widget _dayTabs() {
    return SizedBox(
      height: 44,
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
        itemCount: 7,
        itemBuilder: (context, i) {
          final selected = i == _selectedDay;
          return GestureDetector(
            onTap: () => setState(() {
              _selectedDay = i;
              _showSidebar = false;
            }),
            child: Container(
              margin: const EdgeInsets.symmetric(horizontal: 4),
              padding: const EdgeInsets.symmetric(horizontal: 14),
              decoration: BoxDecoration(
                color: selected ? OrdoColors.primary : OrdoColors.card,
                borderRadius: BorderRadius.circular(999),
                border: Border.all(color: selected ? OrdoColors.primary : OrdoColors.border),
              ),
              child: Center(
                child: Text(_dayNames[i],
                    style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: selected ? OrdoColors.primaryForeground : OrdoColors.mutedForeground)),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _blocksList() {
    return Consumer<OrdoProvider>(
      builder: (context, prov, _) {
        final state = prov.state;
        if (state == null) return const Center(child: CircularProgressIndicator());
        final blocks = List<Block>.from(state.routine[_selectedDay] ?? []);
        blocks.sort((a, b) => a.start.compareTo(b.start));

        return ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // Header
            PanelTitle(
              title: 'Default routine',
              hint: 'The plan. What actually happened lives in the daily log.',
            ),
            const SizedBox(height: 8),

            // Add block button
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: () {
                  if (!context.read<AuthProvider>().isLoggedIn) {
                    widget.onLoginRequired?.call();
                    return;
                  }
                  _addBlock(context);
                },
                icon: const Icon(Icons.add, size: 18),
                label: const Text('Block'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: OrdoColors.foreground,
                  side: BorderSide(color: OrdoColors.border),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
              ),
            ),
            const SizedBox(height: 12),

            // Block list
            if (blocks.isEmpty)
              Panel(
                child: Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Text('No blocks on ${_dayNames[_selectedDay]} yet.',
                        style: TextStyle(color: OrdoColors.mutedForeground)),
                  ),
                ),
              )
            else
              ...blocks.map((b) => _BlockRow(
                block: b,
                onLoginRequired: widget.onLoginRequired,
              )),
          ],
        );
      },
    );
  }

  // ─── Sidebar: Duplicate, Weekdays, Date Range, Templates ───

  Widget _sidebarContent() {
    return Consumer<OrdoProvider>(
      builder: (context, prov, _) {
        final state = prov.state;
        if (state == null) return const Center(child: CircularProgressIndicator());

        return ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // ── Duplicate this day ──
            Panel(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  PanelTitle(
                    title: 'Duplicate this day',
                    hint: 'Copy ${_dayNames[_selectedDay]}\'s schedule elsewhere.',
                  ),
                  const SizedBox(height: 8),
                  // Day buttons grid
                  Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    children: List.generate(7, (i) {
                      if (i == _selectedDay) return const SizedBox.shrink();
                      return GestureDetector(
                        onTap: () {
                          prov.update((prev) {
                            final next = Map<int, List<Block>>.from(prev.routine);
                            next[i] = cloneBlocks(prev.routine[_selectedDay] ?? []);
                            return prev.copyWith(routine: next);
                          });
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(content: Text('Copied to ${_dayNames[i]}')),
                          );
                        },
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                          decoration: BoxDecoration(
                            color: OrdoColors.muted,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(_dayNames[i], style: TextStyle(fontSize: 13, color: OrdoColors.mutedForeground)),
                        ),
                      );
                    }),
                  ),
                  const SizedBox(height: 12),
                  // Apply to weekdays
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton(
                      onPressed: () {
                        prov.update((prev) {
                          final next = Map<int, List<Block>>.from(prev.routine);
                          for (final d in [1, 2, 3, 4, 5]) {
                            next[d] = cloneBlocks(prev.routine[_selectedDay] ?? []);
                          }
                          return prev.copyWith(routine: next);
                        });
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Applied to Mon–Fri')),
                        );
                      },
                      style: OutlinedButton.styleFrom(
                        foregroundColor: OrdoColors.mutedForeground,
                        side: BorderSide(color: OrdoColors.border),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                      child: const Text('Apply to every weekday'),
                    ),
                  ),
                  const SizedBox(height: 8),
                  // Apply to date range
                  _DateRangeApplier(
                    dayIdx: _selectedDay,
                    onApply: () {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Applied across the date range')),
                      );
                    },
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // ── Template library ──
            _TemplateLibrary(dayIdx: _selectedDay),
            const SizedBox(height: 16),

            // ── Week at a glance ──
            _WeekAtGlance(),
          ],
        );
      },
    );
  }

  // ─── Block row with inline editing ───

  void _addBlock(BuildContext context) {
    final titleCtrl = TextEditingController();
    String start = '08:00';
    String end = '09:00';
    String category = 'work';
    String priority = 'nice';

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
                  const Text('Add Block', style: TextStyle(fontFamily: 'SpaceGrotesk', fontSize: 20, fontWeight: FontWeight.w700)),
                  const SizedBox(height: 16),
                  TextField(controller: titleCtrl, decoration: const InputDecoration(hintText: 'Block title'), autofocus: true),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(child: _timePicker(ctx, 'Start', start, (t) => setSheetState(() => start = t))),
                      const SizedBox(width: 12),
                      Expanded(child: _timePicker(ctx, 'End', end, (t) => setSheetState(() => end = t))),
                    ],
                  ),
                  const SizedBox(height: 12),
                  _categoryPicker(category, (c) => setSheetState(() => category = c)),
                  const SizedBox(height: 12),
                  // Priority toggle
                  GestureDetector(
                    onTap: () => setSheetState(() => priority = priority == 'must' ? 'nice' : 'must'),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      decoration: BoxDecoration(
                        color: OrdoColors.muted,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(priority.toUpperCase(),
                          style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, letterSpacing: 1, color: OrdoColors.mutedForeground)),
                    ),
                  ),
                  const SizedBox(height: 16),
                  SizedBox(
                    height: 48,
                    child: ElevatedButton(
                      onPressed: () {
                        if (titleCtrl.text.trim().isNotEmpty) {
                          context.read<OrdoProvider>().update((s) {
                            final newMap = Map<int, List<Block>>.from(s.routine);
                            final dayBlocks = List<Block>.from(newMap[_selectedDay] ?? []);
                            dayBlocks.add(Block(
                              id: DateTime.now().millisecondsSinceEpoch.toString(),
                              title: titleCtrl.text.trim(),
                              start: start, end: end, category: category, priority: priority,
                            ));
                            dayBlocks.sort((a, b) => a.start.compareTo(b.start));
                            newMap[_selectedDay] = dayBlocks;
                            return s.copyWith(routine: newMap);
                          });
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

  Widget _timePicker(BuildContext context, String label, String current, ValueChanged<String> onChanged) {
    final parts = current.split(':');
    final h = int.tryParse(parts[0]) ?? 8;
    final m = int.tryParse(parts.length > 1 ? parts[1] : '0') ?? 0;
    return GestureDetector(
      onTap: () async {
        final picked = await showTimePicker(
          context: context,
          initialTime: TimeOfDay(hour: h, minute: m),
          builder: (context, child) {
            return Theme(data: Theme.of(context).copyWith(timePickerTheme: TimePickerThemeData(backgroundColor: OrdoColors.surface, hourMinuteColor: OrdoColors.card, dayPeriodColor: OrdoColors.card)), child: child!);
          },
        );
        if (picked != null) onChanged('${picked.hour.toString().padLeft(2, '0')}:${picked.minute.toString().padLeft(2, '0')}');
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
        decoration: BoxDecoration(color: OrdoColors.card, borderRadius: BorderRadius.circular(8), border: Border.all(color: OrdoColors.border)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label, style: TextStyle(fontSize: 11, color: OrdoColors.mutedForeground)),
          const SizedBox(height: 4),
          Text(current, style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: OrdoColors.foreground)),
        ]),
      ),
    );
  }

  Widget _categoryPicker(String current, ValueChanged<String> onChanged) {
    return Consumer<CategoriesProvider>(
      builder: (context, catsProv, _) {
        return Wrap(
          spacing: 8, runSpacing: 8,
          children: catsProv.categories.map((c) {
            final selected = c.id == current;
            return GestureDetector(
              onTap: () => onChanged(c.id),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: selected ? OrdoColors.primary.withValues(alpha: 0.2) : OrdoColors.card,
                  borderRadius: BorderRadius.circular(999),
                  border: Border.all(color: selected ? OrdoColors.primary : OrdoColors.border, width: selected ? 2 : 1),
                ),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  CategoryDot(id: c.id),
                  const SizedBox(width: 6),
                  Text(c.label, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: selected ? OrdoColors.primary : OrdoColors.mutedForeground)),
                ]),
              ),
            );
          }).toList(),
        );
      },
    );
  }
}

// ─── Block Row ─────────────────────────────────────────────────────────

class _BlockRow extends StatelessWidget {
  final Block block;
  final VoidCallback? onLoginRequired;

  const _BlockRow({required this.block, this.onLoginRequired});

  @override
  Widget build(BuildContext context) {
    return Panel(
      margin: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          CategoryDot(id: block.category),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(block.title, style: const TextStyle(fontWeight: FontWeight.w600, color: OrdoColors.foreground)),
                const SizedBox(height: 2),
                Text(formatTimeRange(block.start, block.end), style: TextStyle(fontSize: 12, color: OrdoColors.mutedForeground)),
                const SizedBox(height: 4),
                CategoryPill(id: block.category),
              ],
            ),
          ),
          PopupMenuButton<String>(
            onSelected: (val) {
              if (!context.read<AuthProvider>().isLoggedIn) {
                onLoginRequired?.call();
                return;
              }
              final prov = context.read<OrdoProvider>();
              if (val == 'edit') {
                _editBlock(context, prov, block);
              } else if (val == 'duplicate') {
                prov.update((s) {
                  final newMap = Map<int, List<Block>>.from(s.routine);
                  // Find which day this block belongs to
                  for (final entry in s.routine.entries) {
                    if (entry.value.any((b) => b.id == block.id)) {
                      final dayBlocks = List<Block>.from(entry.value);
                      dayBlocks.add(block.copyWith(
                        id: DateTime.now().millisecondsSinceEpoch.toString(),
                        title: '${block.title} (copy)',
                      ));
                      dayBlocks.sort((a, b) => a.start.compareTo(b.start));
                      newMap[entry.key] = dayBlocks;
                      break;
                    }
                  }
                  return s.copyWith(routine: newMap);
                });
              } else if (val == 'delete') {
                prov.update((s) {
                  final newMap = Map<int, List<Block>>.from(s.routine);
                  for (final entry in s.routine.entries) {
                    final dayBlocks = List<Block>.from(entry.value);
                    dayBlocks.removeWhere((blk) => blk.id == block.id);
                    newMap[entry.key] = dayBlocks;
                  }
                  return s.copyWith(routine: newMap);
                });
              }
            },
            itemBuilder: (context) => [
              const PopupMenuItem(value: 'edit', child: Text('Edit')),
              const PopupMenuItem(value: 'duplicate', child: Text('Duplicate')),
              const PopupMenuItem(value: 'delete', child: Text('Delete')),
            ],
          ),
        ],
      ),
    );
  }

  void _editBlock(BuildContext context, OrdoProvider prov, Block block) {
    final titleCtrl = TextEditingController(text: block.title);
    String start = block.start;
    String end = block.end;
    String category = block.category;

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
                  const Text('Edit Block', style: TextStyle(fontFamily: 'SpaceGrotesk', fontSize: 20, fontWeight: FontWeight.w700)),
                  const SizedBox(height: 16),
                  TextField(controller: titleCtrl, decoration: const InputDecoration(hintText: 'Block title')),
                  const SizedBox(height: 12),
                  Row(children: [
                    Expanded(child: _timePicker(ctx, 'Start', start, (t) => setSheetState(() => start = t))),
                    const SizedBox(width: 12),
                    Expanded(child: _timePicker(ctx, 'End', end, (t) => setSheetState(() => end = t))),
                  ]),
                  const SizedBox(height: 12),
                  _categoryPicker(category, (c) => setSheetState(() => category = c)),
                  const SizedBox(height: 16),
                  SizedBox(
                    height: 48,
                    child: ElevatedButton(
                      onPressed: () {
                        if (titleCtrl.text.trim().isNotEmpty) {
                          prov.update((s) {
                            final newMap = Map<int, List<Block>>.from(s.routine);
                            for (final entry in s.routine.entries) {
                              final dayBlocks = List<Block>.from(entry.value);
                              final idx = dayBlocks.indexWhere((b) => b.id == block.id);
                              if (idx >= 0) {
                                dayBlocks[idx] = block.copyWith(title: titleCtrl.text.trim(), start: start, end: end, category: category);
                                newMap[entry.key] = dayBlocks;
                                break;
                              }
                            }
                            return s.copyWith(routine: newMap);
                          });
                          Navigator.pop(ctx);
                        }
                      },
                      child: const Text('Save'),
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

  Widget _timePicker(BuildContext context, String label, String current, ValueChanged<String> onChanged) {
    final parts = current.split(':');
    final h = int.tryParse(parts[0]) ?? 8;
    final m = int.tryParse(parts.length > 1 ? parts[1] : '0') ?? 0;
    return GestureDetector(
      onTap: () async {
        final picked = await showTimePicker(
          context: context,
          initialTime: TimeOfDay(hour: h, minute: m),
          builder: (context, child) => Theme(data: Theme.of(context).copyWith(timePickerTheme: TimePickerThemeData(backgroundColor: OrdoColors.surface)), child: child!),
        );
        if (picked != null) onChanged('${picked.hour.toString().padLeft(2, '0')}:${picked.minute.toString().padLeft(2, '0')}');
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
        decoration: BoxDecoration(color: OrdoColors.card, borderRadius: BorderRadius.circular(8), border: Border.all(color: OrdoColors.border)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label, style: TextStyle(fontSize: 11, color: OrdoColors.mutedForeground)),
          const SizedBox(height: 4),
          Text(current, style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: OrdoColors.foreground)),
        ]),
      ),
    );
  }

  Widget _categoryPicker(String current, ValueChanged<String> onChanged) {
    return Consumer<CategoriesProvider>(
      builder: (context, catsProv, _) {
        return Wrap(
          spacing: 8, runSpacing: 8,
          children: catsProv.categories.map((c) {
            final selected = c.id == current;
            return GestureDetector(
              onTap: () => onChanged(c.id),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: selected ? OrdoColors.primary.withValues(alpha: 0.2) : OrdoColors.card,
                  borderRadius: BorderRadius.circular(999),
                  border: Border.all(color: selected ? OrdoColors.primary : OrdoColors.border, width: selected ? 2 : 1),
                ),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  CategoryDot(id: c.id),
                  const SizedBox(width: 6),
                  Text(c.label, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: selected ? OrdoColors.primary : OrdoColors.mutedForeground)),
                ]),
              ),
            );
          }).toList(),
        );
      },
    );
  }
}

// ─── Date Range Applier ────────────────────────────────────────────────

class _DateRangeApplier extends StatefulWidget {
  final int dayIdx;
  final VoidCallback onApply;

  const _DateRangeApplier({required this.dayIdx, required this.onApply});

  @override
  State<_DateRangeApplier> createState() => _DateRangeApplierState();
}

class _DateRangeApplierState extends State<_DateRangeApplier> {
  final _daysCtrl = TextEditingController(text: '30');

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        SizedBox(
          width: 60,
          child: TextField(
            controller: _daysCtrl,
            keyboardType: TextInputType.number,
            decoration: InputDecoration(
              isDense: true,
              contentPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
              fillColor: OrdoColors.card,
              filled: true,
            ),
            style: TextStyle(color: OrdoColors.foreground),
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: OutlinedButton(
            onPressed: () {
              final days = int.tryParse(_daysCtrl.text) ?? 30;
              context.read<OrdoProvider>().update((prev) {
                final overrides = Map<String, List<Block>>.from(prev.overrides);
                for (var i = 0; i < days; i++) {
                  overrides[dateKey(addDays(DateTime.now(), i))] = cloneBlocks(prev.routine[widget.dayIdx] ?? []);
                }
                return prev.copyWith(overrides: overrides);
              });
              widget.onApply();
            },
            style: OutlinedButton.styleFrom(
              foregroundColor: OrdoColors.mutedForeground,
              side: BorderSide(color: OrdoColors.border),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            child: const Text('Apply to date range'),
          ),
        ),
      ],
    );
  }
}

// ─── Template Library ──────────────────────────────────────────────────

class _TemplateLibrary extends StatefulWidget {
  final int dayIdx;

  const _TemplateLibrary({required this.dayIdx});

  @override
  State<_TemplateLibrary> createState() => _TemplateLibraryState();
}

class _TemplateLibraryState extends State<_TemplateLibrary> {
  final _nameCtrl = TextEditingController();

  @override
  Widget build(BuildContext context) {
    return Consumer<OrdoProvider>(
      builder: (context, prov, _) {
        final state = prov.state;
        if (state == null) return const SizedBox.shrink();
        final templates = state.templates;

        return Panel(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              PanelTitle(title: 'Template library', hint: 'Save any day, reuse it any time.'),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _nameCtrl,
                      decoration: InputDecoration(
                        hintText: 'e.g. Exam week',
                        isDense: true,
                        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                      style: TextStyle(color: OrdoColors.foreground),
                    ),
                  ),
                  const SizedBox(width: 8),
                  GestureDetector(
                    onTap: () {
                      if (_nameCtrl.text.trim().isEmpty) return;
                      prov.update((prev) {
                        return prev.copyWith(
                          templates: [
                            ...prev.templates,
                            Template(
                              id: DateTime.now().millisecondsSinceEpoch.toString(),
                              name: _nameCtrl.text.trim(),
                              blocks: cloneBlocks(prev.routine[widget.dayIdx] ?? []),
                            ),
                          ],
                        );
                      });
                      _nameCtrl.clear();
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Template saved')),
                      );
                    },
                    child: Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: OrdoColors.primary,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Icon(Icons.save, color: OrdoColors.primaryForeground, size: 20),
                    ),
                  ),
                ],
              ),
              if (templates.isNotEmpty) ...[
                const SizedBox(height: 12),
                ...templates.map((t) => Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: Panel(
                    margin: EdgeInsets.zero,
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(t.name, style: const TextStyle(fontWeight: FontWeight.w500, color: OrdoColors.foreground)),
                              Text('${t.blocks.length} blocks', style: TextStyle(fontSize: 11, color: OrdoColors.mutedForeground)),
                            ],
                          ),
                        ),
                        GestureDetector(
                          onTap: () {
                            prov.update((prev) {
                              return prev.copyWith(
                                routine: {
                                  ...prev.routine,
                                  widget.dayIdx: cloneBlocks(t.blocks),
                                },
                              );
                            });
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(content: Text('Applied "${t.name}" to ${_dayNames[widget.dayIdx]}')),
                            );
                          },
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                            decoration: BoxDecoration(
                              color: OrdoColors.muted,
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text('Apply', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: OrdoColors.foreground)),
                          ),
                        ),
                        const SizedBox(width: 6),
                        GestureDetector(
                          onTap: () {
                            prov.update((prev) {
                              return prev.copyWith(
                                templates: prev.templates.where((x) => x.id != t.id).toList(),
                              );
                            });
                          },
                          child: Icon(Icons.delete_outline, size: 18, color: OrdoColors.mutedForeground),
                        ),
                      ],
                    ),
                  ),
                )),
              ],
            ],
          ),
        );
      },
    );
  }
}

// ─── Week at a Glance ──────────────────────────────────────────────────

class _WeekAtGlance extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Consumer<OrdoProvider>(
      builder: (context, prov, _) {
        final state = prov.state;
        if (state == null) return const SizedBox.shrink();
        final catsProv = context.read<CategoriesProvider>();
        final now = DateTime.now();
        final weekStart = startOfWeek(now);

        return Panel(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              PanelTitle(title: 'Week at a glance', hint: 'One bar per block, coloured by category.'),
              const SizedBox(height: 8),
              Row(
                children: List.generate(7, (i) {
                  final date = addDays(weekStart, i);
                  final blocks = blocksFor(state, date);
                  final isToday = dateKey(date) == dateKey(now);
                  return Expanded(
                    child: Container(
                      margin: const EdgeInsets.symmetric(horizontal: 2),
                      padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 2),
                      decoration: BoxDecoration(
                        color: isToday ? OrdoColors.primary.withValues(alpha: 0.1) : OrdoColors.card,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(
                          color: isToday ? OrdoColors.primary : OrdoColors.border,
                          width: isToday ? 1.5 : 1,
                        ),
                      ),
                      child: Column(
                        children: [
                          Text(_dayNames[i],
                              style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600,
                                  color: isToday ? OrdoColors.primary : OrdoColors.mutedForeground)),
                          const SizedBox(height: 4),
                          ...blocks.take(5).map((b) {
                            final color = _parseColor(catsProv.categoryColor(b.category));
                            return Container(
                              height: 4,
                              margin: const EdgeInsets.only(bottom: 2),
                              decoration: BoxDecoration(
                                color: color,
                                borderRadius: BorderRadius.circular(2),
                              ),
                            );
                          }),
                        ],
                      ),
                    ),
                  );
                }),
              ),
              const SizedBox(height: 10),
              // Category legend
              Wrap(
                spacing: 8,
                runSpacing: 4,
                children: catsProv.categories.map((c) {
                  return Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(width: 8, height: 8, decoration: BoxDecoration(
                        color: _parseColor(catsProv.categoryColor(c.id)),
                        shape: BoxShape.circle,
                      )),
                      const SizedBox(width: 4),
                      Text(c.label, style: TextStyle(fontSize: 10, color: OrdoColors.mutedForeground)),
                    ],
                  );
                }).toList(),
              ),
            ],
          ),
        );
      },
    );
  }

  Color _parseColor(String hex) {
    final s = hex.replaceAll('#', '');
    return Color(int.parse(s.padLeft(6, '0'), radix: 16) + 0xFF000000);
  }
}

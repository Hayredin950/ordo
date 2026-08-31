import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/ordo_state.dart';
import '../services/state_provider.dart';
import '../services/auth_provider.dart';
import '../services/categories_provider.dart';
import '../utils/ordo.dart';
import '../widgets/app_widgets.dart';
import '../themes/app_theme.dart';

class RoutineScreen extends StatefulWidget {
  final VoidCallback? onLoginRequired;

  const RoutineScreen({super.key, this.onLoginRequired});

  @override
  State<RoutineScreen> createState() => _RoutineScreenState();
}

class _RoutineScreenState extends State<RoutineScreen> {
  int _selectedDay = DateTime.now().weekday % 7;

  static const _dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Column(
        children: [
          _dayTabs(),
          Expanded(child: _blocksList()),
        ],
      ),
      floatingActionButton: FloatingActionButton(
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
            onTap: () => setState(() => _selectedDay = i),
            child: Container(
              margin: const EdgeInsets.symmetric(horizontal: 4),
              padding: const EdgeInsets.symmetric(horizontal: 14),
              decoration: BoxDecoration(
                color: selected ? OrdoColors.primary : OrdoColors.card,
                borderRadius: BorderRadius.circular(999),
                border: Border.all(
                  color: selected ? OrdoColors.primary : OrdoColors.border,
                ),
              ),
              child: Center(
                child: Text(_dayNames[i],
                    style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: selected
                            ? OrdoColors.primaryForeground
                            : OrdoColors.mutedForeground)),
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
        if (blocks.isEmpty) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.add_circle_outline, size: 48, color: OrdoColors.mutedForeground),
                const SizedBox(height: 12),
                Text('No blocks for ${_dayNames[_selectedDay]}',
                    style: TextStyle(
                        fontFamily: 'SpaceGrotesk',
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                        color: OrdoColors.foreground)),
                const SizedBox(height: 4),
                Text('Tap + to add a block',
                    style: TextStyle(color: OrdoColors.mutedForeground)),
              ],
            ),
          );
        }
        return ListView.builder(
          padding: const EdgeInsets.all(16),
          itemCount: blocks.length,
          itemBuilder: (context, i) {
            final b = blocks[i];
            return Panel(
              margin: const EdgeInsets.only(bottom: 8),
              onTap: () {
                if (!context.read<AuthProvider>().isLoggedIn) {
                  widget.onLoginRequired?.call();
                  return;
                }
                _editBlock(context, prov, b);
              },
              child: Row(
                children: [
                  CategoryDot(id: b.category),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(b.title,
                            style: const TextStyle(
                                fontWeight: FontWeight.w600,
                                color: OrdoColors.foreground)),
                        const SizedBox(height: 2),
                        Text(formatTimeRange(b.start, b.end),
                            style: TextStyle(
                                fontSize: 12,
                                color: OrdoColors.mutedForeground)),
                        const SizedBox(height: 2),
                        CategoryPill(id: b.category),
                      ],
                    ),
                  ),
                  PopupMenuButton<String>(
                    onSelected: (val) {
                      if (val == 'delete') {
                        _deleteBlock(prov, b);
                      } else if (val == 'duplicate') {
                        _duplicateBlock(prov, b);
                      }
                    },
                    itemBuilder: (context) => [
                      const PopupMenuItem(value: 'duplicate', child: Text('Duplicate')),
                      const PopupMenuItem(value: 'delete', child: Text('Delete')),
                    ],
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  void _deleteBlock(OrdoProvider prov, Block b) {
    prov.update((s) {
      final newMap = Map<int, List<Block>>.from(s.routine);
      final dayBlocks = List<Block>.from(newMap[_selectedDay] ?? []);
      dayBlocks.removeWhere((blk) => blk.id == b.id);
      newMap[_selectedDay] = dayBlocks;
      return s.copyWith(routine: newMap);
    });
  }

  void _duplicateBlock(OrdoProvider prov, Block b) {
    prov.update((s) {
      final newMap = Map<int, List<Block>>.from(s.routine);
      final dayBlocks = List<Block>.from(newMap[_selectedDay] ?? []);
      dayBlocks.add(b.copyWith(
        id: DateTime.now().millisecondsSinceEpoch.toString(),
        title: '${b.title} (copy)',
      ));
      dayBlocks.sort((a, b) => a.start.compareTo(b.start));
      newMap[_selectedDay] = dayBlocks;
      return s.copyWith(routine: newMap);
    });
  }

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
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setSheetState) {
            return Padding(
              padding: EdgeInsets.fromLTRB(24, 24, 24, MediaQuery.of(ctx).viewInsets.bottom + 24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text('Add Block',
                      style: TextStyle(
                          fontFamily: 'SpaceGrotesk',
                          fontSize: 20,
                          fontWeight: FontWeight.w700)),
                  const SizedBox(height: 16),
                  TextField(
                    controller: titleCtrl,
                    decoration: const InputDecoration(hintText: 'Block title'),
                    autofocus: true,
                  ),
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
                  const SizedBox(height: 16),
                  SizedBox(
                    height: 48,
                    child: ElevatedButton(
                      onPressed: () {
                        if (titleCtrl.text.trim().isNotEmpty) {
                          final newBlock = Block(
                            id: DateTime.now().millisecondsSinceEpoch.toString(),
                            title: titleCtrl.text.trim(),
                            start: start,
                            end: end,
                            category: category,
                            priority: priority,
                          );
                          context.read<OrdoProvider>().update((s) {
                            final newMap = Map<int, List<Block>>.from(s.routine);
                            final dayBlocks = List<Block>.from(newMap[_selectedDay] ?? []);
                            dayBlocks.add(newBlock);
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

  void _editBlock(BuildContext context, OrdoProvider prov, Block block) {
    final titleCtrl = TextEditingController(text: block.title);
    String start = block.start;
    String end = block.end;
    String category = block.category;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: OrdoColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setSheetState) {
            return Padding(
              padding: EdgeInsets.fromLTRB(24, 24, 24, MediaQuery.of(ctx).viewInsets.bottom + 24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text('Edit Block',
                      style: TextStyle(
                          fontFamily: 'SpaceGrotesk',
                          fontSize: 20,
                          fontWeight: FontWeight.w700)),
                  const SizedBox(height: 16),
                  TextField(
                    controller: titleCtrl,
                    decoration: const InputDecoration(hintText: 'Block title'),
                    autofocus: true,
                  ),
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
                  const SizedBox(height: 16),
                  SizedBox(
                    height: 48,
                    child: ElevatedButton(
                      onPressed: () {
                        if (titleCtrl.text.trim().isNotEmpty) {
                          prov.update((s) {
                            final newMap = Map<int, List<Block>>.from(s.routine);
                            final dayBlocks = List<Block>.from(newMap[_selectedDay] ?? []);
                            final idx = dayBlocks.indexWhere((b) => b.id == block.id);
                            if (idx >= 0) {
                              dayBlocks[idx] = block.copyWith(
                                title: titleCtrl.text.trim(),
                                start: start,
                                end: end,
                                category: category,
                              );
                            }
                            newMap[_selectedDay] = dayBlocks;
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
          builder: (context, child) {
            return Theme(
              data: Theme.of(context).copyWith(
                timePickerTheme: TimePickerThemeData(
                  backgroundColor: OrdoColors.surface,
                  hourMinuteColor: OrdoColors.card,
                  dayPeriodColor: OrdoColors.card,
                ),
              ),
              child: child!,
            );
          },
        );
        if (picked != null) {
          onChanged('${picked.hour.toString().padLeft(2, '0')}:${picked.minute.toString().padLeft(2, '0')}');
        }
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
        decoration: BoxDecoration(
          color: OrdoColors.card,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: OrdoColors.border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: TextStyle(fontSize: 11, color: OrdoColors.mutedForeground)),
            const SizedBox(height: 4),
            Text(current, style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: OrdoColors.foreground)),
          ],
        ),
      ),
    );
  }

  Widget _categoryPicker(String current, ValueChanged<String> onChanged) {
    return Consumer<CategoriesProvider>(
      builder: (context, catsProv, _) {
        return Wrap(
          spacing: 8,
          runSpacing: 8,
          children: catsProv.categories.map((c) {
            final selected = c.id == current;
            return GestureDetector(
              onTap: () => onChanged(c.id),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: selected ? OrdoColors.primary.withValues(alpha: 0.2) : OrdoColors.card,
                  borderRadius: BorderRadius.circular(999),
                  border: Border.all(
                    color: selected ? OrdoColors.primary : OrdoColors.border,
                    width: selected ? 2 : 1,
                  ),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    CategoryDot(id: c.id),
                    const SizedBox(width: 6),
                    Text(c.label, style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                      color: selected ? OrdoColors.primary : OrdoColors.mutedForeground,
                    )),
                  ],
                ),
              ),
            );
          }).toList(),
        );
      },
    );
  }
}

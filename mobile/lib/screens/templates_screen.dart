import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/ordo_state.dart';
import '../services/state_provider.dart';
import '../utils/ordo.dart';
import '../widgets/app_widgets.dart';
import '../themes/app_theme.dart';

class TemplatesScreen extends StatelessWidget {
  const TemplatesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Templates'),
        actions: [
          IconButton(
            icon: const Icon(Icons.add),
            onPressed: () => _createTemplate(context),
          ),
        ],
      ),
      body: Consumer<OrdoProvider>(
        builder: (context, prov, _) {
          final state = prov.state;
          if (state == null) return const Center(child: CircularProgressIndicator());
          final templates = state.templates;
          if (templates.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.dashboard_outlined, size: 64, color: OrdoColors.mutedForeground),
                  const SizedBox(height: 16),
                  Text('No templates yet',
                      style: TextStyle(
                          fontFamily: 'SpaceGrotesk',
                          fontSize: 18,
                          fontWeight: FontWeight.w600,
                          color: OrdoColors.foreground)),
                  const SizedBox(height: 8),
                  Text('Create a template from your current\nroutine to reuse later.',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: OrdoColors.mutedForeground, fontSize: 14)),
                  const SizedBox(height: 24),
                  ElevatedButton.icon(
                    onPressed: () => _createTemplate(context),
                    icon: const Icon(Icons.add, size: 18),
                    label: const Text('Create Template'),
                  ),
                ],
              ),
            );
          }
          return ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: templates.length,
            itemBuilder: (context, i) {
              final t = templates[i];
              return Panel(
                margin: const EdgeInsets.only(bottom: 8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Expanded(
                          child: Text(t.name,
                              style: const TextStyle(
                                  fontFamily: 'SpaceGrotesk',
                                  fontWeight: FontWeight.w600,
                                  fontSize: 16,
                                  color: OrdoColors.foreground)),
                        ),
                        PopupMenuButton<String>(
                          onSelected: (val) {
                            if (val == 'apply') {
                              _applyTemplate(context, prov, t);
                            } else if (val == 'delete') {
                              prov.update((s) => s.copyWith(
                                templates: List.from(s.templates)..removeAt(i),
                              ));
                            }
                          },
                          itemBuilder: (context) => [
                            const PopupMenuItem(value: 'apply', child: Text('Apply to Routine')),
                            const PopupMenuItem(value: 'delete', child: Text('Delete')),
                          ],
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text('${t.blocks.length} blocks',
                        style: TextStyle(fontSize: 12, color: OrdoColors.mutedForeground)),
                    const SizedBox(height: 8),
                    ...t.blocks.take(3).map((b) => Padding(
                      padding: const EdgeInsets.symmetric(vertical: 2),
                      child: Row(
                        children: [
                          CategoryDot(id: b.category),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(b.title,
                                style: TextStyle(fontSize: 13, color: OrdoColors.foreground)),
                          ),
                          Text(formatTimeRange(b.start, b.end, hour12: hour12Of(context)),
                              style: TextStyle(fontSize: 11, color: OrdoColors.mutedForeground)),
                        ],
                      ),
                    )),
                    if (t.blocks.length > 3)
                      Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: Text('...and ${t.blocks.length - 3} more',
                            style: TextStyle(fontSize: 11, color: OrdoColors.mutedForeground)),
                      ),
                  ],
                ),
              );
            },
          );
        },
      ),
    );
  }

  void _createTemplate(BuildContext context) {
    final ctrl = TextEditingController();
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: OrdoColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return Padding(
          padding: EdgeInsets.fromLTRB(24, 24, 24, MediaQuery.of(ctx).viewInsets.bottom + 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text('Create Template',
                  style: TextStyle(
                      fontFamily: 'SpaceGrotesk',
                      fontSize: 20,
                      fontWeight: FontWeight.w700)),
              const SizedBox(height: 4),
              Text('Save your current weekday routine as a template.',
                  style: TextStyle(fontSize: 13, color: OrdoColors.mutedForeground)),
              const SizedBox(height: 16),
              TextField(
                controller: ctrl,
                decoration: const InputDecoration(hintText: 'Template name'),
              ),
              const SizedBox(height: 16),
              SizedBox(
                height: 48,
                child: ElevatedButton(
                  onPressed: () {
                    if (ctrl.text.trim().isNotEmpty) {
                      final prov = ctx.read<OrdoProvider>();
                      final state = prov.state;
                      if (state != null) {
                        final weekdayBlocks = state.routine[1] ?? [];
                        prov.update((s) => s.copyWith(
                          templates: [
                            ...s.templates,
                            Template(
                              id: DateTime.now().millisecondsSinceEpoch.toString(),
                              name: ctrl.text.trim(),
                              blocks: List<Block>.from(weekdayBlocks),
                            ),
                          ],
                        ));
                      }
                      Navigator.pop(ctx);
                    }
                  },
                  child: const Text('Create'),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  void _applyTemplate(BuildContext context, OrdoProvider prov, Template template) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: OrdoColors.card,
        title: const Text('Apply Template',
            style: TextStyle(color: OrdoColors.foreground)),
        content: Text(
            'Apply "${template.name}" to all weekdays? This will replace your current weekday routine.',
            style: TextStyle(color: OrdoColors.mutedForeground)),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text('Cancel', style: TextStyle(color: OrdoColors.mutedForeground)),
          ),
          TextButton(
            onPressed: () {
              prov.update((s) {
                final newRoutine = Map<int, List<Block>>.from(s.routine);
                for (var i = 1; i <= 5; i++) {
                  newRoutine[i] = template.blocks.map((b) =>
                    b.copyWith(id: DateTime.now().millisecondsSinceEpoch.toString() + b.id)
                  ).toList();
                }
                return s.copyWith(routine: newRoutine);
              });
              Navigator.pop(ctx);
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(content: Text('Template "${template.name}" applied')),
              );
            },
            child: const Text('Apply', style: TextStyle(color: OrdoColors.primary)),
          ),
        ],
      ),
    );
  }
}

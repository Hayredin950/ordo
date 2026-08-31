class OrdoState {
  final Map<int, List<Block>> routine;
  final Map<String, List<Block>> overrides;
  final Map<String, Map<String, int>> log;
  final Map<String, String> journal;
  final List<Goal> goals;
  final List<Template> templates;
  final Settings? settings;

  OrdoState({
    required this.routine,
    required this.overrides,
    required this.log,
    required this.journal,
    required this.goals,
    required this.templates,
    this.settings,
  });

  factory OrdoState.fromJson(Map<String, dynamic> json) {
    return OrdoState(
      routine: (json['routine'] as Map<String, dynamic>?)?.map(
        (k, v) => MapEntry(int.parse(k), (v as List).map((b) => Block.fromJson(b)).toList()),
      ) ?? {},
      overrides: (json['overrides'] as Map<String, dynamic>?)?.map(
        (k, v) => MapEntry(k, (v as List).map((b) => Block.fromJson(b)).toList()),
      ) ?? {},
      log: (json['log'] as Map<String, dynamic>?)?.map(
        (k, v) => MapEntry(k, Map<String, int>.from(v)),
      ) ?? {},
      journal: Map<String, String>.from(json['journal'] ?? {}),
      goals: (json['goals'] as List?)?.map((g) => Goal.fromJson(g)).toList() ?? [],
      templates: (json['templates'] as List?)?.map((t) => Template.fromJson(t)).toList() ?? [],
      settings: json['settings'] != null ? Settings.fromJson(json['settings']) : null,
    );
  }

  Map<String, dynamic> toJson() => {
    'routine': routine.map((k, v) => MapEntry(k.toString(), v.map((b) => b.toJson()).toList())),
    'overrides': overrides.map((k, v) => MapEntry(k, v.map((b) => b.toJson()).toList())),
    'log': log.map((k, v) => MapEntry(k, v)),
    'journal': journal,
    'goals': goals.map((g) => g.toJson()).toList(),
    'templates': templates.map((t) => t.toJson()).toList(),
    'settings': settings?.toJson(),
  };

  OrdoState copyWith({
    Map<int, List<Block>>? routine,
    Map<String, List<Block>>? overrides,
    Map<String, Map<String, int>>? log,
    Map<String, String>? journal,
    List<Goal>? goals,
    List<Template>? templates,
    Settings? settings,
  }) => OrdoState(
    routine: routine ?? this.routine,
    overrides: overrides ?? this.overrides,
    log: log ?? this.log,
    journal: journal ?? this.journal,
    goals: goals ?? this.goals,
    templates: templates ?? this.templates,
    settings: settings ?? this.settings,
  );
}

class Block {
  final String id;
  final String title;
  final String start;
  final String end;
  final String category;
  final String priority;
  final String? goalId;

  Block({
    required this.id,
    required this.title,
    required this.start,
    required this.end,
    required this.category,
    required this.priority,
    this.goalId,
  });

  factory Block.fromJson(Map<String, dynamic> json) => Block(
    id: json['id'] ?? '',
    title: json['title'] ?? '',
    start: json['start'] ?? '',
    end: json['end'] ?? '',
    category: json['category'] ?? 'work',
    priority: json['priority'] ?? 'must',
    goalId: json['goalId'],
  );

  Map<String, dynamic> toJson() => {
    'id': id, 'title': title, 'start': start, 'end': end,
    'category': category, 'priority': priority, 'goalId': goalId,
  };

  Block copyWith({String? id, String? title, String? start, String? end, String? category, String? priority, String? goalId}) => Block(
    id: id ?? this.id,
    title: title ?? this.title,
    start: start ?? this.start,
    end: end ?? this.end,
    category: category ?? this.category,
    priority: priority ?? this.priority,
    goalId: goalId ?? this.goalId,
  );
}

class Goal {
  final String id;
  final String title;
  final String period;
  final String category;
  final double target;
  final String? parentId;

  Goal({
    required this.id,
    required this.title,
    required this.period,
    required this.category,
    required this.target,
    this.parentId,
  });

  factory Goal.fromJson(Map<String, dynamic> json) => Goal(
    id: json['id'] ?? '',
    title: json['title'] ?? '',
    period: json['period'] ?? 'week',
    category: json['category'] ?? 'work',
    target: (json['target'] ?? 80).toDouble(),
    parentId: json['parentId'],
  );

  Map<String, dynamic> toJson() => {
    'id': id, 'title': title, 'period': period, 'category': category, 'target': target, 'parentId': parentId,
  };

  Goal copyWith({String? id, String? title, String? period, String? category, double? target, String? parentId}) => Goal(
    id: id ?? this.id,
    title: title ?? this.title,
    period: period ?? this.period,
    category: category ?? this.category,
    target: target ?? this.target,
    parentId: parentId ?? this.parentId,
  );
}

class Template {
  final String id;
  final String name;
  final List<Block> blocks;

  Template({required this.id, required this.name, required this.blocks});

  factory Template.fromJson(Map<String, dynamic> json) => Template(
    id: json['id'] ?? '',
    name: json['name'] ?? '',
    blocks: (json['blocks'] as List<dynamic>?)
        ?.map((b) {
          if (b is List) {
            return b.map((x) => Block.fromJson(x as Map<String, dynamic>)).toList();
          }
          return <Block>[];
        })
        .expand((b) => b)
        .toList() ?? [],
  );

  Map<String, dynamic> toJson() => {
    'id': id, 'name': name, 'blocks': blocks.map((b) => b.toJson()).toList(),
  };
}

class Settings {
  final String hourFormat;

  const Settings({this.hourFormat = '24h'});

  factory Settings.fromJson(Map<String, dynamic> json) => Settings(
    hourFormat: json['hourFormat'] ?? '24h',
  );

  Map<String, dynamic> toJson() => {'hourFormat': hourFormat};
}

class Category {
  final String id;
  final String label;
  final String color;
  final String icon;
  final int sort;
  final bool builtin;
  final bool stored;

  const Category({
    required this.id,
    required this.label,
    required this.color,
    required this.icon,
    required this.sort,
    this.builtin = true,
    this.stored = false,
  });
}

class Peer {
  final String id;
  final String name;
  final String email;
  final int? weekly;

  const Peer({required this.id, required this.name, required this.email, this.weekly});
}

class Challenge {
  final String id;
  final String name;
  final String startsOn;
  final String endsOn;
  final String ownerId;
  final int members;
  final bool joined;

  const Challenge({
    required this.id, required this.name, required this.startsOn,
    required this.endsOn, required this.ownerId, required this.members, required this.joined,
  });
}

class FutureLetter {
  final String id;
  final String goalTitle;
  final String body;
  final String deadline;
  final bool delivered;
  final String createdAt;

  const FutureLetter({
    required this.id, required this.goalTitle, required this.body,
    required this.deadline, required this.delivered, required this.createdAt,
  });
}

class PublicTemplate {
  final String id;
  final String authorName;
  final String name;
  final List<Block> blocks;
  final int copies;
  final String createdAt;

  const PublicTemplate({
    required this.id, required this.authorName, required this.name,
    required this.blocks, required this.copies, required this.createdAt,
  });
}

class Announcement {
  final String id;
  final String title;
  final String body;
  final String level;
  final bool active;
  final String createdAt;

  const Announcement({
    required this.id, required this.title, required this.body,
    required this.level, required this.active, required this.createdAt,
  });
}

class User {
  final String id;
  final String email;
  final String name;
  final String provider;
  final bool isAdmin;

  const User({required this.id, required this.email, required this.name, required this.provider, this.isAdmin = false});
}

class AuthState {
  final User? user;
  final bool loading;
  final bool configured;

  const AuthState({this.user, this.loading = true, this.configured = true});
}
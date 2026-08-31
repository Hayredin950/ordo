import 'package:flutter/material.dart';
import '../models/ordo_state.dart';

class CategoriesProvider extends ChangeNotifier {
  List<Category> _categories = [];
  List<Category> get categories => _categories;

  CategoriesProvider() {
    _categories = _loadCategories();
  }

  List<Category> _loadCategories() {
    final builtin = [
      Category(id: 'health', label: 'Health', color: '#55C975', icon: 'heart_pulse', sort: 10, builtin: true, stored: false),
      Category(id: 'study', label: 'Study', color: '#52A9FE', icon: 'book_open', sort: 20, builtin: true, stored: false),
      Category(id: 'work', label: 'Work', color: '#F49329', icon: 'briefcase', sort: 30, builtin: true, stored: false),
      Category(id: 'finance', label: 'Finance', color: '#CEB92D', icon: 'wallet', sort: 40, builtin: true, stored: false),
      Category(id: 'spiritual', label: 'Spiritual', color: '#BF8AE6', icon: 'moon', sort: 50, builtin: true, stored: false),
      Category(id: 'relationships', label: 'Relationships', color: '#F87584', icon: 'users', sort: 60, builtin: true, stored: false),
    ];
    return builtin;
  }

  Category? findCategory(String id) => _categories.firstWhere((c) => c.id == id, orElse: () => _categories.firstWhere((c) => c.id == id, orElse: () => _categories[0]));

  String categoryLabel(String id) {
    try {
      return _categories.firstWhere((c) => c.id == id).label;
    } catch (_) {
      return id;
    }
  }

  String categoryColor(String id) {
    try {
      final c = _categories.firstWhere((c) => c.id == id);
      return c.color;
    } catch (_) {
      return '#9498A2';
    }
  }

  List<Category> all() => List.from(_categories);
}
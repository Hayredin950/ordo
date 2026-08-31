import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/auth_provider.dart';
import '../themes/app_theme.dart';
import '../widgets/account_menu.dart';
import 'today_screen.dart';
import 'routine_screen.dart';
import 'goals_screen.dart';
import 'insights_screen.dart';
import 'community_screen.dart';
import 'templates_screen.dart';
import 'settings_screen.dart';

class HomeScreen extends StatefulWidget {
  final VoidCallback? onLoginRequired;

  const HomeScreen({super.key, this.onLoginRequired});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _currentIndex = 0;

  static const _tabLabels = ['Today', 'Routine', 'Goals', 'Insights', 'Community'];

  late final List<Widget> _screens;

  @override
  void initState() {
    super.initState();
    _screens = [
      TodayScreen(onLoginRequired: widget.onLoginRequired),
      RoutineScreen(onLoginRequired: widget.onLoginRequired),
      GoalsScreen(onLoginRequired: widget.onLoginRequired),
      const InsightsScreen(),
      CommunityScreen(onLoginRequired: widget.onLoginRequired),
    ];
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_tabLabels[_currentIndex]),
        actions: [
          // Templates shortcut
          IconButton(
            icon: const Icon(Icons.dashboard_outlined, size: 22),
            tooltip: 'Templates',
            onPressed: () {
              Navigator.push(context, MaterialPageRoute(
                builder: (_) => const TemplatesScreen(),
              ));
            },
          ),
          // Settings shortcut
          IconButton(
            icon: const Icon(Icons.settings_outlined, size: 22),
            tooltip: 'Settings',
            onPressed: () {
              Navigator.push(context, MaterialPageRoute(
                builder: (_) => const SettingsScreen(),
              ));
            },
          ),
          const AccountMenuButton(),
        ],
      ),
      body: IndexedStack(
        index: _currentIndex,
        children: _screens,
      ),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        onTap: (i) => setState(() => _currentIndex = i),
        type: BottomNavigationBarType.fixed,
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.calendar_today), label: 'Today'),
          BottomNavigationBarItem(icon: Icon(Icons.repeat), label: 'Routine'),
          BottomNavigationBarItem(icon: Icon(Icons.flag), label: 'Goals'),
          BottomNavigationBarItem(icon: Icon(Icons.insights), label: 'Insights'),
          BottomNavigationBarItem(icon: Icon(Icons.groups), label: 'Community'),
        ],
      ),
    );
  }
}

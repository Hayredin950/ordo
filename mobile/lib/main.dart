import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'config.dart';
import 'services/state_provider.dart';
import 'services/auth_provider.dart';
import 'services/categories_provider.dart';
import 'screens/home_screen.dart';
import 'screens/login_screen.dart';
import 'themes/app_theme.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Supabase.initialize(url: supabaseUrl, publishableKey: supabaseAnonKey);
  runApp(const OrdoApp());
}

class OrdoApp extends StatelessWidget {
  const OrdoApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider()),
        ChangeNotifierProvider(create: (_) => OrdoProvider()..init()),
        ChangeNotifierProvider(create: (_) => CategoriesProvider()),
      ],
      child: MaterialApp(
        title: 'Ordo',
        debugShowCheckedModeBanner: false,
        theme: OrdoTheme.lightTheme,
        home: const OrdoRoot(),
      ),
    );
  }
}

class OrdoRoot extends StatefulWidget {
  const OrdoRoot({super.key});

  @override
  State<OrdoRoot> createState() => _OrdoRootState();
}

class _OrdoRootState extends State<OrdoRoot> {
  @override
  void initState() {
    super.initState();
    final auth = context.read<AuthProvider>();
    final ordo = context.read<OrdoProvider>();
    auth.addListener(() {
      if (!mounted) return;
      if (auth.isLoggedIn) {
        ordo.reload();
      }
    });
  }

  void showLogin() {
    Navigator.of(context).push(
      MaterialPageRoute(
        fullscreenDialog: true,
        builder: (_) => const LoginScreen(),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return HomeScreen(onLoginRequired: showLogin);
  }
}

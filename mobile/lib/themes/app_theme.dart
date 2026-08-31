import 'package:flutter/material.dart';

class OrdoColors {
  // Colors converted from the website's oklch palette
  static const Color background = Color(0xFF0D0F15);
  static const Color foreground = Color(0xFFF0EEE9);
  static const Color surface = Color(0xFF161920);
  static const Color card = Color(0xFF161920);
  static const Color primary = Color(0xFFF49329);
  static const Color primaryForeground = Color(0xFF1B120B);
  static const Color secondary = Color(0xFF252931);
  static const Color secondaryForeground = Color(0xFFF0EEE9);
  static const Color muted = Color(0xFF21242B);
  static const Color mutedForeground = Color(0xFF9498A2);
  static const Color accent = Color(0xFF292E38);
  static const Color accentForeground = Color(0xFFF4F2EC);
  static const Color destructive = Color(0xFFDE3B3D);
  static const Color destructiveForeground = Color(0xFFF8F5EE);
  static const Color border = Color(0xFF2A2E36);
  static const Color input = Color(0xFF2A2E36);
  static const Color ring = Color(0xFFF49329);

  static const Color catHealth = Color(0xFF55C975);
  static const Color catStudy = Color(0xFF52A9FE);
  static const Color catWork = Color(0xFFF49329);
  static const Color catFinance = Color(0xFFCEB92D);
  static const Color catSpiritual = Color(0xFFBF8AE6);
  static const Color catRelationships = Color(0xFFF87584);

  static const Color chart1 = Color(0xFFF49329);
  static const Color chart2 = Color(0xFF52A9FE);
  static const Color chart3 = Color(0xFF55C975);
  static const Color chart4 = Color(0xFFBF8AE6);
  static const Color chart5 = Color(0xFFF87584);
  static const Color sidebar = Color(0xFF11141A);
  static const Color sidebarForeground = Color(0xFFF0EEE9);
  static const Color sidebarPrimary = Color(0xFFF49329);
  static const Color sidebarPrimaryForeground = Color(0xFF1B120B);
  static const Color sidebarAccent = Color(0xFF252931);
  static const Color sidebarAccentForeground = Color(0xFFF0EEE9);
  static const Color sidebarBorder = Color(0xFF2A2E36);
  static const Color sidebarRing = Color(0xFFF49329);
}

class OrdoTheme {
  static ThemeData get lightTheme {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      colorScheme: ColorScheme.dark(
        surface: OrdoColors.surface,
        primary: OrdoColors.primary,
        onPrimary: OrdoColors.primaryForeground,
        secondary: OrdoColors.secondary,
        onSecondary: OrdoColors.secondaryForeground,
        error: OrdoColors.destructive,
        onError: OrdoColors.destructiveForeground,
        outline: OrdoColors.border,
      ),
      scaffoldBackgroundColor: OrdoColors.background,
      textTheme: TextTheme(
        displayLarge: TextStyle(
          fontFamily: 'SpaceGrotesk',
          fontSize: 32,
          fontWeight: FontWeight.w700,
          color: OrdoColors.foreground,
          letterSpacing: -0.02,
        ),
        displayMedium: TextStyle(
          fontFamily: 'SpaceGrotesk',
          fontSize: 24,
          fontWeight: FontWeight.w700,
          color: OrdoColors.foreground,
          letterSpacing: -0.02,
        ),
        titleLarge: TextStyle(
          fontFamily: 'SpaceGrotesk',
          fontSize: 20,
          fontWeight: FontWeight.w600,
          color: OrdoColors.foreground,
          letterSpacing: -0.02,
        ),
        titleMedium: TextStyle(
          fontFamily: 'DM Sans',
          fontSize: 16,
          fontWeight: FontWeight.w500,
          color: OrdoColors.foreground,
        ),
        titleSmall: TextStyle(
          fontFamily: 'DM Sans',
          fontSize: 14,
          fontWeight: FontWeight.w500,
          color: OrdoColors.foreground,
        ),
        bodyLarge: TextStyle(
          fontFamily: 'DM Sans',
          fontSize: 16,
          color: OrdoColors.foreground,
        ),
        bodyMedium: TextStyle(
          fontFamily: 'DM Sans',
          fontSize: 14,
          color: OrdoColors.foreground,
        ),
        bodySmall: TextStyle(
          fontFamily: 'DM Sans',
          fontSize: 12,
          color: OrdoColors.mutedForeground,
        ),
        labelSmall: TextStyle(
          fontFamily: 'DM Sans',
          fontSize: 11,
          color: OrdoColors.mutedForeground,
        ),
      ),
      appBarTheme: AppBarTheme(
          backgroundColor: OrdoColors.background.withValues(alpha: 0.85),
        foregroundColor: OrdoColors.foreground,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        titleTextStyle: TextStyle(
          fontFamily: 'SpaceGrotesk',
          fontSize: 20,
          fontWeight: FontWeight.w700,
          color: OrdoColors.foreground,
          letterSpacing: -0.02,
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: OrdoColors.primary,
          foregroundColor: OrdoColors.primaryForeground,
          padding: EdgeInsets.symmetric(horizontal: 20, vertical: 12),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          textStyle: TextStyle(
            fontFamily: 'DM Sans',
            fontWeight: FontWeight.w600,
            fontSize: 14,
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: OrdoColors.foreground,
          padding: EdgeInsets.symmetric(horizontal: 20, vertical: 12),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          side: BorderSide(color: OrdoColors.border),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: OrdoColors.secondary,
        contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: BorderSide(color: OrdoColors.border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: BorderSide(color: OrdoColors.border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: BorderSide(color: OrdoColors.primary),
        ),
        hintStyle: TextStyle(
          color: OrdoColors.mutedForeground,
          fontFamily: 'DM Sans',
        ),
      ),
      cardTheme: CardThemeData(
        color: OrdoColors.card,
        elevation: 0,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        margin: EdgeInsets.zero,
      ),
      dividerTheme: DividerThemeData(color: OrdoColors.border.withValues(alpha: 0.6)),
      bottomNavigationBarTheme: BottomNavigationBarThemeData(
        backgroundColor: OrdoColors.background.withValues(alpha: 0.95),
        selectedItemColor: OrdoColors.primary,
        unselectedItemColor: OrdoColors.mutedForeground,
        type: BottomNavigationBarType.fixed,
        elevation: 8,
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: OrdoColors.card,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      ),
      progressIndicatorTheme: ProgressIndicatorThemeData(
        color: OrdoColors.primary,
        linearTrackColor: OrdoColors.border,
      ),
    );
  }
}

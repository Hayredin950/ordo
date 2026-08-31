import 'package:flutter/material.dart';

class OrdoColors {
  static const Color background = Color(0xFF150D1F);
  static const Color foreground = Color(0xFFF2F0E8);
  static const Color surface = Color(0xFF37243E);
  static const Color card = Color(0xFF37243E);
  static const Color primary = Color(0xFFBF8A3C);
  static const Color primaryForeground = Color(0xFF303420);
  static const Color secondary = Color(0xFF473554);
  static const Color secondaryForeground = Color(0xFFF2F0E8);
  static const Color muted = Color(0xFF433A54);
  static const Color mutedForeground = Color(0xFFAEA8C0);
  static const Color accent = Color(0xFF4C3354);
  static const Color accentForeground = Color(0xFFF6F4FA);
  static const Color destructive = Color(0xFF993232);
  static const Color destructiveForeground = Color(0xFFF7F2F2);
  static const Color border = Color(0xFF4C3A54);
  static const Color input = Color(0xFF4C3A54);
  static const Color ring = Color(0xFFBF8A3C);

  static const Color catHealth = Color(0xFFBF8A3C);
  static const Color catStudy = Color(0xFF7A8EC0);
  static const Color catWork = Color(0xFFBF8A3C);
  static const Color catFinance = Color(0xFFC8A03C);
  static const Color catSpiritual = Color(0xFF9966A8);
  static const Color catRelationships = Color(0xFF548A3C);

  static const Color chart1 = Color(0xFFBF8A3C);
  static const Color chart2 = Color(0xFF7A8EC0);
  static const Color chart3 = Color(0xFF3CA86A);
  static const Color chart4 = Color(0xFF9966A8);
  static const Color chart5 = Color(0xFF548A3C);
  static const Color sidebar = Color(0xFF312A44);
  static const Color sidebarForeground = Color(0xFFF2F0E8);
  static const Color sidebarPrimary = Color(0xFFBF8A3C);
  static const Color sidebarPrimaryForeground = Color(0xFF303420);
  static const Color sidebarAccent = Color(0xFF473554);
  static const Color sidebarAccentForeground = Color(0xFFF2F0E8);
  static const Color sidebarBorder = Color(0xFF4C3A54);
  static const Color sidebarRing = Color(0xFFBF8A3C);
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

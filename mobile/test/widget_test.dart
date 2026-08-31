import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/themes/app_theme.dart';
import 'package:mobile/widgets/app_widgets.dart';

void main() {
  testWidgets('App theme renders correctly', (WidgetTester tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: OrdoTheme.lightTheme,
        home: const Scaffold(
          body: Panel(
            child: Text('Hello Ordo'),
          ),
        ),
      ),
    );
    expect(find.text('Hello Ordo'), findsOneWidget);
  });

  testWidgets('Panel widget renders with child', (WidgetTester tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: OrdoTheme.lightTheme,
        home: const Scaffold(
          body: Panel(
            child: Text('Test Panel'),
          ),
        ),
      ),
    );
    expect(find.text('Test Panel'), findsOneWidget);
  });

  testWidgets('ProgressRing renders correct percentage', (WidgetTester tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: OrdoTheme.lightTheme,
        home: const Scaffold(
          body: ProgressRing(value: 75, label: 'Score'),
        ),
      ),
    );
    expect(find.text('75%'), findsOneWidget);
    expect(find.text('Score'), findsOneWidget);
  });

  testWidgets('Stat widget displays value and label', (WidgetTester tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: OrdoTheme.lightTheme,
        home: const Scaffold(
          body: Stat(value: '42', label: 'Answer'),
        ),
      ),
    );
    expect(find.text('42'), findsOneWidget);
    expect(find.text('Answer'), findsOneWidget);
  });
}

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/channels_provider.dart';
import '../services/state_provider.dart';
import '../themes/app_theme.dart';
import 'onboarding_checklist.dart';

/// Bell in the app bar, left of the profile menu. Carries a red dot until every
/// getting-started step is done; tapping opens the checklist.
class NotificationBellButton extends StatelessWidget {
  const NotificationBellButton({super.key});

  @override
  Widget build(BuildContext context) {
    final pending = onboardingPending(
      context.watch<OrdoProvider>().state,
      telegramLinked: context.watch<ChannelsProvider>().telegramLinked,
    );

    return IconButton(
      tooltip: pending > 0
          ? '$pending setup step${pending == 1 ? '' : 's'} left'
          : 'Notifications',
      onPressed: () => showOnboardingChecklist(context),
      icon: Stack(
        clipBehavior: Clip.none,
        children: [
          const Icon(Icons.notifications_outlined, size: 22),
          if (pending > 0)
            Positioned(
              top: -1,
              right: -1,
              child: Container(
                width: 10,
                height: 10,
                decoration: BoxDecoration(
                  color: OrdoColors.destructive,
                  shape: BoxShape.circle,
                  border: Border.all(color: OrdoColors.background, width: 1.5),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

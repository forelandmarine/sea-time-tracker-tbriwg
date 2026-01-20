
import { Platform } from 'react-native';

// Platform-specific imports - only load on native platforms
const Notifications = Platform.OS !== 'web' ? require('expo-notifications') : null;
const Device = Platform.OS !== 'web' ? require('expo-device') : null;

console.log('[Notifications] Notification utility initialized');

// Set the notification handler to show notifications when app is in foreground
// Only on native platforms
if (Platform.OS !== 'web' && Notifications) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

/**
 * Request notification permissions from the user
 * Required for iOS to show notifications
 * Returns false on web (not supported)
 */
export async function registerForPushNotificationsAsync(): Promise<boolean> {
  // Notifications are not supported on web
  if (Platform.OS === 'web') {
    console.log('[Notifications] Notifications not supported on web');
    return false;
  }

  console.log('[Notifications] Requesting notification permissions');
  
  if (!Device.isDevice) {
    console.warn('[Notifications] Must use physical device for notifications');
    return false;
  }

  // Check existing permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  
  console.log('[Notifications] Existing permission status:', existingStatus);

  // Request permissions if not already granted
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
    console.log('[Notifications] Permission request result:', status);
  }

  if (finalStatus !== 'granted') {
    console.warn('[Notifications] Notification permissions not granted');
    return false;
  }

  // Set up notification channel for Android
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('sea-time-entries', {
      name: 'Sea Time Entries',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#007AFF',
      sound: 'default',
      description: 'Notifications for automatic sea time entries that need review',
    });
    console.log('[Notifications] Android notification channel created');
  }

  console.log('[Notifications] Notification permissions granted successfully');
  return true;
}

/**
 * Schedule a local notification for a new sea time entry
 * @param vesselName - Name of the vessel
 * @param entryId - ID of the sea time entry
 * @param durationHours - Duration of the sea time in hours
 * @returns notification ID or null if not supported/failed
 */
export async function scheduleSeaTimeNotification(
  vesselName: string,
  entryId: string,
  durationHours: number
): Promise<string | null> {
  // Notifications are not supported on web
  if (Platform.OS === 'web') {
    console.log('[Notifications] Skipping notification on web');
    return null;
  }

  try {
    console.log('[Notifications] Scheduling notification for sea time entry:', {
      vesselName,
      entryId,
      durationHours,
    });

    const durationDays = (durationHours / 24).toFixed(2);
    
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: '⚓️ New Sea Time Entry',
        body: `${vesselName} - ${durationHours.toFixed(1)} hours (${durationDays} days) at sea. Tap to review.`,
        data: {
          entryId,
          vesselName,
          durationHours,
          screen: 'confirmations',
          url: '/(tabs)/confirmations',
        },
        sound: 'default',
        badge: 1,
        ...(Platform.OS === 'android' && {
          channelId: 'sea-time-entries',
          priority: Notifications.AndroidNotificationPriority.HIGH,
        }),
      },
      trigger: null, // Deliver immediately
    });

    console.log('[Notifications] Notification scheduled successfully:', notificationId);
    return notificationId;
  } catch (error) {
    console.error('[Notifications] Failed to schedule notification:', error);
    return null;
  }
}

/**
 * Cancel a specific notification
 * @param notificationId - ID of the notification to cancel
 */
export async function cancelNotification(notificationId: string): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }

  try {
    console.log('[Notifications] Canceling notification:', notificationId);
    await Notifications.cancelScheduledNotificationAsync(notificationId);
    console.log('[Notifications] Notification canceled successfully');
  } catch (error) {
    console.error('[Notifications] Failed to cancel notification:', error);
  }
}

/**
 * Cancel all scheduled notifications
 */
export async function cancelAllNotifications(): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }

  try {
    console.log('[Notifications] Canceling all notifications');
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log('[Notifications] All notifications canceled successfully');
  } catch (error) {
    console.error('[Notifications] Failed to cancel all notifications:', error);
  }
}

/**
 * Get the badge count
 */
export async function getBadgeCount(): Promise<number> {
  if (Platform.OS === 'web') {
    return 0;
  }

  try {
    const count = await Notifications.getBadgeCountAsync();
    return count;
  } catch (error) {
    console.error('[Notifications] Failed to get badge count:', error);
    return 0;
  }
}

/**
 * Set the badge count
 * @param count - Number to set as badge
 */
export async function setBadgeCount(count: number): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }

  try {
    console.log('[Notifications] Setting badge count to:', count);
    await Notifications.setBadgeCountAsync(count);
  } catch (error) {
    console.error('[Notifications] Failed to set badge count:', error);
  }
}

/**
 * Clear the badge
 */
export async function clearBadge(): Promise<void> {
  await setBadgeCount(0);
}

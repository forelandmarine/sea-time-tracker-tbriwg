
import { useEffect, useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import * as seaTimeApi from '@/utils/seaTimeApi';
import { scheduleSeaTimeNotification, scheduleDailySeaTimeReviewNotification, registerForPushNotificationsAsync } from '@/utils/notifications';

/**
 * Hook to poll for new notifications and trigger local notifications
 * This checks the backend for new notification records and displays them as local notifications
 * Only works on native platforms (iOS/Android) - web is not supported
 */
export function useNotifications() {
  const lastCheckedRef = useRef<Set<string>>(new Set());
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const checkForNewNotifications = useCallback(async () => {
    // Skip on web - notifications not supported
    if (Platform.OS === 'web') {
      console.log('[useNotifications] Skipping notification check on web');
      return;
    }

    try {
      console.log('[useNotifications] Checking for new notifications');
      const result = await seaTimeApi.getNewSeaTimeEntries();
      
      if (!result.newEntries || result.newEntries.length === 0) {
        console.log('[useNotifications] No new entries to notify');
        return;
      }

      console.log('[useNotifications] Found', result.newEntries.length, 'new entries');

      // Schedule local notifications for each new entry
      for (const entry of result.newEntries) {
        // Skip if we've already checked this entry
        if (lastCheckedRef.current.has(entry.id)) {
          console.log('[useNotifications] Skipping already notified entry:', entry.id);
          continue;
        }

        const vesselName = entry.vessel_name || 'Unknown Vessel';
        const durationHours = typeof entry.duration_hours === 'string' 
          ? parseFloat(entry.duration_hours) 
          : entry.duration_hours || 0;
        const mcaCompliant = entry.mca_compliant !== null && entry.mca_compliant !== undefined 
          ? entry.mca_compliant 
          : durationHours >= 4.0;

        console.log('[useNotifications] Scheduling local notification for:', {
          vesselName,
          durationHours,
          mcaCompliant,
          entryId: entry.id,
        });

        await scheduleSeaTimeNotification(vesselName, entry.id, durationHours, mcaCompliant);

        // Mark as checked so we don't show it again
        lastCheckedRef.current.add(entry.id);
      }
    } catch (error) {
      console.error('[useNotifications] Failed to check for notifications:', error);
    }
  }, []);

  useEffect(() => {
    // Skip on web - notifications not supported
    if (Platform.OS === 'web') {
      console.log('[useNotifications] Notifications not supported on web, skipping setup');
      return;
    }

    console.log('[useNotifications] Setting up notification polling');

    // Request notification permissions and set up daily notification
    const setupNotifications = async () => {
      const hasPermission = await registerForPushNotificationsAsync();
      if (hasPermission) {
        console.log('[useNotifications] Syncing notification schedule with backend');
        try {
          // Fetch the user's notification schedule from backend
          const schedule = await seaTimeApi.getNotificationSchedule();
          console.log('[useNotifications] Backend schedule:', schedule);
          
          if (schedule && schedule.is_active) {
            // Schedule local notification at the user's preferred time
            const scheduledTime = schedule.scheduled_time || '18:00';
            console.log('[useNotifications] Setting up daily notification at', scheduledTime);
            await scheduleDailySeaTimeReviewNotification(scheduledTime);
          } else {
            console.log('[useNotifications] Daily notifications are disabled in backend');
          }
        } catch (error) {
          console.error('[useNotifications] Failed to sync with backend schedule, using default:', error);
          // Fallback to default time if backend sync fails
          await scheduleDailySeaTimeReviewNotification('18:00');
        }
      } else {
        console.warn('[useNotifications] Notification permissions not granted, skipping daily notification setup');
      }
    };

    setupNotifications();

    // Check immediately on mount
    checkForNewNotifications();

    // Then check every 30 seconds
    intervalRef.current = setInterval(checkForNewNotifications, 30000);

    return () => {
      console.log('[useNotifications] Cleaning up notification polling');
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [checkForNewNotifications]);
}

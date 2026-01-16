
import { useEffect, useRef } from 'react';
import * as seaTimeApi from '@/utils/seaTimeApi';
import { scheduleSeaTimeNotification } from '@/utils/notifications';

/**
 * Hook to poll for new notifications and trigger local notifications
 * This checks the backend for new notification records and displays them as local notifications
 */
export function useNotifications() {
  const lastCheckedRef = useRef<Set<string>>(new Set());
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    console.log('[useNotifications] Setting up notification polling');

    const checkForNewNotifications = async () => {
      try {
        console.log('[useNotifications] Checking for new notifications');
        const notifications = await seaTimeApi.getNotifications();
        
        // Filter for unread sea time entry notifications
        const newNotifications = notifications.filter(
          (notif) =>
            !notif.is_read &&
            notif.notification_type === 'sea_time_entry_created' &&
            !lastCheckedRef.current.has(notif.id)
        );

        console.log('[useNotifications] Found', newNotifications.length, 'new notifications');

        // Schedule local notifications for each new notification
        for (const notif of newNotifications) {
          const vesselName = notif.data.vessel_name || 'Unknown Vessel';
          const durationHours = notif.data.duration_hours || 0;
          const entryId = notif.data.entry_id || notif.entry_id;

          console.log('[useNotifications] Scheduling local notification for:', {
            vesselName,
            durationHours,
            entryId,
          });

          await scheduleSeaTimeNotification(vesselName, entryId, durationHours);

          // Mark as checked so we don't show it again
          lastCheckedRef.current.add(notif.id);
        }
      } catch (error) {
        console.error('[useNotifications] Failed to check for notifications:', error);
      }
    };

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
  }, []);
}

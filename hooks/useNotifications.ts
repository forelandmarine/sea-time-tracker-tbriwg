
import { useEffect, useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import * as seaTimeApi from '@/utils/seaTimeApi';
import { scheduleSeaTimeNotification } from '@/utils/notifications';

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

        console.log('[useNotifications] Scheduling local notification for:', {
          vesselName,
          durationHours,
          entryId: entry.id,
        });

        await scheduleSeaTimeNotification(vesselName, entry.id, durationHours);

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

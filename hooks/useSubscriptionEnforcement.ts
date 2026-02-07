
import { useCallback } from 'react';
import { Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useRevenueCat } from '@/contexts/RevenueCatContext';

/**
 * Hook to enforce subscription requirements for premium features
 * 
 * Usage:
 * const { requireSubscription, handleSubscriptionError } = useSubscriptionEnforcement();
 * 
 * // Before performing a premium action:
 * if (!requireSubscription()) return;
 * // ... perform action
 * 
 * // Or handle API errors:
 * try {
 *   await apiCall();
 * } catch (error) {
 *   if (handleSubscriptionError(error)) return;
 *   // Handle other errors
 * }
 */
export function useSubscriptionEnforcement() {
  const router = useRouter();
  const { hasActiveSubscription, subscriptionStatus, checkSubscription } = useRevenueCat();

  /**
   * Check if user has an active subscription
   * If not, show alert and redirect to paywall
   * Returns true if subscription is active, false otherwise
   */
  const requireSubscription = useCallback((featureName?: string): boolean => {
    if (hasActiveSubscription) {
      return true;
    }

    console.log('[SubscriptionEnforcement] Subscription required for:', featureName || 'this feature');
    console.log('[SubscriptionEnforcement] Current status:', subscriptionStatus.status);

    const featureText = featureName ? ` ${featureName}` : ' this feature';
    
    Alert.alert(
      'Subscription Required',
      `An active subscription is required to use${featureText}. Please subscribe to continue tracking your sea time.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Subscribe',
          onPress: () => {
            console.log('[SubscriptionEnforcement] Redirecting to subscription paywall');
            router.push('/subscription-paywall');
          },
        },
      ]
    );

    return false;
  }, [hasActiveSubscription, subscriptionStatus, router]);

  /**
   * Handle subscription-related API errors (403 SUBSCRIPTION_REQUIRED)
   * Returns true if error was handled, false if it should be handled elsewhere
   */
  const handleSubscriptionError = useCallback((error: any): boolean => {
    // Check if error is a subscription error (403 with SUBSCRIPTION_REQUIRED code)
    const errorMessage = error?.message || error?.toString() || '';
    const isSubscriptionError = 
      errorMessage.includes('403') || 
      errorMessage.includes('SUBSCRIPTION_REQUIRED') ||
      errorMessage.includes('PAYMENT_REQUIRED') ||
      errorMessage.includes('Active subscription required');

    if (!isSubscriptionError) {
      return false;
    }

    console.log('[SubscriptionEnforcement] Subscription error detected:', errorMessage);
    
    // Refresh subscription status
    checkSubscription().catch((err) => {
      console.error('[SubscriptionEnforcement] Failed to refresh subscription:', err);
    });

    // Show subscription required alert
    Alert.alert(
      'Subscription Required',
      'Your subscription has expired or is inactive. Please renew your subscription to continue using this feature.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Manage Subscription',
          onPress: () => {
            console.log('[SubscriptionEnforcement] Redirecting to subscription paywall');
            router.push('/subscription-paywall');
          },
        },
      ]
    );

    return true;
  }, [checkSubscription, router]);

  /**
   * Check if user has an active subscription without showing alert
   * Returns true if subscription is active, false otherwise
   */
  const hasSubscription = useCallback((): boolean => {
    return hasActiveSubscription;
  }, [hasActiveSubscription]);

  /**
   * Pause all vessel tracking when subscription becomes inactive
   */
  const pauseTracking = useCallback(async (): Promise<boolean> => {
    try {
      console.log('[SubscriptionEnforcement] Pausing vessel tracking');
      
      const { authenticatedPatch } = await import('@/utils/api');
      const response = await authenticatedPatch<{ success: boolean; vesselsDeactivated: number }>(
        '/api/subscription/pause-tracking',
        {}
      );
      
      console.log('[SubscriptionEnforcement] Tracking paused:', response);
      return response.success;
    } catch (error: any) {
      console.error('[SubscriptionEnforcement] Failed to pause tracking:', error);
      return false;
    }
  }, []);

  return {
    requireSubscription,
    handleSubscriptionError,
    hasSubscription,
    pauseTracking,
    subscriptionStatus,
  };
}

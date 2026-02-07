
/**
 * StoreKit Integration for iOS In-App Purchases (WEB STUB)
 * 
 * This is a stub file for web/non-iOS platforms.
 * The actual implementation is in storeKit.native.ts for iOS/Android.
 * 
 * Product ID: com.forelandmarine.seatime.monthly
 * App ID: 6758010893
 * 
 * ✅ APPLE GUIDELINE 3.1.2 COMPLIANCE - Proper subscription management
 */

import { Platform, Linking, Alert } from 'react-native';
import { authenticatedPost } from './api';

// Product ID configured in App Store Connect
export const SUBSCRIPTION_PRODUCT_ID = 'com.forelandmarine.seatime.monthly';

// COMPLIANCE: Apple subscription management URL
const APPLE_SUBSCRIPTION_URL = 'https://apps.apple.com/account/subscriptions';
const APP_STORE_APP_URL = 'https://apps.apple.com/app/id6758010893';

/**
 * Initialize StoreKit connection
 * Since we're using App Store links, this just validates the platform
 */
export async function initializeStoreKit(): Promise<boolean> {
  if (Platform.OS !== 'ios') {
    console.log('[StoreKit] Not on iOS, skipping initialization');
    return false;
  }

  console.log('[StoreKit] StoreKit integration ready (using App Store links)');
  return true;
}

/**
 * Get product information from App Store
 * CRITICAL: Never hardcode prices - always fetch from App Store
 * Returns null because we direct users to App Store for pricing
 */
export async function getProductInfo(): Promise<any | null> {
  if (Platform.OS !== 'ios') {
    console.log('[StoreKit] Not on iOS, cannot get product info');
    return null;
  }

  console.log('[StoreKit] Product info must be viewed in App Store (no hardcoded prices)');
  return null;
}

/**
 * Setup purchase listeners (stub for web)
 */
export function setupPurchaseListeners(
  onPurchaseUpdate: (purchase: any) => void,
  onPurchaseError: (error: any) => void
): void {
  console.log('[StoreKit] Purchase listeners not available on web');
}

/**
 * Remove purchase listeners (stub for web)
 */
export function removePurchaseListeners(): void {
  console.log('[StoreKit] Purchase listeners not available on web');
}

/**
 * Process a purchase (stub for web)
 */
export async function processPurchase(purchase: any): Promise<{
  success: boolean;
  status?: 'active' | 'inactive';
  error?: string;
}> {
  console.log('[StoreKit] Purchase processing not available on web');
  return {
    success: false,
    error: 'Purchase processing only available on iOS',
  };
}

/**
 * Open App Store subscription page
 * This is the primary method for users to subscribe and view pricing
 */
export async function openAppStoreSubscription(): Promise<void> {
  if (Platform.OS !== 'ios') {
    console.warn('[StoreKit] App Store subscriptions are iOS-only');
    Alert.alert(
      'iOS Only',
      'Subscriptions are currently only available on iOS devices.',
      [{ text: 'OK' }]
    );
    return;
  }

  try {
    console.log('[StoreKit] Opening App Store subscription page');
    
    // Try to open the app's subscription page directly
    const appUrl = `${APP_STORE_APP_URL}?action=subscribe`;
    const canOpenApp = await Linking.canOpenURL(appUrl);
    
    if (canOpenApp) {
      await Linking.openURL(appUrl);
      console.log('[StoreKit] Opened app subscription page');
    } else {
      // Fallback to general subscriptions page
      const canOpenGeneral = await Linking.canOpenURL(APPLE_SUBSCRIPTION_URL);
      if (canOpenGeneral) {
        await Linking.openURL(APPLE_SUBSCRIPTION_URL);
        console.log('[StoreKit] Opened general subscriptions page');
      } else {
        throw new Error('Cannot open App Store');
      }
    }
  } catch (error: any) {
    console.error('[StoreKit] Error opening App Store:', error);
    
    // Show instructions as fallback
    Alert.alert(
      'Subscribe to SeaTime Tracker',
      'To subscribe:\n\n1. Open the App Store\n2. Search for "SeaTime Tracker"\n3. Tap "Subscribe"\n\nOr manage subscriptions in:\nSettings → Apple ID → Subscriptions',
      [{ text: 'OK' }]
    );
  }
}

/**
 * COMPLIANCE: Open Apple subscription management page (3.1.2)
 * Opens https://apps.apple.com/account/subscriptions
 * Falls back to app-settings: if URL cannot be opened
 */
export async function openSubscriptionManagement(): Promise<void> {
  if (Platform.OS !== 'ios') {
    console.warn('[StoreKit] Subscription management is iOS-only');
    Alert.alert(
      'iOS Only',
      'Subscription management is only available on iOS devices.',
      [{ text: 'OK' }]
    );
    return;
  }

  try {
    console.log('[StoreKit] Opening Apple subscription management page');
    
    // COMPLIANCE: Try to open Apple's subscription management URL first
    const canOpenURL = await Linking.canOpenURL(APPLE_SUBSCRIPTION_URL);
    
    if (canOpenURL) {
      await Linking.openURL(APPLE_SUBSCRIPTION_URL);
      console.log('[StoreKit] ✅ Opened Apple subscription management');
      return;
    }
    
    // Fallback to app settings if URL cannot be opened
    console.log('[StoreKit] Cannot open URL, falling back to app settings');
    const settingsUrl = 'app-settings:';
    const canOpenSettings = await Linking.canOpenURL(settingsUrl);
    
    if (canOpenSettings) {
      await Linking.openURL(settingsUrl);
      console.log('[StoreKit] ✅ Opened iOS Settings');
    } else {
      throw new Error('Cannot open Settings');
    }
  } catch (error: any) {
    console.error('[StoreKit] ❌ Error opening subscription management:', error.message);
    
    Alert.alert(
      'Manage Subscription',
      'To manage your subscription:\n\n1. Open Settings\n2. Tap your name at the top\n3. Tap "Subscriptions"\n4. Select "SeaTime Tracker"',
      [{ text: 'OK' }]
    );
  }
}

/**
 * Purchase subscription
 * Directs user to App Store since we're using direct links
 */
export async function purchaseSubscription(): Promise<void> {
  if (Platform.OS !== 'ios') {
    Alert.alert(
      'iOS Only',
      'Subscriptions are only available on iOS',
      [{ text: 'OK' }]
    );
    return;
  }

  try {
    console.log('[StoreKit] Directing user to App Store for subscription');
    await openAppStoreSubscription();
  } catch (error: any) {
    console.error('[StoreKit] Purchase error:', error);
    Alert.alert(
      'Error',
      error.message || 'Unable to open App Store',
      [{ text: 'OK' }]
    );
  }
}

/**
 * Restore previous purchases
 * Directs user to check subscription status
 */
export async function restorePurchases(): Promise<{
  success: boolean;
  receipt?: string;
  error?: string;
}> {
  if (Platform.OS !== 'ios') {
    return {
      success: false,
      error: 'Restore is only available on iOS',
    };
  }

  try {
    console.log('[StoreKit] User requested restore - checking subscription status');
    
    // User should use "Check Subscription Status" button instead
    return {
      success: false,
      error: 'Please tap "Check Subscription Status" to verify your subscription',
    };
  } catch (error: any) {
    console.error('[StoreKit] Restore error:', error);
    return {
      success: false,
      error: error.message || 'Unable to restore purchases',
    };
  }
}

/**
 * Verify receipt with backend
 * Note: In production, iOS automatically sends receipts to the app
 * This function is for manual verification if needed
 */
export async function verifyReceiptWithBackend(
  receipt: string,
  isSandbox: boolean = __DEV__
): Promise<{
  success: boolean;
  status?: 'active' | 'inactive';
  expiresAt?: string;
  error?: string;
}> {
  try {
    console.log('[StoreKit] Verifying receipt with backend, sandbox:', isSandbox);

    const response = await authenticatedPost<{
      success: boolean;
      status: 'active' | 'inactive';
      expiresAt: string | null;
    }>('/api/subscription/verify', {
      receiptData: receipt,
      productId: SUBSCRIPTION_PRODUCT_ID,
      isSandbox,
    });

    console.log('[StoreKit] Receipt verified, status:', response.status);

    return {
      success: response.success,
      status: response.status,
      expiresAt: response.expiresAt || undefined,
    };
  } catch (error: any) {
    console.error('[StoreKit] Receipt verification error:', error);
    return {
      success: false,
      error: error.message || 'Verification failed',
    };
  }
}

/**
 * Complete purchase flow: purchase + verify
 * Since we're using App Store links, this directs to App Store
 */
export async function completePurchaseFlow(): Promise<{
  success: boolean;
  status?: 'active' | 'inactive';
  error?: string;
}> {
  console.log('[StoreKit] Starting complete purchase flow');

  await purchaseSubscription();
  
  return {
    success: false,
    error: 'Please complete purchase in App Store',
  };
}

/**
 * Complete restore flow: restore + verify
 * Since we're using App Store links, this checks backend status
 */
export async function completeRestoreFlow(): Promise<{
  success: boolean;
  status?: 'active' | 'inactive';
  error?: string;
}> {
  console.log('[StoreKit] Starting complete restore flow');

  const restoreResult = await restorePurchases();
  
  return {
    success: false,
    error: restoreResult.error || 'Please check subscription status',
  };
}

/**
 * Helper function to show subscription instructions
 */
export function showSubscriptionInstructions(): void {
  Alert.alert(
    'How to Subscribe',
    'SeaTime Tracker uses native in-app purchases on iOS:\n\n' +
    '1. Tap "Subscribe Now" to see pricing in your local currency\n' +
    '2. Complete your purchase using Apple Pay or your Apple ID\n' +
    '3. Your subscription will be active immediately\n\n' +
    'Your subscription is managed through your Apple ID and will automatically renew each month.\n\n' +
    'You can manage or cancel your subscription anytime in:\nSettings → Apple ID → Subscriptions',
    [{ text: 'Got it' }]
  );
}

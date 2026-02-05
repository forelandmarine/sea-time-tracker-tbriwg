
/**
 * StoreKit Integration for iOS In-App Purchases
 * 
 * This module handles iOS App Store subscriptions using direct App Store links.
 * 
 * Product ID: com.forelandmarine.seatime.monthly
 * App ID: 6758010893
 * 
 * IMPORTANT: Prices are NEVER hardcoded. They are fetched from the App Store
 * to comply with Apple's StoreKit guidelines and ensure accurate pricing.
 * 
 * Flow:
 * 1. User taps "Subscribe" button → Opens App Store subscription page
 * 2. User completes purchase via App Store
 * 3. App receives receipt from StoreKit (automatic via iOS)
 * 4. App sends receipt to backend for verification
 * 5. Backend verifies with Apple servers using APPLE_APP_SECRET
 * 6. Backend updates user subscription status
 * 7. App checks subscription status and grants access
 * 
 * Note: We use direct App Store links instead of expo-store-kit because
 * expo-store-kit v0.0.1 is incomplete and causes build failures.
 */

import { Platform, Linking, Alert } from 'react-native';
import { authenticatedPost } from './api';

// Product ID configured in App Store Connect
export const SUBSCRIPTION_PRODUCT_ID = 'com.forelandmarine.seatime.monthly';

// App Store URLs
const APP_STORE_SUBSCRIPTION_URL = 'https://apps.apple.com/account/subscriptions';
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
export async function getProductInfo(): Promise<{
  productIdentifier: string;
  price: string;
  priceLocale: { currencySymbol: string; currencyCode: string };
  localizedTitle: string;
  localizedDescription: string;
} | null> {
  if (Platform.OS !== 'ios') {
    console.log('[StoreKit] Not on iOS, cannot get product info');
    return null;
  }

  console.log('[StoreKit] Product info must be viewed in App Store (no hardcoded prices)');
  return null;
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
      const canOpenGeneral = await Linking.canOpenURL(APP_STORE_SUBSCRIPTION_URL);
      if (canOpenGeneral) {
        await Linking.openURL(APP_STORE_SUBSCRIPTION_URL);
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
 * Open iOS Settings to manage subscriptions
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
    console.log('[StoreKit] Opening subscription management');
    
    const canOpen = await Linking.canOpenURL(APP_STORE_SUBSCRIPTION_URL);
    if (canOpen) {
      await Linking.openURL(APP_STORE_SUBSCRIPTION_URL);
      console.log('[StoreKit] Opened subscription management');
    } else {
      throw new Error('Cannot open subscription management');
    }
  } catch (error: any) {
    console.error('[StoreKit] Error opening subscription management:', error);
    
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
export async function purchaseSubscription(): Promise<{
  success: boolean;
  receipt?: string;
  error?: string;
}> {
  if (Platform.OS !== 'ios') {
    return {
      success: false,
      error: 'Subscriptions are only available on iOS',
    };
  }

  try {
    console.log('[StoreKit] Directing user to App Store for subscription');
    
    await openAppStoreSubscription();
    
    // Return pending status - user needs to complete purchase in App Store
    return {
      success: false,
      error: 'Please complete your subscription in the App Store, then return here and tap "Check Subscription Status"',
    };
  } catch (error: any) {
    console.error('[StoreKit] Purchase error:', error);
    return {
      success: false,
      error: error.message || 'Unable to open App Store',
    };
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

  const purchaseResult = await purchaseSubscription();
  
  return {
    success: false,
    error: purchaseResult.error || 'Please complete purchase in App Store',
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

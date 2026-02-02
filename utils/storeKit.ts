
/**
 * StoreKit Integration for iOS In-App Purchases
 * 
 * This module handles iOS App Store subscriptions using expo-store-kit.
 * 
 * Product ID: com.forelandmarine.seatime.monthly
 * Price: £4.99/€5.99 per month
 * No trial period
 * 
 * Flow:
 * 1. User taps "Subscribe" button
 * 2. App requests product info from App Store
 * 3. User completes purchase via native iOS payment sheet
 * 4. App receives receipt from StoreKit
 * 5. App sends receipt to backend for verification
 * 6. Backend verifies with Apple servers
 * 7. Backend updates user subscription status
 * 8. App checks subscription status and grants access
 */

import { Platform } from 'react-native';
import * as StoreKit from 'expo-store-kit';
import { authenticatedPost } from './api';

// Product ID configured in App Store Connect
export const SUBSCRIPTION_PRODUCT_ID = 'com.forelandmarine.seatime.monthly';

/**
 * Initialize StoreKit connection
 */
export async function initializeStoreKit(): Promise<boolean> {
  if (Platform.OS !== 'ios') {
    console.log('[StoreKit] Not on iOS, skipping initialization');
    return false;
  }

  try {
    console.log('[StoreKit] Initializing StoreKit connection');
    
    // Check if StoreKit is available
    if (typeof StoreKit !== 'object') {
      console.warn('[StoreKit] StoreKit module not available');
      return false;
    }

    console.log('[StoreKit] StoreKit initialized successfully');
    return true;
  } catch (error: any) {
    console.error('[StoreKit] Initialization error:', error);
    return false;
  }
}

/**
 * Get product information from App Store
 * Note: expo-store-kit v0.0.1 may have limited API surface
 */
export async function getProductInfo(): Promise<any | null> {
  if (Platform.OS !== 'ios') {
    console.log('[StoreKit] Not on iOS, cannot get product info');
    return null;
  }

  try {
    console.log('[StoreKit] Fetching product info for:', SUBSCRIPTION_PRODUCT_ID);
    
    // expo-store-kit v0.0.1 may not have getProductsAsync
    // We'll return a placeholder for now
    console.warn('[StoreKit] getProductsAsync not available in expo-store-kit v0.0.1');
    
    return {
      productIdentifier: SUBSCRIPTION_PRODUCT_ID,
      price: '4.99',
      priceLocale: { currencySymbol: '£' },
      localizedTitle: 'SeaTime Tracker Monthly',
    };
  } catch (error: any) {
    console.error('[StoreKit] Error fetching product info:', error);
    return null;
  }
}

/**
 * Purchase subscription
 * Note: This is a placeholder implementation until expo-store-kit API is confirmed
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
    console.log('[StoreKit] Starting purchase flow for:', SUBSCRIPTION_PRODUCT_ID);
    console.warn('[StoreKit] expo-store-kit v0.0.1 has limited API - purchase flow not fully implemented');

    // expo-store-kit v0.0.1 doesn't have the full API yet
    // For now, we'll return an error directing users to the App Store
    return {
      success: false,
      error: 'Please subscribe via the App Store. Open Settings → Apple ID → Subscriptions to manage your subscription.',
    };
  } catch (error: any) {
    console.error('[StoreKit] Purchase error:', error);
    return {
      success: false,
      error: error.message || 'Purchase failed',
    };
  }
}

/**
 * Restore previous purchases
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
    console.log('[StoreKit] Restoring purchases');
    console.warn('[StoreKit] expo-store-kit v0.0.1 has limited API - restore not fully implemented');

    return {
      success: false,
      error: 'Please check your subscription status in iOS Settings → Apple ID → Subscriptions',
    };
  } catch (error: any) {
    console.error('[StoreKit] Restore error:', error);
    return {
      success: false,
      error: error.message || 'Restore failed',
    };
  }
}

/**
 * Verify receipt with backend
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
 */
export async function completePurchaseFlow(): Promise<{
  success: boolean;
  status?: 'active' | 'inactive';
  error?: string;
}> {
  console.log('[StoreKit] Starting complete purchase flow');

  // Step 1: Purchase
  const purchaseResult = await purchaseSubscription();
  if (!purchaseResult.success || !purchaseResult.receipt) {
    return {
      success: false,
      error: purchaseResult.error || 'Purchase failed',
    };
  }

  // Step 2: Verify with backend
  const verifyResult = await verifyReceiptWithBackend(purchaseResult.receipt);
  if (!verifyResult.success) {
    return {
      success: false,
      error: verifyResult.error || 'Verification failed',
    };
  }

  console.log('[StoreKit] Purchase flow completed successfully');

  return {
    success: true,
    status: verifyResult.status,
  };
}

/**
 * Complete restore flow: restore + verify
 */
export async function completeRestoreFlow(): Promise<{
  success: boolean;
  status?: 'active' | 'inactive';
  error?: string;
}> {
  console.log('[StoreKit] Starting complete restore flow');

  // Step 1: Restore
  const restoreResult = await restorePurchases();
  if (!restoreResult.success || !restoreResult.receipt) {
    return {
      success: false,
      error: restoreResult.error || 'No purchases to restore',
    };
  }

  // Step 2: Verify with backend
  const verifyResult = await verifyReceiptWithBackend(restoreResult.receipt);
  if (!verifyResult.success) {
    return {
      success: false,
      error: verifyResult.error || 'Verification failed',
    };
  }

  console.log('[StoreKit] Restore flow completed successfully');

  return {
    success: true,
    status: verifyResult.status,
  };
}


/**
 * StoreKit Integration for iOS In-App Purchases (NATIVE ONLY)
 * 
 * This module handles iOS App Store subscriptions using react-native-iap.
 * This file is used ONLY on iOS/Android (via .native.ts extension).
 * 
 * Product ID: com.forelandmarine.seatime.monthly
 * App ID: 6758010893
 * 
 * IMPORTANT: This implements NATIVE in-app purchases to comply with Apple's
 * Guideline 3.1.1. Users can purchase subscriptions directly within the app.
 * 
 * Flow:
 * 1. User taps "Subscribe" button → Native iOS purchase sheet appears
 * 2. User completes purchase via StoreKit (Apple's native payment system)
 * 3. App receives receipt from StoreKit automatically
 * 4. App sends receipt to backend for verification
 * 5. Backend verifies with Apple servers using APPLE_APP_SECRET
 * 6. Backend updates user subscription status
 * 7. App checks subscription status and grants access
 */

import { Platform, Alert } from 'react-native';
import * as RNIap from 'react-native-iap';
import { authenticatedPost } from './api';

// Product ID configured in App Store Connect
export const SUBSCRIPTION_PRODUCT_ID = 'com.forelandmarine.seatime.monthly';

// Subscription SKUs
const subscriptionSkus = Platform.select({
  ios: [SUBSCRIPTION_PRODUCT_ID],
  android: [],
  default: [],
});

let isInitialized = false;

/**
 * Initialize StoreKit connection
 * IMPORTANT: This should only be called when needed (e.g., on subscription screen)
 * NOT during app startup to avoid blocking authentication
 */
export async function initializeStoreKit(): Promise<boolean> {
  if (Platform.OS !== 'ios') {
    console.log('[StoreKit] Not on iOS, skipping initialization');
    return false;
  }

  if (isInitialized) {
    console.log('[StoreKit] Already initialized');
    return true;
  }

  try {
    console.log('[StoreKit] Initializing connection to App Store');
    console.log('[StoreKit] Platform:', Platform.OS);
    console.log('[StoreKit] RNIap available:', typeof RNIap !== 'undefined');
    console.log('[StoreKit] RNIap.initConnection available:', typeof RNIap.initConnection === 'function');
    
    // Add timeout to prevent blocking
    const initPromise = RNIap.initConnection();
    const timeoutPromise = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error('StoreKit initialization timeout after 5 seconds')), 5000)
    );
    
    const result = await Promise.race([initPromise, timeoutPromise]);
    console.log('[StoreKit] initConnection result:', result);
    
    // Clear any pending transactions (non-blocking)
    RNIap.flushFailedPurchasesCachedAsPendingAndroid().catch((err) => {
      console.warn('[StoreKit] Failed to flush pending purchases:', err);
    });
    
    isInitialized = true;
    console.log('[StoreKit] Successfully initialized');
    return true;
  } catch (error: any) {
    console.error('[StoreKit] Initialization error:', error);
    console.error('[StoreKit] Error details:', {
      message: error.message,
      code: error.code,
      name: error.name,
      stack: error.stack,
    });
    // Don't throw - allow app to continue without StoreKit
    return false;
  }
}

/**
 * Get product information from App Store
 * Fetches real-time pricing in user's local currency
 */
export async function getProductInfo(): Promise<{
  productId: string;
  price: string;
  localizedPrice: string;
  currency: string;
  title: string;
  description: string;
} | null> {
  if (Platform.OS !== 'ios') {
    console.log('[StoreKit] Not on iOS, cannot get product info');
    return null;
  }

  try {
    console.log('[StoreKit] Fetching product info from App Store');
    console.log('[StoreKit] Product ID:', SUBSCRIPTION_PRODUCT_ID);
    console.log('[StoreKit] Subscription SKUs:', subscriptionSkus);
    
    if (!isInitialized) {
      console.log('[StoreKit] Not initialized, initializing now...');
      const initialized = await initializeStoreKit();
      if (!initialized) {
        console.warn('[StoreKit] Failed to initialize, cannot get product info');
        return null;
      }
    }

    console.log('[StoreKit] Calling RNIap.getSubscriptions with SKUs:', subscriptionSkus);
    
    // Add timeout to prevent blocking
    const productsPromise = RNIap.getSubscriptions({ skus: subscriptionSkus as string[] });
    const timeoutPromise = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error('Product fetch timeout after 5 seconds')), 5000)
    );
    
    const products = await Promise.race([productsPromise, timeoutPromise]);
    
    console.log('[StoreKit] Received products from App Store:', products.length);
    
    if (products.length === 0) {
      console.warn('[StoreKit] No products found for SKUs:', subscriptionSkus);
      console.warn('[StoreKit] Make sure the product is configured in App Store Connect');
      console.warn('[StoreKit] Product ID should be:', SUBSCRIPTION_PRODUCT_ID);
      return null;
    }

    const product = products[0];
    console.log('[StoreKit] Product info received:', {
      productId: product.productId,
      price: product.price,
      localizedPrice: product.localizedPrice,
      currency: product.currency,
      title: product.title,
      description: product.description,
    });

    return {
      productId: product.productId,
      price: product.price,
      localizedPrice: product.localizedPrice,
      currency: product.currency,
      title: product.title,
      description: product.description || 'Monthly subscription to SeaTime Tracker',
    };
  } catch (error: any) {
    console.error('[StoreKit] Error fetching product info:', error);
    console.error('[StoreKit] Error details:', {
      message: error.message,
      code: error.code,
      name: error.name,
      stack: error.stack,
    });
    return null;
  }
}

/**
 * Purchase subscription using native StoreKit
 * This opens the native iOS purchase sheet
 */
export async function purchaseSubscription(): Promise<{
  success: boolean;
  receipt?: string;
  transactionId?: string;
  error?: string;
}> {
  if (Platform.OS !== 'ios') {
    return {
      success: false,
      error: 'Subscriptions are only available on iOS',
    };
  }

  try {
    console.log('[StoreKit] Starting subscription purchase');
    
    if (!isInitialized) {
      await initializeStoreKit();
    }

    // Request the purchase - this opens the native iOS payment sheet
    const purchase = await RNIap.requestSubscription({
      sku: SUBSCRIPTION_PRODUCT_ID,
    });

    console.log('[StoreKit] Purchase successful:', {
      transactionId: purchase.transactionId,
      productId: purchase.productId,
    });

    // Get the receipt
    const receipt = purchase.transactionReceipt;
    
    if (!receipt) {
      console.error('[StoreKit] No receipt received from purchase');
      return {
        success: false,
        error: 'No receipt received from App Store',
      };
    }

    return {
      success: true,
      receipt,
      transactionId: purchase.transactionId,
    };
  } catch (error: any) {
    console.error('[StoreKit] Purchase error:', error);
    
    // Handle user cancellation gracefully
    if (error.code === 'E_USER_CANCELLED') {
      return {
        success: false,
        error: 'Purchase cancelled',
      };
    }
    
    return {
      success: false,
      error: error.message || 'Purchase failed',
    };
  }
}

/**
 * Restore previous purchases
 * Required by Apple for subscription apps
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
    
    if (!isInitialized) {
      await initializeStoreKit();
    }

    const purchases = await RNIap.getAvailablePurchases();
    
    if (purchases.length === 0) {
      console.log('[StoreKit] No purchases to restore');
      return {
        success: false,
        error: 'No previous purchases found',
      };
    }

    // Find the subscription purchase
    const subscriptionPurchase = purchases.find(
      p => p.productId === SUBSCRIPTION_PRODUCT_ID
    );

    if (!subscriptionPurchase) {
      console.log('[StoreKit] No subscription purchase found');
      return {
        success: false,
        error: 'No subscription found to restore',
      };
    }

    console.log('[StoreKit] Found subscription to restore:', {
      transactionId: subscriptionPurchase.transactionId,
      productId: subscriptionPurchase.productId,
    });

    const receipt = subscriptionPurchase.transactionReceipt;
    
    if (!receipt) {
      return {
        success: false,
        error: 'No receipt found for subscription',
      };
    }

    return {
      success: true,
      receipt,
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

  // Step 1: Purchase subscription
  const purchaseResult = await purchaseSubscription();
  
  if (!purchaseResult.success || !purchaseResult.receipt) {
    return {
      success: false,
      error: purchaseResult.error || 'Purchase failed',
    };
  }

  // Step 2: Verify receipt with backend
  const verifyResult = await verifyReceiptWithBackend(
    purchaseResult.receipt,
    __DEV__ // Use sandbox in development
  );

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

  // Step 1: Restore purchases
  const restoreResult = await restorePurchases();
  
  if (!restoreResult.success || !restoreResult.receipt) {
    return {
      success: false,
      error: restoreResult.error || 'No purchases to restore',
    };
  }

  // Step 2: Verify receipt with backend
  const verifyResult = await verifyReceiptWithBackend(
    restoreResult.receipt,
    __DEV__ // Use sandbox in development
  );

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

/**
 * Finish a transaction (required by Apple)
 * Call this after successfully processing a purchase
 */
export async function finishTransaction(purchase: RNIap.Purchase): Promise<void> {
  try {
    await RNIap.finishTransaction({ purchase, isConsumable: false });
    console.log('[StoreKit] Transaction finished:', purchase.transactionId);
  } catch (error: any) {
    console.error('[StoreKit] Error finishing transaction:', error);
  }
}

/**
 * Clean up StoreKit connection
 * Call this when the app is closing or user logs out
 */
export async function disconnectStoreKit(): Promise<void> {
  try {
    await RNIap.endConnection();
    isInitialized = false;
    console.log('[StoreKit] Connection closed');
  } catch (error: any) {
    console.error('[StoreKit] Error closing connection:', error);
  }
}

/**
 * Helper function to show subscription instructions
 */
export function showSubscriptionInstructions(): void {
  Alert.alert(
    'How to Subscribe',
    'SeaTime Tracker uses native in-app purchases:\n\n' +
    '1. Tap "Subscribe Now" to see pricing\n' +
    '2. Complete your subscription using Apple Pay or your Apple ID\n' +
    '3. Your subscription will be active immediately\n\n' +
    'Your subscription is managed through your Apple ID and will automatically renew each month.\n\n' +
    'You can manage or cancel your subscription anytime in:\nSettings → Apple ID → Subscriptions',
    [{ text: 'Got it' }]
  );
}

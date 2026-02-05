
/**
 * StoreKit Integration - WEB STUB VERSION
 * 
 * This file provides stub implementations for web platform.
 * The actual native implementation is in storeKit.native.ts
 * 
 * On web, in-app purchases are not available, so all functions
 * return appropriate error messages or null values.
 */

// Product ID configured in App Store Connect
export const SUBSCRIPTION_PRODUCT_ID = 'com.forelandmarine.seatime.monthly';

/**
 * Initialize StoreKit connection (Web stub)
 */
export async function initializeStoreKit(): Promise<boolean> {
  console.log('[StoreKit Web] In-app purchases not available on web');
  return false;
}

/**
 * Get product information from App Store (Web stub)
 */
export async function getProductInfo(): Promise<{
  productId: string;
  price: string;
  localizedPrice: string;
  currency: string;
  title: string;
  description: string;
} | null> {
  console.log('[StoreKit Web] Product info not available on web');
  return null;
}

/**
 * Purchase subscription (Web stub)
 */
export async function purchaseSubscription(): Promise<{
  success: boolean;
  receipt?: string;
  transactionId?: string;
  error?: string;
}> {
  console.log('[StoreKit Web] Purchases not available on web');
  return {
    success: false,
    error: 'In-app purchases are only available on iOS',
  };
}

/**
 * Restore previous purchases (Web stub)
 */
export async function restorePurchases(): Promise<{
  success: boolean;
  receipt?: string;
  error?: string;
}> {
  console.log('[StoreKit Web] Restore not available on web');
  return {
    success: false,
    error: 'Restore is only available on iOS',
  };
}

/**
 * Verify receipt with backend (Web stub)
 */
export async function verifyReceiptWithBackend(
  receipt: string,
  isSandbox: boolean = false
): Promise<{
  success: boolean;
  status?: 'active' | 'inactive';
  expiresAt?: string;
  error?: string;
}> {
  console.log('[StoreKit Web] Receipt verification not available on web');
  return {
    success: false,
    error: 'Receipt verification only available on native platforms',
  };
}

/**
 * Complete purchase flow (Web stub)
 */
export async function completePurchaseFlow(): Promise<{
  success: boolean;
  status?: 'active' | 'inactive';
  error?: string;
}> {
  console.log('[StoreKit Web] Purchase flow not available on web');
  return {
    success: false,
    error: 'In-app purchases are only available on iOS',
  };
}

/**
 * Complete restore flow (Web stub)
 */
export async function completeRestoreFlow(): Promise<{
  success: boolean;
  status?: 'active' | 'inactive';
  error?: string;
}> {
  console.log('[StoreKit Web] Restore flow not available on web');
  return {
    success: false,
    error: 'Restore is only available on iOS',
  };
}

/**
 * Finish a transaction (Web stub)
 */
export async function finishTransaction(purchase: any): Promise<void> {
  console.log('[StoreKit Web] Transaction finishing not available on web');
}

/**
 * Clean up StoreKit connection (Web stub)
 */
export async function disconnectStoreKit(): Promise<void> {
  console.log('[StoreKit Web] Disconnect not needed on web');
}

/**
 * Helper function to show subscription instructions (Web stub)
 */
export function showSubscriptionInstructions(): void {
  console.log('[StoreKit Web] Subscription instructions not available on web');
  if (typeof window !== 'undefined' && window.alert) {
    window.alert('In-app purchases are only available on the iOS app. Please download the app from the App Store.');
  }
}

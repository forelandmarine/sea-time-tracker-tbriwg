
/**
 * StoreKit Integration for iOS In-App Purchases (NATIVE ONLY)
 * 
 * ✅ COMPLETELY REENGINEERED FOR STABILITY
 * ✅ LAZY LOADING - Module only loads when needed
 * ✅ AGGRESSIVE TIMEOUTS - Never blocks app startup
 * ✅ BULLETPROOF ERROR HANDLING - Graceful fallbacks everywhere
 * ✅ APPLE GUIDELINE 3.1.2 COMPLIANCE - Proper subscription management
 * ✅ COMPREHENSIVE BREADCRUMB LOGGING - Tracks all native calls
 */

import { Platform, Alert, Linking } from 'react-native';
import type { Purchase, PurchaseError } from 'react-native-iap';
import { authenticatedPost } from './api';

// CRITICAL: Aggressive timeouts to prevent blocking
const INIT_TIMEOUT = 2000; // 2 seconds max for initialization
const PRODUCT_FETCH_TIMEOUT = 3000; // 3 seconds max for product fetch
const MODULE_LOAD_TIMEOUT = 2000; // 2 seconds max for module load
const MODULE_RETRY_COOLDOWN = 5000; // 5 seconds before retry after failed module load

// COMPLIANCE: Apple subscription management URL
const APPLE_SUBSCRIPTION_URL = 'https://apps.apple.com/account/subscriptions';

// Lazy import RNIap - NEVER loaded until explicitly needed
let RNIap: any = null;
let iapLoadAttempted = false;
let iapLoadInFlight: Promise<boolean> | null = null;
let lastIapLoadFailureAt = 0;

// Product ID configured in App Store Connect
export const SUBSCRIPTION_PRODUCT_ID = 'com.forelandmarine.seatime.monthly';

const subscriptionSkus = Platform.select({
  ios: [SUBSCRIPTION_PRODUCT_ID],
  android: [],
  default: [],
});

let isInitialized = false;
let purchaseUpdateSubscription: any = null;
let purchaseErrorSubscription: any = null;

const getIapModule = (): any => {
  if (!RNIap) return null;
  return RNIap.default ?? RNIap;
};

const getPurchaseReceipt = (purchase: Purchase): string | null => {
  // react-native-iap v14+: purchaseToken is the unified token
  // (JWS for iOS / purchaseToken for Android).
  if (typeof purchase.purchaseToken === 'string' && purchase.purchaseToken.length > 0) {
    return purchase.purchaseToken;
  }

  // Backward-compatible fallback for older react-native-iap payload shapes.
  const withLegacyReceipt = purchase as Purchase & { transactionReceipt?: string | null };
  if (typeof withLegacyReceipt.transactionReceipt === 'string' && withLegacyReceipt.transactionReceipt.length > 0) {
    return withLegacyReceipt.transactionReceipt;
  }

  return null;
};

const getVerificationReceipt = async (purchase: Purchase): Promise<string | null> => {
  console.log('[StoreKit] ⚠️ BREADCRUMB: getVerificationReceipt called');
  const iap = getIapModule();

  // Backend currently verifies via Apple's /verifyReceipt endpoint,
  // which expects the app receipt (base64), not transaction identifiers.
  if (Platform.OS === 'ios' && iap?.getReceiptIOS) {
    try {
      console.log('[StoreKit] ⚠️ NATIVE CALL IMMINENT: getReceiptIOS');
      const appReceipt = await iap.getReceiptIOS();
      console.log('[StoreKit] ✅ NATIVE CALL SUCCESS: getReceiptIOS');
      if (typeof appReceipt === 'string' && appReceipt.length > 0) {
        console.log('[StoreKit] App receipt retrieved, length:', appReceipt.length);
        return appReceipt;
      }
    } catch (error: any) {
      console.error('[StoreKit] ❌ NATIVE CALL FAILED: getReceiptIOS');
      console.error('[StoreKit] Error:', error);
      console.warn('[StoreKit] Failed to get iOS app receipt, falling back to purchase token:', error?.message);
    }
  }

  const receipt = getPurchaseReceipt(purchase);
  console.log('[StoreKit] Using purchase token as receipt, length:', receipt?.length || 0);
  return receipt;
};

/**
 * Lazy load RNIap module
 * CRITICAL: This is the ONLY place the module is loaded
 */
async function loadRNIap(): Promise<boolean> {
  console.log('[StoreKit] ⚠️ BREADCRUMB: loadRNIap called');
  
  if (RNIap) {
    console.log('[StoreKit] Module already loaded');
    return true;
  }

  if (iapLoadInFlight) {
    console.log('[StoreKit] Module load already in progress, waiting...');
    return iapLoadInFlight;
  }

  if (iapLoadAttempted) {
    const elapsed = Date.now() - lastIapLoadFailureAt;
    if (elapsed < MODULE_RETRY_COOLDOWN) {
      console.log('[StoreKit] Module load recently failed, skipping retry (cooldown:', MODULE_RETRY_COOLDOWN - elapsed, 'ms remaining)');
      return false;
    }

    console.log('[StoreKit] Retrying module load after cooldown');
    iapLoadAttempted = false;
  }

  iapLoadAttempted = true;

  iapLoadInFlight = (async () => {
    try {
      console.log('[StoreKit] ⚠️ BREADCRUMB: About to dynamically import react-native-iap');
      console.log('[StoreKit] This is a TurboModule - monitoring for crash...');

      const loadPromise = import('react-native-iap');
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Module load timeout')), MODULE_LOAD_TIMEOUT)
      );

      RNIap = await Promise.race([loadPromise, timeoutPromise]);
      console.log('[StoreKit] ✅ Module loaded successfully');
      console.log('[StoreKit] Module type:', typeof RNIap);
      return true;
    } catch (error: any) {
      lastIapLoadFailureAt = Date.now();
      console.error('[StoreKit] ❌ Failed to load module');
      console.error('[StoreKit] Error:', error);
      console.error('[StoreKit] Error name:', error.name);
      console.error('[StoreKit] Error message:', error.message);
      return false;
    } finally {
      iapLoadInFlight = null;
    }
  })();

  return iapLoadInFlight;
}

async function ensureStoreKitReady(): Promise<any | null> {
  console.log('[StoreKit] ⚠️ BREADCRUMB: ensureStoreKitReady called');
  
  const loaded = await loadRNIap();
  if (!loaded) {
    console.error('[StoreKit] Module not loaded');
    return null;
  }

  if (!isInitialized) {
    console.log('[StoreKit] Module loaded but not initialized, initializing...');
    const initialized = await initializeStoreKit();
    if (!initialized) {
      console.error('[StoreKit] Initialization failed');
      return null;
    }
  }

  return getIapModule();
}

/**
 * Initialize StoreKit connection
 * CRITICAL: Only called when user opens subscription screen
 */
export async function initializeStoreKit(): Promise<boolean> {
  console.log('[StoreKit] ⚠️ BREADCRUMB: initializeStoreKit called');
  console.log('[StoreKit] Platform:', Platform.OS);
  
  if (Platform.OS !== 'ios') {
    console.log('[StoreKit] Not on iOS, skipping');
    return false;
  }

  if (isInitialized) {
    console.log('[StoreKit] Already initialized');
    return true;
  }

  try {
    // Load module first
    console.log('[StoreKit] ⚠️ BREADCRUMB: About to load RNIap module');
    const loaded = await loadRNIap();
    if (!loaded) {
      console.error('[StoreKit] Module not available');
      return false;
    }

    console.log('[StoreKit] ⚠️ BREADCRUMB: Initializing connection...');
    
    // CRITICAL: Aggressive timeout
    const iap = getIapModule();
    if (!iap?.initConnection) {
      console.error('[StoreKit] ❌ VALIDATION FAILED: initConnection is unavailable on loaded module');
      return false;
    }

    console.log('[StoreKit] ⚠️ NATIVE CALL IMMINENT: initConnection');
    const initPromise = iap.initConnection();
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Init timeout')), INIT_TIMEOUT)
    );
    
    await Promise.race([initPromise, timeoutPromise]);
    console.log('[StoreKit] ✅ NATIVE CALL SUCCESS: Connection initialized');
    
    // Clear pending transactions (non-blocking)
    if (iap.flushFailedPurchasesCachedAsPendingAndroid) {
      console.log('[StoreKit] Flushing failed purchases (Android)...');
      iap.flushFailedPurchasesCachedAsPendingAndroid().catch(() => {
        // Ignore errors
      });
    }
    
    isInitialized = true;
    console.log('[StoreKit] ✅ Initialization complete');
    return true;
  } catch (error: any) {
    console.error('[StoreKit] ❌ Initialization failed');
    console.error('[StoreKit] Error:', error);
    console.error('[StoreKit] Error name:', error.name);
    console.error('[StoreKit] Error message:', error.message);
    return false;
  }
}

/**
 * Get product information from App Store
 */
export async function getProductInfo(): Promise<{
  productId: string;
  price: string;
  localizedPrice: string;
  currency: string;
  title: string;
  description: string;
} | null> {
  console.log('[StoreKit] ⚠️ BREADCRUMB: getProductInfo called');
  
  if (Platform.OS !== 'ios') {
    console.log('[StoreKit] Not on iOS');
    return null;
  }

  try {
    console.log('[StoreKit] ⚠️ BREADCRUMB: Ensuring StoreKit ready...');
    const iap = await ensureStoreKitReady();
    if (!iap) {
      console.error('[StoreKit] StoreKit not ready');
      return null;
    }

    console.log('[StoreKit] ⚠️ BREADCRUMB: Fetching product info...');
    
    // CRITICAL: Aggressive timeout
    if (!iap?.getSubscriptions) {
      console.error('[StoreKit] ❌ VALIDATION FAILED: getSubscriptions is unavailable on loaded module');
      return null;
    }

    console.log('[StoreKit] ⚠️ NATIVE CALL IMMINENT: getSubscriptions');
    console.log('[StoreKit] Product IDs:', subscriptionSkus);
    const productsPromise = iap.getSubscriptions({ skus: subscriptionSkus as string[] });
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Product fetch timeout')), PRODUCT_FETCH_TIMEOUT)
    );
    
    const products = await Promise.race([productsPromise, timeoutPromise]);
    console.log('[StoreKit] ✅ NATIVE CALL SUCCESS: getSubscriptions returned', products.length, 'products');
    
    if (products.length === 0) {
      console.warn('[StoreKit] No products found');
      return null;
    }

    const product = products[0];
    console.log('[StoreKit] ✅ Product info received:', {
      productId: product.productId,
      price: product.price,
      localizedPrice: product.localizedPrice,
      currency: product.currency,
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
    console.error('[StoreKit] ❌ Product fetch failed');
    console.error('[StoreKit] Error:', error);
    console.error('[StoreKit] Error name:', error.name);
    console.error('[StoreKit] Error message:', error.message);
    return null;
  }
}

/**
 * Setup purchase listeners
 */
export async function setupPurchaseListeners(
  onPurchaseUpdate: (purchase: Purchase) => void,
  onPurchaseError: (error: PurchaseError) => void
): Promise<void> {
  console.log('[StoreKit] ⚠️ BREADCRUMB: setupPurchaseListeners called');
  
  if (Platform.OS !== 'ios') {
    return;
  }

  const iap = await ensureStoreKitReady();
  if (!iap) {
    console.error('[StoreKit] StoreKit not ready');
    return;
  }

  console.log('[StoreKit] Setting up purchase listeners');

  // Remove existing listeners
  removePurchaseListeners();
  
  if (!iap?.purchaseUpdatedListener || !iap?.purchaseErrorListener) {
    console.error('[StoreKit] ❌ VALIDATION FAILED: Purchase listeners are unavailable on loaded module');
    return;
  }

  console.log('[StoreKit] ⚠️ BREADCRUMB: Installing purchaseUpdatedListener');
  purchaseUpdateSubscription = iap.purchaseUpdatedListener((purchase: Purchase) => {
    console.log('[StoreKit] ⚠️ BREADCRUMB: Purchase updated callback triggered');
    console.log('[StoreKit] Transaction ID:', purchase.transactionId);
    onPurchaseUpdate(purchase);
  });

  console.log('[StoreKit] ⚠️ BREADCRUMB: Installing purchaseErrorListener');
  purchaseErrorSubscription = iap.purchaseErrorListener((error: PurchaseError) => {
    console.error('[StoreKit] ⚠️ BREADCRUMB: Purchase error callback triggered');
    console.error('[StoreKit] Error code:', error.code);
    console.error('[StoreKit] Error message:', error.message);
    onPurchaseError(error);
  });

  console.log('[StoreKit] ✅ Listeners setup complete');
}

/**
 * Remove purchase listeners
 */
export function removePurchaseListeners(): void {
  console.log('[StoreKit] ⚠️ BREADCRUMB: removePurchaseListeners called');

  if (purchaseUpdateSubscription) {
    console.log('[StoreKit] Removing purchase update listener');
    purchaseUpdateSubscription.remove();
    purchaseUpdateSubscription = null;
  }

  if (purchaseErrorSubscription) {
    console.log('[StoreKit] Removing purchase error listener');
    purchaseErrorSubscription.remove();
    purchaseErrorSubscription = null;
  }
  
  console.log('[StoreKit] ✅ Listeners removed');
}

/**
 * Purchase subscription
 */
export async function purchaseSubscription(): Promise<void> {
  console.log('[StoreKit] ⚠️ BREADCRUMB: purchaseSubscription called');
  
  if (Platform.OS !== 'ios') {
    throw new Error('Subscriptions are only available on iOS');
  }

  try {
    console.log('[StoreKit] ⚠️ BREADCRUMB: Ensuring StoreKit ready...');
    const iap = await ensureStoreKitReady();
    if (!iap) {
      throw new Error('StoreKit module not available');
    }

    console.log('[StoreKit] ⚠️ BREADCRUMB: Requesting subscription...');
    if (!iap?.requestSubscription) {
      throw new Error('requestSubscription is unavailable');
    }

    console.log('[StoreKit] ⚠️ NATIVE CALL IMMINENT: requestSubscription');
    console.log('[StoreKit] Product ID:', SUBSCRIPTION_PRODUCT_ID);
    await iap.requestSubscription({
      sku: SUBSCRIPTION_PRODUCT_ID,
    });

    console.log('[StoreKit] ✅ NATIVE CALL SUCCESS: Purchase request sent');
  } catch (error: any) {
    console.error('[StoreKit] ❌ Purchase error');
    console.error('[StoreKit] Error:', error);
    console.error('[StoreKit] Error code:', error.code);
    console.error('[StoreKit] Error message:', error.message);
    
    if (error.code === 'E_USER_CANCELLED') {
      throw new Error('Purchase cancelled');
    }
    
    throw new Error(error.message || 'Purchase failed');
  }
}

/**
 * Restore previous purchases
 */
export async function restorePurchases(): Promise<Purchase | null> {
  console.log('[StoreKit] ⚠️ BREADCRUMB: restorePurchases called');
  
  if (Platform.OS !== 'ios') {
    throw new Error('Restore is only available on iOS');
  }

  try {
    console.log('[StoreKit] ⚠️ BREADCRUMB: Ensuring StoreKit ready...');
    const iap = await ensureStoreKitReady();
    if (!iap) {
      throw new Error('StoreKit module not available');
    }

    console.log('[StoreKit] ⚠️ BREADCRUMB: Restoring purchases...');
    if (!iap?.getAvailablePurchases) {
      throw new Error('getAvailablePurchases is unavailable');
    }

    console.log('[StoreKit] ⚠️ NATIVE CALL IMMINENT: getAvailablePurchases');
    const purchases = await iap.getAvailablePurchases();
    console.log('[StoreKit] ✅ NATIVE CALL SUCCESS: Found', purchases.length, 'purchases');
    
    if (purchases.length === 0) {
      console.log('[StoreKit] No purchases to restore');
      return null;
    }

    const subscriptionPurchase = purchases.find(
      (p: Purchase) => p.productId === SUBSCRIPTION_PRODUCT_ID
    );

    if (!subscriptionPurchase) {
      console.log('[StoreKit] No subscription purchase found');
      return null;
    }

    console.log('[StoreKit] ✅ Found subscription to restore:', subscriptionPurchase.transactionId);
    return subscriptionPurchase;
  } catch (error: any) {
    console.error('[StoreKit] ❌ Restore error');
    console.error('[StoreKit] Error:', error);
    console.error('[StoreKit] Error message:', error.message);
    throw new Error(error.message || 'Restore failed');
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
  console.log('[StoreKit] ⚠️ BREADCRUMB: verifyReceiptWithBackend called');
  console.log('[StoreKit] Receipt length:', receipt?.length);
  console.log('[StoreKit] Is sandbox:', isSandbox);
  
  try {
    console.log('[StoreKit] ⚠️ BREADCRUMB: Sending receipt to backend for verification');

    const response = await authenticatedPost<{
      success: boolean;
      status: 'active' | 'inactive';
      expiresAt: string | null;
    }>('/api/subscription/verify', {
      receiptData: receipt,
      productId: SUBSCRIPTION_PRODUCT_ID,
      isSandbox,
    });

    console.log('[StoreKit] ✅ Receipt verified, status:', response.status);

    return {
      success: response.success,
      status: response.status,
      expiresAt: response.expiresAt || undefined,
    };
  } catch (error: any) {
    console.error('[StoreKit] ❌ Verification error');
    console.error('[StoreKit] Error:', error);
    console.error('[StoreKit] Error message:', error.message);
    return {
      success: false,
      error: error.message || 'Verification failed',
    };
  }
}

/**
 * Finish a transaction
 */
export async function finishTransaction(purchase: Purchase): Promise<void> {
  console.log('[StoreKit] ⚠️ BREADCRUMB: finishTransaction called');
  console.log('[StoreKit] Transaction ID:', purchase.transactionId);
  
  try {
    const iap = await ensureStoreKitReady();
    if (!iap) {
      console.error('[StoreKit] StoreKit not ready');
      return;
    }

    console.log('[StoreKit] ⚠️ BREADCRUMB: Finishing transaction...');
    if (!iap?.finishTransaction) {
      console.error('[StoreKit] ❌ VALIDATION FAILED: finishTransaction is unavailable');
      return;
    }

    console.log('[StoreKit] ⚠️ NATIVE CALL IMMINENT: finishTransaction');
    await iap.finishTransaction({
      purchase,
      isConsumable: false,
    });
    
    console.log('[StoreKit] ✅ NATIVE CALL SUCCESS: Transaction finished');
  } catch (error: any) {
    console.error('[StoreKit] ❌ Finish transaction error');
    console.error('[StoreKit] Error:', error);
    console.error('[StoreKit] Error message:', error.message);
  }
}

/**
 * Process a purchase
 */
export async function processPurchase(purchase: Purchase): Promise<{
  success: boolean;
  status?: 'active' | 'inactive';
  error?: string;
}> {
  console.log('[StoreKit] ⚠️ BREADCRUMB: processPurchase called');
  console.log('[StoreKit] Transaction ID:', purchase.transactionId);
  console.log('[StoreKit] Product ID:', purchase.productId);

  console.log('[StoreKit] ⚠️ BREADCRUMB: Getting verification receipt...');
  const receipt = await getVerificationReceipt(purchase);
  
  if (!receipt) {
    console.error('[StoreKit] ❌ VALIDATION FAILED: No receipt in purchase');
    return {
      success: false,
      error: 'No receipt received from App Store',
    };
  }

  console.log('[StoreKit] ✅ Receipt obtained, length:', receipt.length);

  // Verify receipt
  console.log('[StoreKit] ⚠️ BREADCRUMB: Verifying receipt with backend...');
  const verifyResult = await verifyReceiptWithBackend(receipt, __DEV__);

  if (!verifyResult.success) {
    console.error('[StoreKit] ❌ Verification failed:', verifyResult.error);
    return {
      success: false,
      error: verifyResult.error || 'Verification failed',
    };
  }

  console.log('[StoreKit] ✅ Verification successful');

  // Finish transaction
  console.log('[StoreKit] ⚠️ BREADCRUMB: Finishing transaction...');
  await finishTransaction(purchase);

  console.log('[StoreKit] ✅ Purchase processed successfully');
  
  return {
    success: true,
    status: verifyResult.status,
  };
}

/**
 * Complete restore flow
 */
export async function completeRestoreFlow(): Promise<{
  success: boolean;
  status?: 'active' | 'inactive';
  error?: string;
}> {
  console.log('[StoreKit] ⚠️ BREADCRUMB: completeRestoreFlow called');

  try {
    console.log('[StoreKit] ⚠️ BREADCRUMB: Restoring purchases...');
    const purchase = await restorePurchases();
    
    if (!purchase) {
      console.log('[StoreKit] No purchases to restore');
      return {
        success: false,
        error: 'No purchases to restore',
      };
    }

    console.log('[StoreKit] ⚠️ BREADCRUMB: Processing restored purchase...');
    const result = await processPurchase(purchase);
    return result;
  } catch (error: any) {
    console.error('[StoreKit] ❌ Restore flow error');
    console.error('[StoreKit] Error:', error);
    console.error('[StoreKit] Error message:', error.message);
    return {
      success: false,
      error: error.message || 'Restore failed',
    };
  }
}

/**
 * Clean up StoreKit connection
 */
export async function disconnectStoreKit(): Promise<void> {
  console.log('[StoreKit] ⚠️ BREADCRUMB: disconnectStoreKit called');
  
  try {
    const loaded = await loadRNIap();
    if (!loaded) {
      console.log('[StoreKit] Module not loaded, nothing to disconnect');
      return;
    }

    console.log('[StoreKit] Cleaning up connection');
    
    removePurchaseListeners();
    
    const iap = getIapModule();
    if (iap?.endConnection) {
      console.log('[StoreKit] ⚠️ NATIVE CALL IMMINENT: endConnection');
      await iap.endConnection();
      console.log('[StoreKit] ✅ NATIVE CALL SUCCESS: Connection closed');
    }
    
    isInitialized = false;
    
    console.log('[StoreKit] ✅ Cleanup complete');
  } catch (error: any) {
    console.error('[StoreKit] ❌ Cleanup error');
    console.error('[StoreKit] Error:', error);
    console.error('[StoreKit] Error message:', error.message);
  }
}

/**
 * Helper function to show subscription instructions
 */
export function showSubscriptionInstructions(): void {
  console.log('[StoreKit] ⚠️ BREADCRUMB: showSubscriptionInstructions called');
  
  Alert.alert(
    'How to Subscribe',
    'SeaTime Tracker uses native in-app purchases:\n\n' +
    '1. Tap "Subscribe Now" to see pricing in your local currency\n' +
    '2. Complete your purchase using Apple Pay or your Apple ID\n' +
    '3. Your subscription will be active immediately\n\n' +
    'Your subscription is managed through your Apple ID and will automatically renew each month.\n\n' +
    'You can manage or cancel your subscription anytime in:\nSettings → Apple ID → Subscriptions',
    [{ text: 'Got it' }]
  );
}

/**
 * COMPLIANCE: Open Apple subscription management page (3.1.2)
 * Opens https://apps.apple.com/account/subscriptions
 * Falls back to app-settings: if URL cannot be opened
 */
export async function openSubscriptionManagement(): Promise<void> {
  console.log('[StoreKit] ⚠️ BREADCRUMB: openSubscriptionManagement called');
  
  if (Platform.OS !== 'ios') {
    Alert.alert(
      'iOS Only',
      'Subscription management is only available on iOS devices.',
      [{ text: 'OK' }]
    );
    return;
  }

  try {
    console.log('[StoreKit] Opening Apple subscription management page');
    console.log('[StoreKit] URL:', APPLE_SUBSCRIPTION_URL);
    
    // COMPLIANCE: Try to open Apple's subscription management URL first
    console.log('[StoreKit] ⚠️ BREADCRUMB: Checking if URL can be opened...');
    const canOpenURL = await Linking.canOpenURL(APPLE_SUBSCRIPTION_URL);
    console.log('[StoreKit] Can open URL:', canOpenURL);
    
    if (canOpenURL) {
      console.log('[StoreKit] ⚠️ BREADCRUMB: Opening URL...');
      await Linking.openURL(APPLE_SUBSCRIPTION_URL);
      console.log('[StoreKit] ✅ Opened Apple subscription management');
      return;
    }
    
    // Fallback to app settings if URL cannot be opened
    console.log('[StoreKit] Cannot open URL, falling back to app settings');
    const settingsUrl = 'app-settings:';
    const canOpenSettings = await Linking.canOpenURL(settingsUrl);
    
    if (canOpenSettings) {
      console.log('[StoreKit] ⚠️ BREADCRUMB: Opening iOS Settings...');
      await Linking.openURL(settingsUrl);
      console.log('[StoreKit] ✅ Opened iOS Settings');
    } else {
      throw new Error('Cannot open Settings');
    }
  } catch (error: any) {
    console.error('[StoreKit] ❌ Error opening subscription management');
    console.error('[StoreKit] Error:', error);
    console.error('[StoreKit] Error message:', error.message);
    
    Alert.alert(
      'Manage Subscription',
      'To manage your subscription:\n\n1. Open Settings\n2. Tap your name at the top\n3. Tap "Subscriptions"\n4. Select "SeaTime Tracker"',
      [{ text: 'OK' }]
    );
  }
}

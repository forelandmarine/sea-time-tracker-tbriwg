
/**
 * StoreKit Integration for iOS In-App Purchases (NATIVE ONLY)
 * 
 * ✅ COMPLETELY REENGINEERED FOR STABILITY
 * ✅ LAZY LOADING - Module only loads when needed
 * ✅ AGGRESSIVE TIMEOUTS - Never blocks app startup
 * ✅ BULLETPROOF ERROR HANDLING - Graceful fallbacks everywhere
 * ✅ APPLE GUIDELINE 3.1.2 COMPLIANCE - Proper subscription management
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
  const iap = getIapModule();

  // Backend currently verifies via Apple's /verifyReceipt endpoint,
  // which expects the app receipt (base64), not transaction identifiers.
  if (Platform.OS === 'ios' && iap?.getReceiptIOS) {
    try {
      const appReceipt = await iap.getReceiptIOS();
      if (typeof appReceipt === 'string' && appReceipt.length > 0) {
        return appReceipt;
      }
    } catch (error: any) {
      console.warn('[StoreKit] Failed to get iOS app receipt, falling back to purchase token:', error?.message);
    }
  }

  return getPurchaseReceipt(purchase);
};

/**
 * Lazy load RNIap module
 * CRITICAL: This is the ONLY place the module is loaded
 */
async function loadRNIap(): Promise<boolean> {
  if (RNIap) {
    return true;
  }

  if (iapLoadInFlight) {
    return iapLoadInFlight;
  }

  if (iapLoadAttempted) {
    const elapsed = Date.now() - lastIapLoadFailureAt;
    if (elapsed < MODULE_RETRY_COOLDOWN) {
      console.log('[StoreKit] Module load recently failed, skipping retry');
      return false;
    }

    console.log('[StoreKit] Retrying module load after cooldown');
    iapLoadAttempted = false;
  }

  iapLoadAttempted = true;

  iapLoadInFlight = (async () => {
    try {
      console.log('[StoreKit] Loading react-native-iap module (lazy)...');

      const loadPromise = import('react-native-iap');
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Module load timeout')), MODULE_LOAD_TIMEOUT)
      );

      RNIap = await Promise.race([loadPromise, timeoutPromise]);
      console.log('[StoreKit] ✅ Module loaded successfully');
      return true;
    } catch (error: any) {
      lastIapLoadFailureAt = Date.now();
      console.error('[StoreKit] ❌ Failed to load module:', error.message);
      return false;
    } finally {
      iapLoadInFlight = null;
    }
  })();

  return iapLoadInFlight;
}

async function ensureStoreKitReady(): Promise<any | null> {
  const loaded = await loadRNIap();
  if (!loaded) {
    return null;
  }

  if (!isInitialized) {
    const initialized = await initializeStoreKit();
    if (!initialized) {
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
    const loaded = await loadRNIap();
    if (!loaded) {
      console.error('[StoreKit] Module not available');
      return false;
    }

    console.log('[StoreKit] Initializing connection...');
    
    // CRITICAL: Aggressive timeout
    const iap = getIapModule();
    if (!iap?.initConnection) {
      console.error('[StoreKit] initConnection is unavailable on loaded module');
      return false;
    }

    const initPromise = iap.initConnection();
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Init timeout')), INIT_TIMEOUT)
    );
    
    await Promise.race([initPromise, timeoutPromise]);
    console.log('[StoreKit] ✅ Connection initialized');
    
    // Clear pending transactions (non-blocking)
    iap.flushFailedPurchasesCachedAsPendingAndroid?.().catch(() => {
      // Ignore errors
    });
    
    isInitialized = true;
    return true;
  } catch (error: any) {
    console.error('[StoreKit] ❌ Initialization failed:', error.message);
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
  if (Platform.OS !== 'ios') {
    return null;
  }

  try {
    const iap = await ensureStoreKitReady();
    if (!iap) {
      return null;
    }

    console.log('[StoreKit] Fetching product info...');
    
    // CRITICAL: Aggressive timeout
    if (!iap?.getSubscriptions) {
      console.error('[StoreKit] getSubscriptions is unavailable on loaded module');
      return null;
    }

    const productsPromise = iap.getSubscriptions({ skus: subscriptionSkus as string[] });
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Product fetch timeout')), PRODUCT_FETCH_TIMEOUT)
    );
    
    const products = await Promise.race([productsPromise, timeoutPromise]);
    
    if (products.length === 0) {
      console.warn('[StoreKit] No products found');
      return null;
    }

    const product = products[0];
    console.log('[StoreKit] ✅ Product info received');

    return {
      productId: product.productId,
      price: product.price,
      localizedPrice: product.localizedPrice,
      currency: product.currency,
      title: product.title,
      description: product.description || 'Monthly subscription to SeaTime Tracker',
    };
  } catch (error: any) {
    console.error('[StoreKit] ❌ Product fetch failed:', error.message);
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
  if (Platform.OS !== 'ios') {
    return;
  }

  const iap = await ensureStoreKitReady();
  if (!iap) {
    return;
  }

  console.log('[StoreKit] Setting up purchase listeners');

  // Remove existing listeners
  removePurchaseListeners();
  if (!iap?.purchaseUpdatedListener || !iap?.purchaseErrorListener) {
    console.error('[StoreKit] Purchase listeners are unavailable on loaded module');
    return;
  }

  purchaseUpdateSubscription = iap.purchaseUpdatedListener((purchase: Purchase) => {
    console.log('[StoreKit] Purchase updated:', purchase.transactionId);
    onPurchaseUpdate(purchase);
  });

  purchaseErrorSubscription = iap.purchaseErrorListener((error: PurchaseError) => {
    console.error('[StoreKit] Purchase error:', error.code);
    onPurchaseError(error);
  });

  console.log('[StoreKit] ✅ Listeners setup complete');
}

/**
 * Remove purchase listeners
 */
export function removePurchaseListeners(): void {
  console.log('[StoreKit] Removing listeners');

  if (purchaseUpdateSubscription) {
    purchaseUpdateSubscription.remove();
    purchaseUpdateSubscription = null;
  }

  if (purchaseErrorSubscription) {
    purchaseErrorSubscription.remove();
    purchaseErrorSubscription = null;
  }
}

/**
 * Purchase subscription
 */
export async function purchaseSubscription(): Promise<void> {
  if (Platform.OS !== 'ios') {
    throw new Error('Subscriptions are only available on iOS');
  }

  try {
    const iap = await ensureStoreKitReady();
    if (!iap) {
      throw new Error('StoreKit module not available');
    }

    console.log('[StoreKit] Requesting subscription...');
    if (!iap?.requestSubscription) {
      throw new Error('requestSubscription is unavailable');
    }

    await iap.requestSubscription({
      sku: SUBSCRIPTION_PRODUCT_ID,
    });

    console.log('[StoreKit] Purchase request sent');
  } catch (error: any) {
    console.error('[StoreKit] Purchase error:', error.message);
    
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
  if (Platform.OS !== 'ios') {
    throw new Error('Restore is only available on iOS');
  }

  try {
    const iap = await ensureStoreKitReady();
    if (!iap) {
      throw new Error('StoreKit module not available');
    }

    console.log('[StoreKit] Restoring purchases...');
    if (!iap?.getAvailablePurchases) {
      throw new Error('getAvailablePurchases is unavailable');
    }

    const purchases = await iap.getAvailablePurchases();
    console.log('[StoreKit] Found purchases:', purchases.length);
    
    if (purchases.length === 0) {
      return null;
    }

    const subscriptionPurchase = purchases.find(
      (p: Purchase) => p.productId === SUBSCRIPTION_PRODUCT_ID
    );

    if (!subscriptionPurchase) {
      return null;
    }

    console.log('[StoreKit] ✅ Found subscription to restore');
    return subscriptionPurchase;
  } catch (error: any) {
    console.error('[StoreKit] Restore error:', error.message);
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
  try {
    console.log('[StoreKit] Verifying receipt with backend');

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
    console.error('[StoreKit] ❌ Verification error:', error.message);
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
  try {
    const iap = await ensureStoreKitReady();
    if (!iap) {
      return;
    }

    console.log('[StoreKit] Finishing transaction:', purchase.transactionId);
    if (!iap?.finishTransaction) {
      return;
    }

    await iap.finishTransaction({
      purchase,
      isConsumable: false,
    });
    
    console.log('[StoreKit] ✅ Transaction finished');
  } catch (error: any) {
    console.error('[StoreKit] ❌ Finish transaction error:', error.message);
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
  console.log('[StoreKit] Processing purchase:', purchase.transactionId);

  const receipt = await getVerificationReceipt(purchase);
  
  if (!receipt) {
    console.error('[StoreKit] No receipt in purchase');
    return {
      success: false,
      error: 'No receipt received from App Store',
    };
  }

  // Verify receipt
  const verifyResult = await verifyReceiptWithBackend(receipt, __DEV__);

  if (!verifyResult.success) {
    return {
      success: false,
      error: verifyResult.error || 'Verification failed',
    };
  }

  // Finish transaction
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
  console.log('[StoreKit] Starting restore flow');

  try {
    const purchase = await restorePurchases();
    
    if (!purchase) {
      return {
        success: false,
        error: 'No purchases to restore',
      };
    }

    const result = await processPurchase(purchase);
    return result;
  } catch (error: any) {
    console.error('[StoreKit] Restore flow error:', error.message);
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
  try {
    const loaded = await loadRNIap();
    if (!loaded) {
      return;
    }

    console.log('[StoreKit] Cleaning up connection');
    
    removePurchaseListeners();
    const iap = getIapModule();
    await iap?.endConnection?.();
    isInitialized = false;
    
    console.log('[StoreKit] ✅ Connection closed');
  } catch (error: any) {
    console.error('[StoreKit] ❌ Cleanup error:', error.message);
  }
}

/**
 * Helper function to show subscription instructions
 */
export function showSubscriptionInstructions(): void {
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

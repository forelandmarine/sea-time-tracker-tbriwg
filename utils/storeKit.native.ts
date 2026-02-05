
/**
 * StoreKit Integration for iOS In-App Purchases (NATIVE ONLY)
 * 
 * ✅ APPLE GUIDELINE 3.1.1 COMPLIANCE - NATIVE IN-APP PURCHASES
 * ✅ STOREKIT 2 BEST PRACTICES from RevenueCat Guide
 * 
 * This module handles iOS App Store subscriptions using react-native-iap.
 * This file is used ONLY on iOS/Android (via .native.ts extension).
 * 
 * Product ID: com.forelandmarine.seatime.monthly
 * App ID: 6758010893
 * 
 * IMPORTANT: This implements NATIVE in-app purchases to comply with Apple's
 * Guideline 3.1.1. Users can purchase subscriptions directly within the app
 * using the native iOS payment sheet (NOT external links).
 * 
 * Flow (Based on StoreKit 2 Best Practices):
 * 1. Initialize connection to App Store
 * 2. Fetch product information (price, currency, description)
 * 3. User taps "Subscribe" → Native iOS purchase sheet appears
 * 4. User completes purchase via StoreKit (Apple's native payment system)
 * 5. Purchase listener receives transaction automatically
 * 6. App sends receipt to backend for verification
 * 7. Backend verifies with Apple servers using APPLE_APP_SECRET
 * 8. Backend updates user subscription status
 * 9. App finishes transaction (CRITICAL - tells Apple we processed it)
 * 10. App checks subscription status and grants access
 * 
 * Performance Optimization:
 * - Initialization has 3-second timeout to prevent blocking
 * - Product fetch has 5-second timeout
 * - Purchase listeners handle async updates
 * - Does NOT block app authentication or navigation
 * 
 * Required Configuration:
 * - app.json: ios.entitlements["com.apple.developer.in-app-payments"] = []
 * - App Store Connect: Product configured with ID com.forelandmarine.seatime.monthly
 * - Backend: APPLE_APP_SECRET environment variable for receipt verification
 */

import { Platform, Alert, EmitterSubscription } from 'react-native';
import type { Product, Purchase, PurchaseError, SubscriptionPurchase } from 'react-native-iap';
import { authenticatedPost } from './api';

// Lazy import RNIap to prevent crashes if module is not available
let RNIap: any = null;

// Product ID configured in App Store Connect
export const SUBSCRIPTION_PRODUCT_ID = 'com.forelandmarine.seatime.monthly';

// Subscription SKUs
const subscriptionSkus = Platform.select({
  ios: [SUBSCRIPTION_PRODUCT_ID],
  android: [],
  default: [],
});

let isInitialized = false;
let purchaseUpdateSubscription: EmitterSubscription | null = null;
let purchaseErrorSubscription: EmitterSubscription | null = null;

/**
 * Lazy load RNIap module
 * This prevents crashes if the module is not available
 */
async function loadRNIap(): Promise<boolean> {
  if (RNIap) {
    return true;
  }

  try {
    console.log('[StoreKit] Loading react-native-iap module...');
    RNIap = await import('react-native-iap');
    console.log('[StoreKit] react-native-iap loaded successfully');
    return true;
  } catch (error: any) {
    console.error('[StoreKit] Failed to load react-native-iap:', error);
    return false;
  }
}

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
    // Load RNIap module first
    const loaded = await loadRNIap();
    if (!loaded) {
      console.error('[StoreKit] RNIap module not available');
      return false;
    }

    console.log('[StoreKit] Initializing connection to App Store');
    console.log('[StoreKit] Platform:', Platform.OS);
    console.log('[StoreKit] RNIap available:', typeof RNIap !== 'undefined');
    
    // Initialize connection with timeout - increased to 3 seconds
    const initPromise = RNIap.initConnection();
    const timeoutPromise = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error('StoreKit initialization timeout after 3 seconds')), 3000)
    );
    
    await Promise.race([initPromise, timeoutPromise]);
    console.log('[StoreKit] Connection initialized successfully');
    
    // Clear any pending transactions (non-blocking)
    // This is important for handling interrupted purchases
    RNIap.flushFailedPurchasesCachedAsPendingAndroid().catch((err: any) => {
      console.warn('[StoreKit] Failed to flush pending purchases:', err);
    });
    
    isInitialized = true;
    return true;
  } catch (error: any) {
    console.error('[StoreKit] Initialization error:', error);
    console.error('[StoreKit] Error details:', {
      message: error.message,
      code: error.code,
      name: error.name,
    });
    // Don't throw - allow app to continue without StoreKit
    return false;
  }
}

/**
 * Get product information from App Store
 * Fetches real-time pricing in user's local currency
 * 
 * Returns product details including:
 * - productId: The SKU identifier
 * - price: Numeric price value
 * - localizedPrice: Formatted price string (e.g., "$9.99")
 * - currency: Currency code (e.g., "USD")
 * - title: Product title from App Store Connect
 * - description: Product description from App Store Connect
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
    // Load RNIap module first
    const loaded = await loadRNIap();
    if (!loaded) {
      console.error('[StoreKit] RNIap module not available');
      return null;
    }

    console.log('[StoreKit] Fetching product info from App Store');
    console.log('[StoreKit] Product ID:', SUBSCRIPTION_PRODUCT_ID);
    
    if (!isInitialized) {
      console.log('[StoreKit] Not initialized, initializing now...');
      const initialized = await initializeStoreKit();
      if (!initialized) {
        console.warn('[StoreKit] Failed to initialize, cannot get product info');
        return null;
      }
    }

    console.log('[StoreKit] Calling RNIap.getSubscriptions with SKUs:', subscriptionSkus);
    
    // Fetch products with timeout - increased to 5 seconds
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
    });
    return null;
  }
}

/**
 * Setup purchase listeners
 * CRITICAL: Must be called before making purchases
 * Handles purchase updates and errors asynchronously
 * 
 * @param onPurchaseUpdate - Callback when purchase succeeds
 * @param onPurchaseError - Callback when purchase fails
 */
export async function setupPurchaseListeners(
  onPurchaseUpdate: (purchase: Purchase) => void,
  onPurchaseError: (error: PurchaseError) => void
): Promise<void> {
  if (Platform.OS !== 'ios') {
    console.log('[StoreKit] Not on iOS, skipping purchase listeners');
    return;
  }

  // Load RNIap module first
  const loaded = await loadRNIap();
  if (!loaded) {
    console.error('[StoreKit] RNIap module not available');
    return;
  }

  console.log('[StoreKit] Setting up purchase listeners');

  // Remove existing listeners if any
  removePurchaseListeners();

  // Listen for purchase updates
  purchaseUpdateSubscription = RNIap.purchaseUpdatedListener((purchase: Purchase) => {
    console.log('[StoreKit] Purchase updated:', {
      productId: purchase.productId,
      transactionId: purchase.transactionId,
      transactionDate: purchase.transactionDate,
    });
    onPurchaseUpdate(purchase);
  });

  // Listen for purchase errors
  purchaseErrorSubscription = RNIap.purchaseErrorListener((error: PurchaseError) => {
    console.error('[StoreKit] Purchase error:', {
      code: error.code,
      message: error.message,
    });
    onPurchaseError(error);
  });

  console.log('[StoreKit] Purchase listeners setup complete');
}

/**
 * Remove purchase listeners
 * IMPORTANT: Call this when component unmounts to prevent memory leaks
 */
export function removePurchaseListeners(): void {
  console.log('[StoreKit] Removing purchase listeners');

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
 * Purchase subscription using native StoreKit
 * This opens the native iOS purchase sheet
 * 
 * IMPORTANT: Setup purchase listeners BEFORE calling this function
 * The actual purchase result will come through the listener callbacks
 */
export async function purchaseSubscription(): Promise<void> {
  if (Platform.OS !== 'ios') {
    throw new Error('Subscriptions are only available on iOS');
  }

  try {
    // Load RNIap module first
    const loaded = await loadRNIap();
    if (!loaded) {
      throw new Error('StoreKit module not available');
    }

    console.log('[StoreKit] Starting subscription purchase');
    
    if (!isInitialized) {
      const initialized = await initializeStoreKit();
      if (!initialized) {
        throw new Error('Failed to initialize StoreKit');
      }
    }

    // Request the purchase - this opens the native iOS payment sheet
    // The result will come through purchaseUpdatedListener
    console.log('[StoreKit] Requesting subscription for product:', SUBSCRIPTION_PRODUCT_ID);
    await RNIap.requestSubscription({
      sku: SUBSCRIPTION_PRODUCT_ID,
    });

    console.log('[StoreKit] Purchase request sent, waiting for listener callback');
  } catch (error: any) {
    console.error('[StoreKit] Purchase error:', error);
    
    // Handle user cancellation gracefully
    if (error.code === 'E_USER_CANCELLED') {
      throw new Error('Purchase cancelled');
    }
    
    throw new Error(error.message || 'Purchase failed');
  }
}

/**
 * Restore previous purchases
 * Required by Apple for subscription apps
 * 
 * Returns the most recent subscription purchase if found
 */
export async function restorePurchases(): Promise<Purchase | null> {
  if (Platform.OS !== 'ios') {
    throw new Error('Restore is only available on iOS');
  }

  try {
    // Load RNIap module first
    const loaded = await loadRNIap();
    if (!loaded) {
      throw new Error('StoreKit module not available');
    }

    console.log('[StoreKit] Restoring purchases');
    
    if (!isInitialized) {
      const initialized = await initializeStoreKit();
      if (!initialized) {
        throw new Error('Failed to initialize StoreKit');
      }
    }

    const purchases = await RNIap.getAvailablePurchases();
    console.log('[StoreKit] Found purchases:', purchases.length);
    
    if (purchases.length === 0) {
      console.log('[StoreKit] No purchases to restore');
      return null;
    }

    // Find the subscription purchase
    const subscriptionPurchase = purchases.find(
      (p: Purchase) => p.productId === SUBSCRIPTION_PRODUCT_ID
    );

    if (!subscriptionPurchase) {
      console.log('[StoreKit] No subscription purchase found');
      return null;
    }

    console.log('[StoreKit] Found subscription to restore:', {
      transactionId: subscriptionPurchase.transactionId,
      productId: subscriptionPurchase.productId,
    });

    return subscriptionPurchase;
  } catch (error: any) {
    console.error('[StoreKit] Restore error:', error);
    throw new Error(error.message || 'Restore failed');
  }
}

/**
 * Verify receipt with backend
 * Sends the App Store receipt to backend for verification with Apple
 * 
 * @param receipt - Base64 encoded receipt from purchase
 * @param isSandbox - Whether to use sandbox environment (default: __DEV__)
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
 * Finish a transaction
 * CRITICAL: Must be called after successfully processing a purchase
 * This tells Apple that we've delivered the content and they can close the transaction
 * 
 * If you don't call this, the purchase will remain "pending" and Apple will
 * keep trying to deliver it, which can cause duplicate purchases
 */
export async function finishTransaction(purchase: Purchase): Promise<void> {
  try {
    // Load RNIap module first
    const loaded = await loadRNIap();
    if (!loaded) {
      console.error('[StoreKit] RNIap module not available');
      return;
    }

    console.log('[StoreKit] Finishing transaction:', purchase.transactionId);
    
    await RNIap.finishTransaction({
      purchase,
      isConsumable: false, // Subscriptions are NOT consumable
    });
    
    console.log('[StoreKit] Transaction finished successfully');
  } catch (error: any) {
    console.error('[StoreKit] Error finishing transaction:', error);
    // Don't throw - we still want to continue even if finish fails
  }
}

/**
 * Process a purchase
 * Complete flow: verify receipt + finish transaction
 * 
 * @param purchase - Purchase object from listener
 * @returns Verification result
 */
export async function processPurchase(purchase: Purchase): Promise<{
  success: boolean;
  status?: 'active' | 'inactive';
  error?: string;
}> {
  console.log('[StoreKit] Processing purchase:', purchase.transactionId);

  const receipt = purchase.transactionReceipt;
  
  if (!receipt) {
    console.error('[StoreKit] No receipt in purchase object');
    return {
      success: false,
      error: 'No receipt received from App Store',
    };
  }

  // Step 1: Verify receipt with backend
  const verifyResult = await verifyReceiptWithBackend(receipt, __DEV__);

  if (!verifyResult.success) {
    console.error('[StoreKit] Receipt verification failed:', verifyResult.error);
    return {
      success: false,
      error: verifyResult.error || 'Verification failed',
    };
  }

  // Step 2: Finish the transaction (tell Apple we processed it)
  await finishTransaction(purchase);

  console.log('[StoreKit] Purchase processed successfully');
  
  return {
    success: true,
    status: verifyResult.status,
  };
}

/**
 * Complete restore flow: restore + verify + finish
 */
export async function completeRestoreFlow(): Promise<{
  success: boolean;
  status?: 'active' | 'inactive';
  error?: string;
}> {
  console.log('[StoreKit] Starting complete restore flow');

  try {
    // Step 1: Restore purchases
    const purchase = await restorePurchases();
    
    if (!purchase) {
      return {
        success: false,
        error: 'No purchases to restore',
      };
    }

    // Step 2: Process the restored purchase
    const result = await processPurchase(purchase);
    
    return result;
  } catch (error: any) {
    console.error('[StoreKit] Restore flow error:', error);
    return {
      success: false,
      error: error.message || 'Restore failed',
    };
  }
}

/**
 * Clean up StoreKit connection
 * Call this when the app is closing or user logs out
 */
export async function disconnectStoreKit(): Promise<void> {
  try {
    // Load RNIap module first
    const loaded = await loadRNIap();
    if (!loaded) {
      console.error('[StoreKit] RNIap module not available');
      return;
    }

    console.log('[StoreKit] Cleaning up StoreKit connection');
    
    // Remove listeners first
    removePurchaseListeners();
    
    // End connection
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
    '1. Tap "Subscribe Now" to see pricing in your local currency\n' +
    '2. Complete your purchase using Apple Pay or your Apple ID\n' +
    '3. Your subscription will be active immediately\n\n' +
    'Your subscription is managed through your Apple ID and will automatically renew each month.\n\n' +
    'You can manage or cancel your subscription anytime in:\nSettings → Apple ID → Subscriptions',
    [{ text: 'Got it' }]
  );
}

/**
 * Open iOS Settings to manage subscriptions
 * This is required by Apple for subscription apps
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
    
    // Try to open iOS Settings app to Subscriptions
    const { Linking } = await import('react-native');
    const settingsUrl = 'app-settings:';
    const canOpen = await Linking.canOpenURL(settingsUrl);
    
    if (canOpen) {
      await Linking.openURL(settingsUrl);
      console.log('[StoreKit] Opened iOS Settings');
    } else {
      throw new Error('Cannot open Settings');
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

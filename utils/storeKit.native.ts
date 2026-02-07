
/**
 * StoreKit Integration for iOS In-App Purchases (NATIVE - DISABLED)
 * 
 * ✅ STABILIZED IMPLEMENTATION - Native IAP Disabled
 * ✅ USING APP STORE DEEP-LINK PATH - Cross-platform fallback
 * ✅ NO TURBOMODULE LINKAGE - Eliminates crash risk
 * 
 * This file is a stub that redirects to the web implementation.
 * Native IAP has been disabled to eliminate StoreKit TurboModule crashes.
 * 
 * The active path is: App Store deep-link + backend verification
 * 
 * See utils/storeKit.ts for the active implementation.
 */

// Re-export everything from the web implementation
export * from './storeKit';

console.log('[StoreKit.native] Native IAP disabled - using App Store deep-link path');
console.log('[StoreKit.native] This eliminates react-native-iap TurboModule linkage');

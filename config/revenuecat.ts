
import Constants from 'expo-constants';

/**
 * RevenueCat Configuration
 * 
 * IMPORTANT: Replace these placeholder values with your actual RevenueCat API keys
 * from the RevenueCat dashboard (https://app.revenuecat.com/)
 * 
 * iOS API Key: Found in RevenueCat Dashboard → Project Settings → API Keys
 * Android API Key: Found in RevenueCat Dashboard → Project Settings → API Keys
 * 
 * For security, these should be configured in app.json under extra.revenueCat
 */

export const REVENUECAT_CONFIG = {
  // iOS API Key (starts with "appl_")
  iosApiKey: Constants.expoConfig?.extra?.revenueCat?.iosApiKey || 'appl_YOUR_IOS_API_KEY_HERE',
  
  // Android API Key (starts with "goog_")
  androidApiKey: Constants.expoConfig?.extra?.revenueCat?.androidApiKey || 'goog_YOUR_ANDROID_API_KEY_HERE',
  
  // Entitlement identifier (configured in RevenueCat dashboard)
  entitlementId: 'premium',
  
  // Product identifiers (must match App Store Connect and RevenueCat)
  products: {
    monthly: 'seatime_monthly',
    annual: 'seatime_annual',
  },
};

/**
 * Validate RevenueCat configuration
 * Returns true if configuration is valid, false otherwise
 */
export function validateRevenueCatConfig(): boolean {
  const { iosApiKey, androidApiKey } = REVENUECAT_CONFIG;
  
  // Check if API keys are still placeholders
  if (iosApiKey.includes('YOUR_') || androidApiKey.includes('YOUR_')) {
    console.warn('[RevenueCat] API keys not configured. Please update config/revenuecat.ts or app.json');
    return false;
  }
  
  // Check if API keys have correct format
  if (!iosApiKey.startsWith('appl_')) {
    console.error('[RevenueCat] Invalid iOS API key format. Should start with "appl_"');
    return false;
  }
  
  if (!androidApiKey.startsWith('goog_')) {
    console.error('[RevenueCat] Invalid Android API key format. Should start with "goog_"');
    return false;
  }
  
  return true;
}

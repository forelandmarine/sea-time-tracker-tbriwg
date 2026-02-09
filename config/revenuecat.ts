
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
 * 
 * TESTING: Using REVENUECAT_TEST_API_KEY for subscription testing
 */

export const REVENUECAT_CONFIG = {
  // iOS API Key (starts with "appl_")
  iosApiKey: Constants.expoConfig?.extra?.revenueCat?.iosApiKey || 'REVENUECAT_TEST_API_KEY',
  
  // Android API Key (starts with "goog_")
  androidApiKey: Constants.expoConfig?.extra?.revenueCat?.androidApiKey || 'REVENUECAT_TEST_API_KEY',
  
  // Entitlement identifier (configured in RevenueCat dashboard)
  entitlementId: 'premium',
  
  // Product identifiers (must match App Store Connect and RevenueCat)
  // CRITICAL: This MUST match the product ID in App Store Connect
  products: {
    monthly: 'com.forelandmarine.seatime.monthly',
    annual: 'com.forelandmarine.seatime.annual',
  },
};

/**
 * Validate RevenueCat configuration
 * Returns true if configuration is valid, false otherwise
 */
export function validateRevenueCatConfig(): boolean {
  const { iosApiKey, androidApiKey } = REVENUECAT_CONFIG;
  
  // Check if API keys are still placeholders (but allow test key)
  if (iosApiKey.includes('YOUR_') || androidApiKey.includes('YOUR_')) {
    console.warn('[RevenueCat] API keys not configured. Please update config/revenuecat.ts or app.json');
    return false;
  }
  
  // Allow test API key for testing
  if (iosApiKey === 'REVENUECAT_TEST_API_KEY' || androidApiKey === 'REVENUECAT_TEST_API_KEY') {
    console.log('[RevenueCat] Using test API key for subscription testing');
    return true;
  }
  
  // Check if API keys have correct format for production
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

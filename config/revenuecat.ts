
import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * RevenueCat Configuration
 * 
 * STANDARD REVENUECAT SETUP FOR EXPO
 * 
 * This configuration reads API keys from app.json extra config.
 * 
 * SETUP INSTRUCTIONS:
 * 1. Get your API keys from https://app.revenuecat.com/
 *    - iOS: Starts with "appl_" (or "sk_"/"pk_" for test keys)
 *    - Android: Starts with "goog_" (or "sk_"/"pk_" for test keys)
 * 
 * 2. Update app.json with your API key:
 *    "extra": {
 *      "revenueCat": {
 *        "iosApiKey": "test_gKMHKEpYSkTiLUtgKWHRbAXGcGd",
 *        "androidApiKey": "test_gKMHKEpYSkTiLUtgKWHRbAXGcGd"
 *      }
 *    }
 * 
 * 3. Add the plugin to app.json:
 *    "plugins": [
 *      ["./plugins/with-revenuecat", {
 *        "iosApiKey": "test_gKMHKEpYSkTiLUtgKWHRbAXGcGd",
 *        "androidApiKey": "test_gKMHKEpYSkTiLUtgKWHRbAXGcGd"
 *      }]
 *    ]
 * 
 * 4. Run: npx expo prebuild --clean
 * 5. Restart: npx expo start --clear
 */

// Product IDs - Update these to match your RevenueCat product configuration
export const PRODUCT_IDS = {
  MONTHLY: 'monthly', // Your monthly subscription product ID
};

// Entitlement identifier - This is what you check to see if user has access
export const ENTITLEMENT_ID = 'SeaTime Tracker Pro';

/**
 * Get RevenueCat API keys from app.json configuration
 */
function getApiKey(platform: 'ios' | 'android'): string {
  const extra = Constants.expoConfig?.extra;
  const revenueCatConfig = extra?.revenueCat;

  if (!revenueCatConfig || typeof revenueCatConfig !== 'object') {
    console.error('[RevenueCat Config] No revenueCat configuration found in app.json extra');
    return '';
  }

  const key = platform === 'ios' ? revenueCatConfig.iosApiKey : revenueCatConfig.androidApiKey;
  
  if (!key || typeof key !== 'string') {
    console.error(`[RevenueCat Config] No ${platform} API key found in configuration`);
    return '';
  }

  return key;
}

export const API_KEY_IOS = getApiKey('ios');
export const API_KEY_ANDROID = getApiKey('android');

// Get the appropriate API key for the current platform
export const REVENUECAT_API_KEY = Platform.select({
  ios: API_KEY_IOS,
  android: API_KEY_ANDROID,
  default: API_KEY_IOS,
}) || '';

/**
 * Validate RevenueCat configuration
 * Returns true if configuration is valid
 */
export function validateRevenueCatConfig(): boolean {
  const iosKey = API_KEY_IOS;
  const androidKey = API_KEY_ANDROID;

  console.log('[RevenueCat Config] Validating configuration');
  console.log('[RevenueCat Config] Platform:', Platform.OS);
  console.log('[RevenueCat Config] iOS Key Present:', !!iosKey);
  console.log('[RevenueCat Config] Android Key Present:', !!androidKey);
  console.log('[RevenueCat Config] iOS Key Length:', iosKey?.length || 0);
  console.log('[RevenueCat Config] Android Key Length:', androidKey?.length || 0);

  // Check if keys are set
  if (!iosKey || !androidKey) {
    console.error('[RevenueCat Config] API keys are missing');
    return false;
  }

  // Check if keys are placeholders
  if (iosKey.includes('YOUR_') || androidKey.includes('YOUR_')) {
    console.error('[RevenueCat Config] API keys are still placeholders');
    return false;
  }

  // Validate key format (more lenient for test keys)
  const iosValid = iosKey.startsWith('appl_') || iosKey.startsWith('sk_') || iosKey.startsWith('pk_') || iosKey.startsWith('test_');
  const androidValid = androidKey.startsWith('goog_') || androidKey.startsWith('sk_') || androidKey.startsWith('pk_') || androidKey.startsWith('test_');

  if (!iosValid) {
    console.warn('[RevenueCat Config] iOS API key format may be invalid:', iosKey.substring(0, 10) + '...');
  }

  if (!androidValid) {
    console.warn('[RevenueCat Config] Android API key format may be invalid:', androidKey.substring(0, 10) + '...');
  }

  const isValid = iosValid && androidValid;
  console.log('[RevenueCat Config] Configuration valid:', isValid);

  return isValid;
}

/**
 * Get diagnostic information about RevenueCat configuration
 */
export function getRevenueCatDiagnostics() {
  const iosKey = API_KEY_IOS;
  const androidKey = API_KEY_ANDROID;
  
  return {
    platform: Platform.OS,
    iosKey: {
      configured: !!iosKey && iosKey.length > 0,
      validFormat: iosKey?.startsWith('appl_') || iosKey?.startsWith('sk_') || iosKey?.startsWith('pk_') || iosKey?.startsWith('test_'),
      isPlaceholder: iosKey?.includes('YOUR_') || false,
      prefix: iosKey ? iosKey.substring(0, 15) : 'NOT SET',
      length: iosKey ? iosKey.length : 0,
    },
    androidKey: {
      configured: !!androidKey && androidKey.length > 0,
      validFormat: androidKey?.startsWith('goog_') || androidKey?.startsWith('sk_') || androidKey?.startsWith('pk_') || androidKey?.startsWith('test_'),
      isPlaceholder: androidKey?.includes('YOUR_') || false,
      prefix: androidKey ? androidKey.substring(0, 15) : 'NOT SET',
      length: androidKey ? androidKey.length : 0,
    },
  };
}

/**
 * Get detailed validation status for diagnostic screens
 */
export function getRevenueCatValidationStatus() {
  const diagnostics = getRevenueCatDiagnostics();
  const plugins = Constants.expoConfig?.plugins;
  const extra = Constants.expoConfig?.extra;

  const hasPlugin = Array.isArray(plugins) && plugins.some((p: any) => 
    Array.isArray(p) && p[0] === './plugins/with-revenuecat'
  );

  const hasExtra = !!extra?.revenueCat;

  return {
    pluginInAppJson: hasPlugin,
    extraConfigInAppJson: hasExtra,
    iosApiKeyConfigured: diagnostics.iosKey.configured,
    androidApiKeyConfigured: diagnostics.androidKey.configured,
    iosKeyLength: diagnostics.iosKey.length,
    androidKeyLength: diagnostics.androidKey.length,
    iosKeyValidFormat: diagnostics.iosKey.validFormat,
    androidKeyValidFormat: diagnostics.androidKey.validFormat,
    isTestKey: diagnostics.iosKey.prefix.startsWith('test_') || diagnostics.iosKey.prefix.startsWith('sk_') || diagnostics.iosKey.prefix.startsWith('pk_'),
    isProductionKey: diagnostics.iosKey.prefix.startsWith('appl_') || diagnostics.androidKey.prefix.startsWith('goog_'),
  };
}

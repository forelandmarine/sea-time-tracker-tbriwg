
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
 *    - iOS: Starts with "appl_" (or "test_" for test keys)
 *    - Android: Starts with "goog_" (or "test_" for test keys)
 * 
 * 2. Update app.json with your API key in TWO places:
 *    
 *    A. In the "plugins" array:
 *    "plugins": [
 *      ["./plugins/with-revenuecat", {
 *        "iosApiKey": "test_gKMHKEpYSkTiLUtgKWHRbAXGcGd",
 *        "androidApiKey": "test_gKMHKEpYSkTiLUtgKWHRbAXGcGd"
 *      }]
 *    ]
 *    
 *    B. In the "extra" section:
 *    "extra": {
 *      "revenueCat": {
 *        "iosApiKey": "test_gKMHKEpYSkTiLUtgKWHRbAXGcGd",
 *        "androidApiKey": "test_gKMHKEpYSkTiLUtgKWHRbAXGcGd"
 *      }
 *    }
 * 
 * 3. Run: npx expo prebuild --clean (for native builds)
 * 4. Restart: npx expo start --clear
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
  try {
    const extra = Constants.expoConfig?.extra;
    
    console.log('[RevenueCat Config] Reading configuration from app.json');
    console.log('[RevenueCat Config] Extra config present:', !!extra);
    
    if (!extra) {
      console.error('[RevenueCat Config] No extra configuration found in app.json');
      return '';
    }

    const revenueCatConfig = extra.revenueCat;
    
    console.log('[RevenueCat Config] RevenueCat config present:', !!revenueCatConfig);
    
    if (!revenueCatConfig || typeof revenueCatConfig !== 'object') {
      console.error('[RevenueCat Config] No revenueCat configuration found in app.json extra');
      console.error('[RevenueCat Config] Please add the following to app.json:');
      console.error('[RevenueCat Config] "extra": { "revenueCat": { "iosApiKey": "...", "androidApiKey": "..." } }');
      return '';
    }

    const key = platform === 'ios' ? revenueCatConfig.iosApiKey : revenueCatConfig.androidApiKey;
    
    if (!key || typeof key !== 'string') {
      console.error(`[RevenueCat Config] No ${platform} API key found in configuration`);
      return '';
    }

    console.log(`[RevenueCat Config] ${platform} API key found:`, key.substring(0, 15) + '...');
    return key;
  } catch (error) {
    console.error('[RevenueCat Config] Error reading configuration:', error);
    return '';
  }
}

export const API_KEY_IOS = getApiKey('ios');
export const API_KEY_ANDROID = getApiKey('android');

// Get the appropriate API key for the current platform
export const REVENUECAT_API_KEY = Platform.select({
  ios: API_KEY_IOS,
  android: API_KEY_ANDROID,
  default: API_KEY_IOS,
}) || '';

// Export as REVENUECAT_CONFIG for backward compatibility
export const REVENUECAT_CONFIG = {
  iosApiKey: API_KEY_IOS,
  androidApiKey: API_KEY_ANDROID,
  entitlementID: ENTITLEMENT_ID,
  productIDs: PRODUCT_IDS,
  isValid: false, // Will be set by validateRevenueCatConfig
  diagnosticMessage: '', // Will be set by validateRevenueCatConfig
};

/**
 * Validate RevenueCat configuration
 * Returns true if configuration is valid
 */
export function validateRevenueCatConfig(): boolean {
  const iosKey = API_KEY_IOS;
  const androidKey = API_KEY_ANDROID;

  console.log('[RevenueCat Config] ========== VALIDATION STARTED ==========');
  console.log('[RevenueCat Config] Platform:', Platform.OS);
  console.log('[RevenueCat Config] iOS Key Present:', !!iosKey);
  console.log('[RevenueCat Config] Android Key Present:', !!androidKey);
  console.log('[RevenueCat Config] iOS Key Length:', iosKey?.length || 0);
  console.log('[RevenueCat Config] Android Key Length:', androidKey?.length || 0);

  // Check if keys are set
  if (!iosKey || !androidKey) {
    const message = 'API keys are missing from app.json. Please add revenueCat configuration to app.json extra section.';
    console.error('[RevenueCat Config]', message);
    REVENUECAT_CONFIG.isValid = false;
    REVENUECAT_CONFIG.diagnosticMessage = message;
    return false;
  }

  // Check if keys are placeholders
  if (iosKey.includes('YOUR_') || androidKey.includes('YOUR_')) {
    const message = 'API keys are still placeholders. Please replace with actual keys from RevenueCat dashboard.';
    console.error('[RevenueCat Config]', message);
    REVENUECAT_CONFIG.isValid = false;
    REVENUECAT_CONFIG.diagnosticMessage = message;
    return false;
  }

  // Validate key format (more lenient for test keys)
  const iosValid = iosKey.startsWith('appl_') || iosKey.startsWith('sk_') || iosKey.startsWith('pk_') || iosKey.startsWith('test_');
  const androidValid = androidKey.startsWith('goog_') || androidKey.startsWith('sk_') || androidKey.startsWith('pk_') || androidKey.startsWith('test_');

  if (!iosValid) {
    console.warn('[RevenueCat Config] iOS API key format may be invalid:', iosKey.substring(0, 10) + '...');
    console.warn('[RevenueCat Config] Expected format: appl_*, test_*, sk_*, or pk_*');
  }

  if (!androidValid) {
    console.warn('[RevenueCat Config] Android API key format may be invalid:', androidKey.substring(0, 10) + '...');
    console.warn('[RevenueCat Config] Expected format: goog_*, test_*, sk_*, or pk_*');
  }

  const isValid = iosValid && androidValid;
  
  if (isValid) {
    REVENUECAT_CONFIG.isValid = true;
    REVENUECAT_CONFIG.diagnosticMessage = 'Configuration is valid';
    console.log('[RevenueCat Config] ✅ Configuration is VALID');
  } else {
    REVENUECAT_CONFIG.isValid = false;
    REVENUECAT_CONFIG.diagnosticMessage = 'API key format is invalid. Check that keys start with correct prefix.';
    console.error('[RevenueCat Config] ❌ Configuration is INVALID');
  }
  
  console.log('[RevenueCat Config] ========== VALIDATION COMPLETE ==========');

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

  const hasPlugin = Array.isArray(plugins) && plugins.some((p: any) => {
    if (Array.isArray(p)) {
      return p[0] === './plugins/with-revenuecat';
    }
    return false;
  });

  const hasExtra = !!extra?.revenueCat;

  console.log('[RevenueCat Config] Validation Status:');
  console.log('[RevenueCat Config] - Plugin in app.json:', hasPlugin);
  console.log('[RevenueCat Config] - Extra config in app.json:', hasExtra);
  console.log('[RevenueCat Config] - iOS key configured:', diagnostics.iosKey.configured);
  console.log('[RevenueCat Config] - Android key configured:', diagnostics.androidKey.configured);

  return {
    pluginInAppJson: hasPlugin,
    extraConfigInAppJson: hasExtra,
    iosApiKeyConfigured: diagnostics.iosKey.configured,
    androidApiKeyConfigured: diagnostics.androidKey.configured,
    iosKeyLength: diagnostics.iosKey.length,
    androidKeyLength: diagnostics.androidKey.length,
    iosKeyValidFormat: diagnostics.iosKey.validFormat,
    androidKeyValidFormat: diagnostics.androidKey.validFormat,
    iosKeyPrefix: diagnostics.iosKey.prefix,
    androidKeyPrefix: diagnostics.androidKey.prefix,
    isTestKey: diagnostics.iosKey.prefix.startsWith('test_') || diagnostics.iosKey.prefix.startsWith('sk_') || diagnostics.iosKey.prefix.startsWith('pk_'),
    isProductionKey: diagnostics.iosKey.prefix.startsWith('appl_') || diagnostics.androidKey.prefix.startsWith('goog_'),
  };
}

// Run validation on module load
validateRevenueCatConfig();


import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * RevenueCat Configuration
 * 
 * This configuration reads API keys from app.json extra config.
 * For sandbox testing, the REVENUECAT_TEST_API_KEY environment variable is used.
 * 
 * HOW TO USE SANDBOX TESTING:
 * 1. Set REVENUECAT_TEST_API_KEY as a secret in your environment
 * 2. The key will be automatically loaded from the environment
 * 3. Run: npx expo prebuild --clean
 * 4. Restart the app: npx expo start --clear
 * 
 * For production:
 * 1. Go to https://app.revenuecat.com/
 * 2. Navigate to Project Settings → API Keys
 * 3. Copy your iOS API key (starts with "appl_")
 * 4. Copy your Android API key (starts with "goog_")
 * 5. Update app.json with your real API keys
 * 6. Run: npx expo prebuild --clean
 * 7. Restart the app: npx expo start --clear
 */

export const REVENUECAT_PRODUCT_ID = 'com.forelandmarine.seatime.monthly';

/**
 * Get RevenueCat configuration from app.json
 */
export function getRevenueCatConfig() {
  const extra = Constants.expoConfig?.extra;
  const revenueCatConfig = extra?.revenueCat;

  const iosApiKey = revenueCatConfig?.iosApiKey || '';
  const androidApiKey = revenueCatConfig?.androidApiKey || '';

  console.log('[RevenueCat Config] Platform:', Platform.OS);
  console.log('[RevenueCat Config] iOS Key Present:', !!iosApiKey);
  console.log('[RevenueCat Config] Android Key Present:', !!androidApiKey);
  console.log('[RevenueCat Config] iOS Key Length:', iosApiKey.length);
  console.log('[RevenueCat Config] Android Key Length:', androidApiKey.length);

  return { iosApiKey, androidApiKey };
}

/**
 * Validate RevenueCat configuration
 * Returns detailed status object
 */
export function validateRevenueCatConfig() {
  const { iosApiKey, androidApiKey } = getRevenueCatConfig();
  const plugins = Constants.expoConfig?.plugins;

  const status = {
    pluginInAppJson: false,
    extraConfigInAppJson: false,
    iosApiKeyConfigured: false,
    androidApiKeyConfigured: false,
    iosKeyLength: 0,
    androidKeyLength: 0,
    iosKeyValidFormat: false,
    androidKeyValidFormat: false,
    isTestKey: false,
    isProductionKey: false,
    pluginIosApiKey: 'NOT SET',
    pluginAndroidApiKey: 'NOT SET',
  };

  // Check for plugin presence and extract keys from plugin config
  if (Array.isArray(plugins)) {
    const rcPlugin = plugins.find(p => Array.isArray(p) && p[0] === './plugins/with-revenuecat');
    if (rcPlugin && typeof rcPlugin[1] === 'object') {
      status.pluginInAppJson = true;
      status.pluginIosApiKey = rcPlugin[1].iosApiKey || 'NOT SET';
      status.pluginAndroidApiKey = rcPlugin[1].androidApiKey || 'NOT SET';
      console.log('[RevenueCat Validation] Plugin found in app.json');
      console.log('[RevenueCat Validation] Plugin iOS Key:', status.pluginIosApiKey);
      console.log('[RevenueCat Validation] Plugin Android Key:', status.pluginAndroidApiKey);
    } else {
      console.warn('[RevenueCat Validation] Plugin NOT found in app.json');
    }
  }

  // Check for extra config presence
  if (Constants.expoConfig?.extra?.revenueCat) {
    status.extraConfigInAppJson = true;
    console.log('[RevenueCat Validation] Extra config found in app.json');
  } else {
    console.warn('[RevenueCat Validation] Extra config NOT found in app.json');
  }

  // Validate iOS Key
  if (iosApiKey && iosApiKey !== '$(REVENUECAT_TEST_API_KEY)' && iosApiKey !== 'appl_YOUR_IOS_API_KEY_HERE') {
    status.iosApiKeyConfigured = true;
    status.iosKeyLength = iosApiKey.length;
    status.iosKeyValidFormat = iosApiKey.startsWith('appl_') || iosApiKey.startsWith('sk_') || iosApiKey.startsWith('pk_');
    console.log('[RevenueCat Validation] iOS Key configured:', status.iosKeyValidFormat ? '✅' : '⚠️');
  } else {
    console.warn('[RevenueCat Validation] iOS Key NOT configured or still using placeholder');
  }

  // Validate Android Key
  if (androidApiKey && androidApiKey !== '$(REVENUECAT_TEST_API_KEY)' && androidApiKey !== 'goog_YOUR_ANDROID_API_KEY_HERE') {
    status.androidApiKeyConfigured = true;
    status.androidKeyLength = androidApiKey.length;
    status.androidKeyValidFormat = androidApiKey.startsWith('goog_') || androidApiKey.startsWith('sk_') || androidApiKey.startsWith('pk_');
    console.log('[RevenueCat Validation] Android Key configured:', status.androidKeyValidFormat ? '✅' : '⚠️');
  } else {
    console.warn('[RevenueCat Validation] Android Key NOT configured or still using placeholder');
  }

  // Determine if using test or production keys (simplified check)
  if (status.iosApiKeyConfigured && (iosApiKey.startsWith('sk_') || iosApiKey.startsWith('pk_'))) {
    status.isTestKey = true;
    console.log('[RevenueCat Validation] Using TEST/SANDBOX key');
  } else if (status.iosApiKeyConfigured && iosApiKey.startsWith('appl_')) {
    status.isProductionKey = true;
    console.log('[RevenueCat Validation] Using PRODUCTION key');
  }

  return status;
}

/**
 * Get diagnostic information about RevenueCat configuration
 */
export function getRevenueCatDiagnostics() {
  const { iosApiKey, androidApiKey } = getRevenueCatConfig();
  
  return {
    iosKey: {
      configured: !!iosApiKey && iosApiKey.length > 0,
      validFormat: iosApiKey.startsWith('appl_') || iosApiKey.startsWith('sk_') || iosApiKey.startsWith('pk_'),
      isPlaceholder: iosApiKey.includes('$(') || iosApiKey.includes('YOUR_'),
      prefix: iosApiKey ? iosApiKey.substring(0, 15) : 'NOT SET',
      length: iosApiKey ? iosApiKey.length : 0,
    },
    androidKey: {
      configured: !!androidApiKey && androidApiKey.length > 0,
      validFormat: androidApiKey.startsWith('goog_') || androidApiKey.startsWith('sk_') || androidApiKey.startsWith('pk_'),
      isPlaceholder: androidApiKey.includes('$(') || androidApiKey.includes('YOUR_'),
      prefix: androidApiKey ? androidApiKey.substring(0, 15) : 'NOT SET',
      length: androidApiKey ? androidApiKey.length : 0,
    },
  };
}

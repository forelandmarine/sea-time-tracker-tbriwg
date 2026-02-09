
import Constants from 'expo-constants';

/**
 * RevenueCat Configuration
 * 
 * This configuration reads API keys from app.json extra config.
 * For sandbox testing, the REVENUECAT_TEST_API_KEY environment variable is used.
 * 
 * HOW TO USE SANDBOX TESTING:
 * 1. Set REVENUECAT_TEST_API_KEY as a secret in your environment
 * 2. The key will be automatically loaded from the environment
 * 3. Restart the app: npx expo start --clear
 * 
 * For production:
 * 1. Go to https://app.revenuecat.com/
 * 2. Navigate to Project Settings → API Keys
 * 3. Copy your iOS API key (starts with "appl_")
 * 4. Copy your Android API key (starts with "goog_")
 * 5. Update app.json with your real API keys
 * 6. Restart the app: npx expo start --clear
 */

export const REVENUECAT_CONFIG = {
  // iOS API Key - reads from app.json extra.revenueCat.iosApiKey
  iosApiKey: Constants.expoConfig?.extra?.revenueCat?.iosApiKey || '',
  
  // Android API Key - reads from app.json extra.revenueCat.androidApiKey
  androidApiKey: Constants.expoConfig?.extra?.revenueCat?.androidApiKey || '',
  
  // Entitlement identifier (configured in RevenueCat dashboard)
  entitlementId: 'premium',
  
  // Product identifiers (must match App Store Connect and RevenueCat)
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
  
  console.log('[RevenueCat Config] Validating configuration');
  console.log('[RevenueCat Config] iOS Key:', iosApiKey ? `${iosApiKey.substring(0, 15)}...` : 'NOT SET');
  console.log('[RevenueCat Config] Android Key:', androidApiKey ? `${androidApiKey.substring(0, 15)}...` : 'NOT SET');
  
  // Check if API keys are empty
  if (!iosApiKey || !androidApiKey) {
    console.error('❌ [RevenueCat] API keys not configured!');
    console.error('   Please set REVENUECAT_TEST_API_KEY environment variable or update app.json');
    return false;
  }
  
  // Check if still using placeholder syntax
  if (iosApiKey.includes('$(') || androidApiKey.includes('$(')) {
    console.error('❌ [RevenueCat] API keys contain placeholder syntax!');
    console.error('   The environment variable was not expanded. Please check your build configuration.');
    return false;
  }
  
  // For sandbox testing, keys might not follow production format
  // So we'll be more lenient with validation
  console.log('✅ [RevenueCat] Configuration loaded successfully');
  console.log('   Note: Using sandbox/test API key for testing');
  return true;
}

/**
 * Get diagnostic information about RevenueCat configuration
 */
export function getRevenueCatDiagnostics() {
  const { iosApiKey, androidApiKey } = REVENUECAT_CONFIG;
  
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


import Constants from 'expo-constants';

/**
 * RevenueCat Configuration
 * 
 * ⚠️ IMPORTANT: You MUST replace the placeholder API keys with your actual RevenueCat API keys
 * from the RevenueCat dashboard (https://app.revenuecat.com/)
 * 
 * HOW TO GET YOUR API KEYS:
 * 1. Go to https://app.revenuecat.com/
 * 2. Sign in to your account
 * 3. Navigate to Project Settings → API Keys
 * 4. Copy your iOS API key (starts with "appl_")
 * 5. Copy your Android API key (starts with "goog_")
 * 6. Update app.json with your real API keys in TWO places:
 *    - plugins array: ["./plugins/with-revenuecat", { "iosApiKey": "appl_...", "androidApiKey": "goog_..." }]
 *    - extra.revenueCat: { "iosApiKey": "appl_...", "androidApiKey": "goog_..." }
 * 7. Restart the app: npx expo start --clear
 * 
 * For detailed instructions, see: REVENUECAT_SETUP_INSTRUCTIONS.md
 */

export const REVENUECAT_CONFIG = {
  // iOS API Key (starts with "appl_")
  iosApiKey: Constants.expoConfig?.extra?.revenueCat?.iosApiKey || 'appl_YOUR_IOS_API_KEY_HERE',
  
  // Android API Key (starts with "goog_")
  androidApiKey: Constants.expoConfig?.extra?.revenueCat?.androidApiKey || 'goog_YOUR_ANDROID_API_KEY_HERE',
  
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
  
  // Check if API keys are still placeholders
  if (iosApiKey.includes('YOUR_') || androidApiKey.includes('YOUR_')) {
    console.error('❌ [RevenueCat] API keys not configured!');
    console.error('   Please update app.json with your real RevenueCat API keys.');
    console.error('   See REVENUECAT_SETUP_INSTRUCTIONS.md for detailed steps.');
    return false;
  }
  
  // Check if using test/placeholder keys
  if (iosApiKey === 'REVENUECAT_TEST_API_KEY' || androidApiKey === 'REVENUECAT_TEST_API_KEY') {
    console.error('❌ [RevenueCat] Using placeholder test API key!');
    console.error('   "REVENUECAT_TEST_API_KEY" is not a valid RevenueCat API key.');
    console.error('   Please replace with your actual API key from RevenueCat Dashboard.');
    console.error('   Go to: https://app.revenuecat.com/ → Project Settings → API Keys');
    return false;
  }
  
  // Check if API keys have correct format for production
  if (!iosApiKey.startsWith('appl_')) {
    console.error('❌ [RevenueCat] Invalid iOS API key format!');
    console.error(`   Current key: ${iosApiKey.substring(0, 20)}...`);
    console.error('   iOS API keys should start with "appl_"');
    console.error('   Get your key from: https://app.revenuecat.com/ → Project Settings → API Keys');
    return false;
  }
  
  if (!androidApiKey.startsWith('goog_')) {
    console.error('❌ [RevenueCat] Invalid Android API key format!');
    console.error(`   Current key: ${androidApiKey.substring(0, 20)}...`);
    console.error('   Android API keys should start with "goog_"');
    console.error('   Get your key from: https://app.revenuecat.com/ → Project Settings → API Keys');
    return false;
  }
  
  console.log('✅ [RevenueCat] Configuration validated successfully');
  return true;
}

/**
 * Get diagnostic information about RevenueCat configuration
 */
export function getRevenueCatDiagnostics() {
  const { iosApiKey, androidApiKey } = REVENUECAT_CONFIG;
  
  return {
    iosKey: {
      configured: iosApiKey !== 'appl_YOUR_IOS_API_KEY_HERE',
      validFormat: iosApiKey.startsWith('appl_'),
      isPlaceholder: iosApiKey.includes('YOUR_') || iosApiKey === 'REVENUECAT_TEST_API_KEY',
      prefix: iosApiKey.substring(0, 10),
    },
    androidKey: {
      configured: androidApiKey !== 'goog_YOUR_ANDROID_API_KEY_HERE',
      validFormat: androidApiKey.startsWith('goog_'),
      isPlaceholder: androidApiKey.includes('YOUR_') || androidApiKey === 'REVENUECAT_TEST_API_KEY',
      prefix: androidApiKey.substring(0, 10),
    },
  };
}

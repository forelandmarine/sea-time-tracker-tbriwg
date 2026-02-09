
const { withPlugins, withInfoPlist } = require('@expo/config-plugins');

/**
 * Expo Config Plugin for RevenueCat
 * 
 * This plugin configures the iOS app for RevenueCat subscriptions:
 * - Adds required Info.plist entries
 * - Configures StoreKit capabilities
 * 
 * TESTING: Using REVENUECAT_TEST_API_KEY for subscription testing
 */
function withRevenueCat(config, props) {
  return withInfoPlist(config, (config) => {
    // Add RevenueCat configuration to Info.plist
    // Use test API key if provided in props
    const apiKey = props?.iosApiKey || '$(REVENUECAT_TEST_API_KEY)';
    config.modResults.RevenueCatAPIKey = apiKey;
    
    // Ensure StoreKit is enabled
    config.modResults.SKAdNetworkItems = config.modResults.SKAdNetworkItems || [];
    
    return config;
  });
}

module.exports = withRevenueCat;

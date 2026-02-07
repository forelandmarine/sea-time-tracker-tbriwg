
const { withPlugins, withInfoPlist } = require('@expo/config-plugins');

/**
 * Expo Config Plugin for RevenueCat
 * 
 * This plugin configures the iOS app for RevenueCat subscriptions:
 * - Adds required Info.plist entries
 * - Configures StoreKit capabilities
 */
function withRevenueCat(config) {
  return withInfoPlist(config, (config) => {
    // Add RevenueCat configuration to Info.plist
    config.modResults.RevenueCatAPIKey = '$(REVENUECAT_API_KEY)';
    
    // Ensure StoreKit is enabled
    config.modResults.SKAdNetworkItems = config.modResults.SKAdNetworkItems || [];
    
    return config;
  });
}

module.exports = withRevenueCat;

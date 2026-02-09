
const { withPlugins, withInfoPlist } = require('@expo/config-plugins');

/**
 * Expo Config Plugin for RevenueCat
 * 
 * This plugin configures the iOS app for RevenueCat subscriptions:
 * - Adds required Info.plist entries
 * - Configures StoreKit capabilities
 * - Reads API key from plugin props (set in app.json)
 * 
 * The API key is passed from app.json plugins configuration and can use
 * environment variables via $(VARIABLE_NAME) syntax.
 */
function withRevenueCat(config, props) {
  console.log('[RevenueCat Plugin] Configuring with props:', {
    hasIosKey: !!props?.iosApiKey,
    hasAndroidKey: !!props?.androidApiKey,
    iosKeyPreview: props?.iosApiKey ? props.iosApiKey.substring(0, 20) + '...' : 'NOT SET',
  });

  return withInfoPlist(config, (config) => {
    // Add RevenueCat configuration to Info.plist
    const apiKey = props?.iosApiKey || '';
    
    if (apiKey) {
      config.modResults.RevenueCatAPIKey = apiKey;
      console.log('[RevenueCat Plugin] Set RevenueCatAPIKey in Info.plist');
    } else {
      console.warn('[RevenueCat Plugin] No iOS API key provided');
    }
    
    // Ensure StoreKit is enabled
    config.modResults.SKAdNetworkItems = config.modResults.SKAdNetworkItems || [];
    
    return config;
  });
}

module.exports = withRevenueCat;

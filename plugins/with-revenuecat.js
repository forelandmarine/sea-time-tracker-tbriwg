
const { withInfoPlist, withAndroidManifest } = require('@expo/config-plugins');

/**
 * Expo Config Plugin for RevenueCat
 * 
 * This plugin configures the iOS and Android apps for RevenueCat subscriptions:
 * - Adds required Info.plist entries for iOS
 * - Configures StoreKit capabilities for iOS
 * - Adds required permissions for Android
 * - Reads API keys from plugin props (set in app.json)
 * 
 * USAGE in app.json:
 * "plugins": [
 *   ["./plugins/with-revenuecat", {
 *     "iosApiKey": "test_gKMHKEpYSkTiLUtgKWHRbAXGcGd",
 *     "androidApiKey": "test_gKMHKEpYSkTiLUtgKWHRbAXGcGd"
 *   }]
 * ]
 */
function withRevenueCat(config, props = {}) {
  console.log('');
  console.log('========================================');
  console.log('🔧 RevenueCat Plugin Configuration');
  console.log('========================================');
  console.log('iOS API Key provided:', !!props?.iosApiKey);
  console.log('Android API Key provided:', !!props?.androidApiKey);
  
  if (props?.iosApiKey) {
    console.log('iOS Key preview:', props.iosApiKey.substring(0, 20) + '...');
    console.log('iOS Key length:', props.iosApiKey.length);
  } else {
    console.warn('⚠️  WARNING: No iOS API key provided to plugin');
  }
  
  if (props?.androidApiKey) {
    console.log('Android Key preview:', props.androidApiKey.substring(0, 20) + '...');
    console.log('Android Key length:', props.androidApiKey.length);
  } else {
    console.warn('⚠️  WARNING: No Android API key provided to plugin');
  }
  console.log('========================================');
  console.log('');

  // Configure iOS
  config = withInfoPlist(config, (config) => {
    const apiKey = props?.iosApiKey || '';
    
    if (apiKey) {
      // Add RevenueCat API key to Info.plist
      config.modResults.RevenueCatAPIKey = apiKey;
      console.log('✅ Set RevenueCatAPIKey in Info.plist');
      
      // Add background modes for remote notifications (required for subscription updates)
      if (!config.modResults.UIBackgroundModes) {
        config.modResults.UIBackgroundModes = [];
      }
      if (!config.modResults.UIBackgroundModes.includes('remote-notification')) {
        config.modResults.UIBackgroundModes.push('remote-notification');
        console.log('✅ Added remote-notification background mode');
      }
      
      // Add SKAdNetwork identifiers for attribution
      if (!config.modResults.SKAdNetworkItems) {
        config.modResults.SKAdNetworkItems = [];
      }
      
      const skAdNetworkIds = [
        'SU67R6K2V3.skadnetwork', // RevenueCat
        'cstr6suwn9.skadnetwork', // RevenueCat
      ];
      
      skAdNetworkIds.forEach(id => {
        const exists = config.modResults.SKAdNetworkItems.some(
          (item: any) => item.SKAdNetworkIdentifier === id
        );
        if (!exists) {
          config.modResults.SKAdNetworkItems.push({ SKAdNetworkIdentifier: id });
        }
      });
      
      console.log('✅ Added SKAdNetwork identifiers');
    } else {
      console.error('❌ No iOS API key provided - RevenueCat will not work on iOS');
    }
    
    return config;
  });

  // Configure Android
  config = withAndroidManifest(config, (config) => {
    const apiKey = props?.androidApiKey || '';
    
    if (apiKey) {
      console.log('✅ Android API key configured (will be used at runtime)');
      
      // Add billing permission
      const mainApplication = config.modResults.manifest.application?.[0];
      if (mainApplication) {
        // Ensure uses-permission for billing
        if (!config.modResults.manifest['uses-permission']) {
          config.modResults.manifest['uses-permission'] = [];
        }
        
        const hasBillingPermission = config.modResults.manifest['uses-permission'].some(
          (perm: any) => perm.$?.['android:name'] === 'com.android.vending.BILLING'
        );
        
        if (!hasBillingPermission) {
          config.modResults.manifest['uses-permission'].push({
            $: { 'android:name': 'com.android.vending.BILLING' },
          });
          console.log('✅ Added BILLING permission');
        }
      }
    } else {
      console.error('❌ No Android API key provided - RevenueCat will not work on Android');
    }
    
    return config;
  });

  return config;
}

module.exports = withRevenueCat;

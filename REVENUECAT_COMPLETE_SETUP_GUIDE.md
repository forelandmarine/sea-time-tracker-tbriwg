
# RevenueCat Complete Setup Guide for SeaTime Tracker

This guide provides step-by-step instructions for integrating RevenueCat SDK into your SeaTime Tracker Expo app.

## ✅ What's Already Done

The following components have been implemented and are ready to use:

1. **✅ SDK Packages Installed**
   - `react-native-purchases` (v9.7.6)
   - `react-native-purchases-ui` (v9.7.6)

2. **✅ Configuration Files**
   - `config/revenuecat.ts` - API key configuration
   - `plugins/with-revenuecat.js` - Expo config plugin
   - `app.json` - Plugin and extra configuration

3. **✅ Context & State Management**
   - `contexts/RevenueCatContext.tsx` - Global subscription state
   - Integrated with Better Auth for user identification

4. **✅ UI Screens**
   - `app/subscription-paywall.tsx` - Subscription purchase screen
   - `app/customer-center.tsx` - Subscription management screen
   - `app/revenuecat-diagnostic.tsx` - Configuration diagnostic tool

5. **✅ Backend Integration**
   - Subscription sync endpoints
   - Entitlement checking
   - User subscription status tracking

## 📋 Setup Steps

### Step 1: Get Your RevenueCat API Keys

1. Go to [RevenueCat Dashboard](https://app.revenuecat.com/)
2. Navigate to **Project Settings** → **API Keys**
3. Copy your API keys:
   - **iOS**: Starts with `appl_` (production) or `sk_`/`pk_` (test)
   - **Android**: Starts with `goog_` (production) or `sk_`/`pk_` (test)

**For Testing**: You can use the same test key for both platforms:
```
test_gKMHKEpYSkTiLUtgKWHRbAXGcGd
```

### Step 2: Configure API Keys in app.json

Your `app.json` is already configured with the test API key. For production, update both locations:

```json
{
  "expo": {
    "plugins": [
      [
        "./plugins/with-revenuecat",
        {
          "iosApiKey": "YOUR_IOS_API_KEY_HERE",
          "androidApiKey": "YOUR_ANDROID_API_KEY_HERE"
        }
      ]
    ],
    "extra": {
      "revenueCat": {
        "iosApiKey": "YOUR_IOS_API_KEY_HERE",
        "androidApiKey": "YOUR_ANDROID_API_KEY_HERE"
      }
    }
  }
}
```

**Current Configuration** (already set):
- iOS API Key: `test_gKMHKEpYSkTiLUtgKWHRbAXGcGd`
- Android API Key: `test_gKMHKEpYSkTiLUtgKWHRbAXGcGd`

### Step 3: Configure Products in RevenueCat Dashboard

1. Go to **Products** in RevenueCat Dashboard
2. Create a product with ID: `monthly`
3. Set up your entitlement: `SeaTime Tracker Pro`
4. Link the product to the entitlement
5. Create an offering and add the product

**Product Configuration**:
- **Product ID**: `monthly` (matches `PRODUCT_IDS.MONTHLY` in config)
- **Entitlement ID**: `SeaTime Tracker Pro` (matches `ENTITLEMENT_ID` in config)

### Step 4: Configure App Store Connect / Google Play Console

#### For iOS (App Store Connect):

1. Create an in-app purchase subscription
2. Product ID: `com.forelandmarine.seatimetracker.monthly`
3. Configure pricing and subscription details
4. Submit for review

#### For Android (Google Play Console):

1. Create a subscription product
2. Product ID: `monthly`
3. Configure pricing and subscription details
4. Publish the product

### Step 5: Rebuild Native Code

After updating `app.json`, you must rebuild the native code:

```bash
# Clean and rebuild
npx expo prebuild --clean

# Restart with cleared cache
npx expo start --clear
```

### Step 6: Test the Integration

1. **Check Configuration**:
   - Navigate to the subscription paywall screen
   - If configuration is invalid, you'll see a warning banner
   - Click "View Setup Instructions" for detailed diagnostic info

2. **Test Purchase Flow**:
   - Navigate to `/subscription-paywall`
   - Select a subscription package
   - Click "Subscribe Now"
   - Complete the test purchase

3. **Test Restore Purchases**:
   - Click "Restore Purchases" on the paywall
   - Verify that previous purchases are restored

4. **Test Customer Center**:
   - Navigate to Profile → Subscription
   - View subscription status
   - Test "Manage in App Store" link

## 🔧 Configuration Reference

### Product IDs

Update these in `config/revenuecat.ts` if you use different product IDs:

```typescript
export const PRODUCT_IDS = {
  MONTHLY: 'monthly', // Your monthly subscription product ID
};
```

### Entitlement ID

This is what you check to see if a user has access:

```typescript
export const ENTITLEMENT_ID = 'SeaTime Tracker Pro';
```

### Checking Subscription Status

Use the `useRevenueCat` hook in any component:

```typescript
import { useRevenueCat } from '@/contexts/RevenueCatContext';

function MyComponent() {
  const { isPro, hasActiveSubscription, isSubscriptionRequired } = useRevenueCat();
  
  if (isPro) {
    // User has active subscription
    return <PremiumFeature />;
  } else {
    // User needs to subscribe
    return <PaywallPrompt />;
  }
}
```

## 🎨 UI Components

### Subscription Paywall

Navigate users to the paywall:

```typescript
import { useRouter } from 'expo-router';

const router = useRouter();
router.push('/subscription-paywall');
```

### Customer Center

Navigate users to manage their subscription:

```typescript
router.push('/customer-center');
```

### Diagnostic Screen

For debugging configuration issues:

```typescript
router.push('/revenuecat-diagnostic');
```

## 🔍 Debugging

### Check Configuration Status

```typescript
import { validateRevenueCatConfig, getRevenueCatDiagnostics } from '@/config/revenuecat';

// Check if configuration is valid
const isValid = validateRevenueCatConfig();

// Get detailed diagnostic info
const diagnostics = getRevenueCatDiagnostics();
console.log('iOS Key:', diagnostics.iosKey);
console.log('Android Key:', diagnostics.androidKey);
```

### Common Issues

1. **"No subscription options available"**
   - Check that API keys are configured in `app.json`
   - Verify products are set up in RevenueCat Dashboard
   - Ensure offerings are created and published

2. **"Configuration Required" warning**
   - API keys are missing or invalid
   - Run `npx expo prebuild --clean` after updating `app.json`
   - Check diagnostic screen for detailed error messages

3. **Purchases not working**
   - Verify App Store Connect / Google Play Console configuration
   - Check that product IDs match between RevenueCat and stores
   - Test with sandbox accounts

4. **Entitlements not detected**
   - Verify entitlement ID matches in RevenueCat Dashboard
   - Check that products are linked to entitlements
   - Ensure offerings include the products

## 📱 Testing with Sandbox

### iOS Sandbox Testing

1. Create a sandbox tester account in App Store Connect
2. Sign out of your Apple ID on the device
3. Run the app and attempt a purchase
4. Sign in with the sandbox account when prompted

### Android Testing

1. Add test users in Google Play Console
2. Ensure the app is in internal testing track
3. Install the app from the Play Store (not directly)
4. Test purchases with the test account

## 🚀 Production Checklist

Before releasing to production:

- [ ] Replace test API keys with production keys in `app.json`
- [ ] Configure products in App Store Connect / Google Play Console
- [ ] Set up entitlements in RevenueCat Dashboard
- [ ] Create and publish offerings
- [ ] Test purchase flow with sandbox accounts
- [ ] Test restore purchases functionality
- [ ] Verify subscription status syncs with backend
- [ ] Test Customer Center functionality
- [ ] Update privacy policy and terms of service URLs
- [ ] Run `npx expo prebuild --clean`
- [ ] Build and submit to app stores

## 📚 Additional Resources

- [RevenueCat Documentation](https://www.revenuecat.com/docs)
- [RevenueCat Expo Guide](https://www.revenuecat.com/docs/getting-started/installation/expo)
- [RevenueCat Paywalls](https://www.revenuecat.com/docs/tools/paywalls)
- [RevenueCat Customer Center](https://www.revenuecat.com/docs/tools/customer-center)
- [App Store Connect Guide](https://developer.apple.com/app-store-connect/)
- [Google Play Console Guide](https://support.google.com/googleplay/android-developer)

## 🆘 Support

If you encounter issues:

1. Check the diagnostic screen: `/revenuecat-diagnostic`
2. Review console logs for error messages
3. Verify configuration in `app.json`
4. Check RevenueCat Dashboard for product setup
5. Contact RevenueCat support: https://www.revenuecat.com/support

## ✅ Current Status

Your SeaTime Tracker app is now configured with:

- ✅ RevenueCat SDK installed and configured
- ✅ Test API key set up (`test_gKMHKEpYSkTiLUtgKWHRbAXGcGd`)
- ✅ Subscription paywall screen implemented
- ✅ Customer Center screen implemented
- ✅ Diagnostic tools for troubleshooting
- ✅ Backend integration for subscription sync
- ✅ Entitlement checking (`SeaTime Tracker Pro`)
- ✅ Product configuration (`monthly`)

**Next Steps**:
1. Configure products in RevenueCat Dashboard
2. Set up App Store Connect / Google Play Console
3. Test with sandbox accounts
4. Replace with production API keys before release

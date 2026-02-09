
# RevenueCat Setup Instructions

## Problem Identified

The paywall is displaying "no subscription options at this time" because RevenueCat SDK is failing to initialize with **Error Code 11: Invalid API Key**.

## Root Cause

The app is using placeholder API keys (`'REVENUECAT_TEST_API_KEY'` and `'appl_YOUR_IOS_API_KEY_HERE'`) which are not valid RevenueCat API keys.

## Solution: Add Your Real RevenueCat API Keys

### Step 1: Get Your RevenueCat API Keys

1. Go to [RevenueCat Dashboard](https://app.revenuecat.com/)
2. Sign in to your account
3. Navigate to **Project Settings** → **API Keys**
4. Copy your API keys:
   - **iOS API Key** (starts with `appl_`)
   - **Android API Key** (starts with `goog_`)

### Step 2: Update app.json

Open `app.json` and replace the placeholder API keys in TWO places:

#### Location 1: In the `plugins` array

```json
"plugins": [
  ...
  [
    "./plugins/with-revenuecat",
    {
      "iosApiKey": "appl_YOUR_ACTUAL_IOS_KEY_HERE",
      "androidApiKey": "goog_YOUR_ACTUAL_ANDROID_KEY_HERE"
    }
  ]
]
```

#### Location 2: In the `extra.revenueCat` section

```json
"extra": {
  ...
  "revenueCat": {
    "iosApiKey": "appl_YOUR_ACTUAL_IOS_KEY_HERE",
    "androidApiKey": "goog_YOUR_ACTUAL_ANDROID_KEY_HERE"
  }
}
```

### Step 3: Verify Product IDs Match

Ensure the product IDs in `config/revenuecat.ts` match your App Store Connect configuration:

```typescript
products: {
  monthly: 'com.forelandmarine.seatime.monthly',  // Must match App Store Connect
  annual: 'com.forelandmarine.seatime.annual',
}
```

### Step 4: Restart the App

After updating `app.json`:

1. Stop the Expo dev server (Ctrl+C)
2. Clear the cache: `npx expo start --clear`
3. Restart the app

### Step 5: Verify It Works

Check the console logs for:

```
✅ [RevenueCat] SDK configured successfully
✅ [RevenueCat] Offerings fetched: [...]
```

Instead of:

```
❌ Error configuring Purchases: {"errorCode":11}
❌ [RevenueCat] Initialization error: {"errorCode":11}
```

## Testing Subscriptions

### For Development/Testing:

RevenueCat provides a **Sandbox environment** for testing:

1. In RevenueCat Dashboard, go to **Offerings** → Create a test offering
2. Use **Sandbox tester accounts** in App Store Connect
3. Test purchases won't charge real money

### For Production:

1. Ensure you're using **production API keys** (not sandbox)
2. Submit your app to App Store with in-app purchases configured
3. Test with real App Store accounts

## Common Issues

### Issue: "No subscription options at this time"
**Cause**: Invalid API key (Error Code 11)
**Fix**: Replace placeholder keys with real RevenueCat API keys

### Issue: Offerings are empty even with valid keys
**Cause**: No offerings configured in RevenueCat Dashboard
**Fix**: 
1. Go to RevenueCat Dashboard → **Offerings**
2. Create an offering with your product IDs
3. Ensure the offering is set as "Current"

### Issue: Purchase button disabled
**Cause**: No offerings available
**Fix**: Configure offerings in RevenueCat Dashboard

## Security Note

**DO NOT commit real API keys to public repositories!**

For production apps, use environment variables:

```bash
# .env (add to .gitignore)
EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=appl_your_real_key
EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY=goog_your_real_key
```

Then reference in `app.json`:

```json
"extra": {
  "revenueCat": {
    "iosApiKey": "${EXPO_PUBLIC_REVENUECAT_IOS_API_KEY}",
    "androidApiKey": "${EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY}"
  }
}
```

## Next Steps

1. ✅ Add real RevenueCat API keys to `app.json`
2. ✅ Configure offerings in RevenueCat Dashboard
3. ✅ Link product IDs in App Store Connect
4. ✅ Test with sandbox accounts
5. ✅ Submit to App Store for review

## Support

If you continue to have issues:
- Check [RevenueCat Documentation](https://docs.revenuecat.com/)
- Contact RevenueCat Support
- Email: info@forelandmarine.com

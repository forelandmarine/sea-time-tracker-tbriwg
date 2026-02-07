
# RevenueCat Integration Setup Guide

## Overview
SeaTime Tracker now uses RevenueCat for subscription management, providing a robust, Apple App Store compliant subscription system.

## Configuration Steps

### 1. RevenueCat Dashboard Setup

1. **Create RevenueCat Account**
   - Go to https://www.revenuecat.com/
   - Sign up for a free account
   - Create a new project for "SeaTime Tracker"

2. **Configure iOS App**
   - In RevenueCat dashboard, go to "Apps"
   - Add new iOS app
   - Enter Bundle ID: `com.forelandmarine.seatimetracker`
   - Upload App Store Connect API Key (from App Store Connect)

3. **Create Products**
   - Go to "Products" in RevenueCat dashboard
   - Create products matching your App Store Connect in-app purchases
   - Example: `seatime_monthly` for monthly subscription

4. **Create Entitlements**
   - Go to "Entitlements"
   - Create entitlement: `premium` or `pro`
   - Attach your products to this entitlement

5. **Get API Keys**
   - Go to "API Keys" in RevenueCat dashboard
   - Copy the iOS API Key (starts with `appl_`)
   - Copy the Android API Key (starts with `goog_`) if supporting Android

6. **Configure Webhooks**
   - Go to "Integrations" → "Webhooks"
   - Add webhook URL: `https://uukpkcag4nsq8q632k643ztvus28frfe.app.specular.dev/api/subscription/revenuecat/webhook`
   - Copy the webhook secret

### 2. App Store Connect Setup

1. **Create In-App Purchase**
   - Go to App Store Connect
   - Select your app
   - Go to "In-App Purchases"
   - Create new Auto-Renewable Subscription
   - Product ID: `seatime_monthly` (or your chosen ID)
   - Configure pricing and subscription details

2. **App Store Server Notifications (Optional)**
   - In App Store Connect, configure server notifications
   - URL: `https://uukpkcag4nsq8q632k643ztvus28frfe.app.specular.dev/api/subscription/revenuecat/webhook`
   - RevenueCat will handle these automatically

### 3. Update app.json

Replace the placeholder API keys in `app.json`:

```json
{
  "expo": {
    "extra": {
      "revenueCat": {
        "iosApiKey": "appl_YOUR_ACTUAL_IOS_API_KEY_HERE",
        "androidApiKey": "goog_YOUR_ACTUAL_ANDROID_API_KEY_HERE"
      }
    }
  }
}
```

### 4. Backend Environment Variables

Add these environment variables to your backend (Specular):

```
REVENUECAT_API_KEY=sk_YOUR_SECRET_API_KEY_HERE
REVENUECAT_WEBHOOK_SECRET=YOUR_WEBHOOK_SECRET_HERE
```

## Testing

### Sandbox Testing (iOS)

1. **Create Sandbox Tester**
   - Go to App Store Connect → Users and Access → Sandbox Testers
   - Create a new sandbox tester account

2. **Test on Device**
   - Sign out of App Store on your test device
   - Run the app
   - When prompted to purchase, sign in with sandbox tester account
   - Complete test purchase (no real money charged)

3. **Verify in RevenueCat**
   - Check RevenueCat dashboard → Customers
   - Your test purchase should appear

### Production Testing

1. **TestFlight**
   - Upload build to TestFlight
   - Invite internal testers
   - Test subscription flow end-to-end

2. **Verify Webhook**
   - Check backend logs for webhook events
   - Verify subscription status updates correctly

## Subscription Enforcement

The app enforces subscriptions at multiple levels:

### Frontend Enforcement
- `useSubscriptionEnforcement()` hook checks subscription before premium actions
- Redirects to paywall if subscription inactive
- Used in:
  - Vessel activation
  - Manual sea time entry
  - Report generation

### Backend Enforcement
- Middleware checks subscription status on protected endpoints
- Returns 403 if subscription inactive
- Automatically deactivates vessels when subscription expires
- Protected endpoints:
  - `POST /api/vessels` (creating vessels)
  - `PATCH /api/vessels/:id/activate` (activating vessels)
  - `POST /api/sea-time` (manual entries)
  - `GET /api/reports/*` (generating reports)

## Subscription Flow

1. **New User**
   - Signs up → Redirected to subscription paywall
   - Purchases subscription → RevenueCat processes
   - Webhook updates backend → User gains access

2. **Existing User**
   - App checks subscription on launch
   - If active → Full access
   - If inactive → Redirected to paywall
   - Vessels automatically deactivated

3. **Subscription Renewal**
   - RevenueCat handles automatically
   - Webhook updates backend
   - User continues with uninterrupted access

4. **Subscription Cancellation**
   - User cancels in App Store
   - Subscription remains active until expiration
   - On expiration → Webhook updates backend
   - Vessels deactivated, user redirected to paywall

## Troubleshooting

### Subscription Not Detected
- Check RevenueCat dashboard for customer
- Verify API keys are correct
- Check backend logs for webhook events
- Try "Restore Purchases" in app

### Webhook Not Firing
- Verify webhook URL is correct
- Check webhook secret matches
- Test webhook in RevenueCat dashboard
- Check backend logs for errors

### Sandbox Purchases Not Working
- Ensure signed out of App Store
- Use valid sandbox tester account
- Check App Store Connect for sandbox tester status
- Try deleting and reinstalling app

## Support

For RevenueCat support:
- Documentation: https://docs.revenuecat.com/
- Community: https://community.revenuecat.com/
- Support: support@revenuecat.com

For SeaTime Tracker support:
- Email: info@forelandmarine.com

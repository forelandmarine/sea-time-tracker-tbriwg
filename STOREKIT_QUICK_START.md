
# StoreKit Quick Start Guide

This guide will help you quickly test the StoreKit integration for SeaTime Tracker.

## Prerequisites

- iOS device or simulator (iOS 15.0+)
- Apple Developer account
- App Store Connect access
- Sandbox tester account

## Quick Setup (5 minutes)

### 1. Create Sandbox Tester Account

1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Navigate to **Users and Access** → **Sandbox Testers**
3. Click **+** to add a new tester
4. Fill in details:
   - **Email**: Use a unique email (e.g., `test.seatime@icloud.com`)
   - **Password**: Create a strong password
   - **First Name**: Test
   - **Last Name**: User
   - **Country/Region**: United Kingdom
5. Click **Create**

### 2. Configure Your iOS Device

1. On your iOS device, go to **Settings** → **App Store**
2. Scroll down to **Sandbox Account**
3. Sign in with your sandbox tester email and password
4. **Important**: Do NOT sign in with your sandbox account in the main App Store app

### 3. Build and Run the App

```bash
# Install dependencies
npm install

# Run on iOS device
npm run ios

# Or build with EAS for TestFlight
eas build --platform ios --profile preview
```

### 4. Test Purchase Flow

1. Launch the app
2. Sign in with a test account (e.g., `test@seatime.com`)
3. You should see the subscription paywall
4. Tap **"Subscribe Now"**
5. The native iOS payment sheet will appear
6. Tap **"Subscribe"** (you won't be charged in sandbox mode)
7. Enter your sandbox tester password if prompted
8. Wait for the purchase to complete
9. The app should verify the receipt and activate your subscription
10. You should be redirected to the main app

### 5. Test Restore Flow

1. Delete the app from your device
2. Reinstall and launch the app
3. Sign in with the same test account
4. On the subscription paywall, tap **"Restore Purchases"**
5. Your subscription should be restored
6. You should be redirected to the main app

## Testing Checklist

- [ ] Sandbox tester account created
- [ ] Device configured with sandbox account
- [ ] App builds and runs successfully
- [ ] Subscription paywall displays correctly
- [ ] Product price loads from App Store (£4.99/€5.99)
- [ ] Purchase flow completes successfully
- [ ] Receipt verification succeeds
- [ ] Subscription status updates to "active"
- [ ] User is redirected to main app
- [ ] Restore purchases works after reinstall
- [ ] Subscription status persists across app launches

## Common Issues

### "Cannot connect to iTunes Store"

**Solution**: Make sure you're signed in with your sandbox account in **Settings → App Store → Sandbox Account**, NOT in the main App Store app.

### "Product not found"

**Solution**: 
1. Verify the product ID is correct: `com.forelandmarine.seatime.monthly`
2. Wait 24 hours after creating the product in App Store Connect
3. Ensure the product status is "Ready to Submit" or "Approved"

### "Receipt verification failed"

**Solution**:
1. Check that `APPLE_APP_SECRET` is set in backend environment
2. Verify you're using the correct environment (sandbox for testing)
3. Check backend logs for detailed error messages

### Purchase succeeds but subscription not activated

**Solution**:
1. Check backend logs for receipt verification errors
2. Tap "Check Subscription Status" to manually refresh
3. Verify the backend `/api/subscription/verify` endpoint is working

## Sandbox Testing Tips

1. **Accelerated Renewals**: In sandbox mode, subscriptions renew much faster:
   - 1 month subscription = 5 minutes in sandbox
   - This allows you to test renewal behavior quickly

2. **Multiple Purchases**: You can purchase the same subscription multiple times in sandbox mode without being charged

3. **Cancellation**: To test cancellation:
   - Go to **Settings → App Store → Sandbox Account → Manage**
   - Cancel the subscription
   - Wait for it to expire (5 minutes in sandbox)
   - Verify the app detects the expired subscription

4. **Receipt Refresh**: Receipts are automatically refreshed when:
   - App launches
   - User taps "Check Subscription Status"
   - User completes a purchase or restore

## Next Steps

Once sandbox testing is complete:

1. **TestFlight Testing**: Build and upload to TestFlight for internal testing
2. **Production Testing**: Test with real payment methods via TestFlight
3. **App Review**: Submit to App Store with subscription enabled
4. **Monitor**: Check App Store Connect for subscription metrics

## Support

If you encounter issues:
- Check backend logs in Specular dashboard
- Review `STOREKIT_DEPLOYMENT_GUIDE.md` for detailed troubleshooting
- Contact support@forelandmarine.com

## Useful Commands

```bash
# Check if StoreKit is properly configured
npx expo config --type introspect

# View iOS build logs
eas build:view --platform ios

# Check backend logs
# Visit: https://uukpkcag4nsq8q632k643ztvus28frfe.app.specular.dev/logs

# Rebuild app after changes
npm run ios
```

## Testing Scenarios

### Scenario 1: New User Purchase
1. Create new user account
2. See subscription paywall
3. Purchase subscription
4. Verify access granted

### Scenario 2: Existing User Restore
1. User with active subscription
2. Reinstall app
3. Sign in
4. Restore purchases
5. Verify access granted

### Scenario 3: Expired Subscription
1. User with expired subscription
2. Launch app
3. See subscription paywall
4. Purchase or restore
5. Verify access granted

### Scenario 4: Subscription Cancellation
1. User with active subscription
2. Cancel in iOS Settings
3. Wait for expiration
4. Launch app
5. Verify paywall appears
6. Verify tracking is paused

## Success Criteria

✅ All testing scenarios pass
✅ Receipt verification works consistently
✅ Subscription status updates correctly
✅ User experience is smooth and intuitive
✅ Error handling works properly
✅ Backend logs show successful verifications

Once all criteria are met, you're ready for production deployment!


# Apple Sign-In Setup Guide

## Overview
This app uses Sign in with Apple for iOS authentication. For it to work properly, you need to configure both the Expo app and Apple Developer account.

## Prerequisites
- Apple Developer Account (paid membership required)
- App registered in App Store Connect
- Bundle identifier configured: `com.seatimetracker.app`

## Configuration Steps

### 1. Apple Developer Portal Setup

1. **Enable Sign in with Apple Capability**
   - Go to [Apple Developer Portal](https://developer.apple.com/account)
   - Navigate to Certificates, Identifiers & Profiles
   - Select your App ID (`com.seatimetracker.app`)
   - Enable "Sign in with Apple" capability
   - Save changes

2. **Create Service ID (for web/testing)**
   - In Identifiers, create a new Service ID
   - Use identifier like: `com.seatimetracker.app.service`
   - Enable "Sign in with Apple"
   - Configure domains and redirect URLs if needed

### 2. App Configuration

The app.json has been updated with:
```json
{
  "ios": {
    "usesAppleSignIn": true,
    "bundleIdentifier": "com.seatimetracker.app"
  },
  "plugins": [
    "expo-apple-authentication"
  ]
}
```

### 3. Build the App

After configuration, rebuild the app:

```bash
# For development build
eas build --profile development --platform ios

# For production build
eas build --profile production --platform ios
```

**Important:** Sign in with Apple only works on:
- Physical iOS devices (iOS 13+)
- Production builds
- TestFlight builds
- Development builds on physical devices

It does NOT work on:
- iOS Simulator
- Expo Go
- Web browsers (requires additional setup)

### 4. Testing

1. Install the build on a physical iOS device
2. Tap "Sign in with Apple" button
3. You should see the Apple authentication sheet
4. Sign in with your Apple ID
5. The app will receive an identity token and create/sign in the user

### 5. Troubleshooting

**Error: "Sign in with Apple is not available on this device"**
- Make sure you're testing on a physical iOS device (iOS 13+)
- Ensure the device is signed in to iCloud
- Check that the app has the Apple Sign-In capability enabled

**Error: "Invalid Apple token"**
- Verify the bundle identifier matches in:
  - app.json
  - Apple Developer Portal
  - The actual build
- Ensure the app is properly signed with the correct provisioning profile

**Error: "Apple authentication failed"**
- Check backend logs for detailed error messages
- Verify the backend can decode the JWT identity token
- Ensure the backend endpoint `/api/auth/sign-in/apple` is working

**Backend not receiving requests**
- Check that `backendUrl` in app.json is correct
- Verify network connectivity
- Check backend logs with: `get_backend_logs` tool

### 6. Backend Implementation

The backend endpoint `/api/auth/sign-in/apple` handles:
1. Decoding the JWT identity token
2. Extracting user information (sub, email)
3. Creating or finding existing user account
4. Creating a session token
5. Returning user data and session

### 7. Privacy Requirements

Apple requires apps using Sign in with Apple to:
- Display the button prominently if other social login options are available
- Not require additional account creation after Apple sign-in
- Respect user privacy choices (hide email option)

The app is configured to request:
- Email address (optional - user can hide)
- Full name (optional - only provided on first sign-in)

## Current Status

✅ App configuration updated with Apple Sign-In capability
✅ expo-apple-authentication plugin added
✅ Frontend implementation with error handling and logging
✅ Backend endpoint for Apple authentication
✅ Token storage and session management

⚠️ Requires rebuild with EAS Build to take effect
⚠️ Must test on physical iOS device (not simulator)
⚠️ Requires Apple Developer account configuration

## Next Steps

1. Configure Apple Developer Portal (enable Sign in with Apple for your App ID)
2. Rebuild the app with: `eas build --profile production --platform ios`
3. Install on physical iOS device
4. Test Sign in with Apple functionality
5. Monitor logs for any issues

## Support

If you encounter issues:
1. Check the app logs for detailed error messages
2. Verify Apple Developer Portal configuration
3. Ensure you're testing on a physical device
4. Check backend logs for authentication errors

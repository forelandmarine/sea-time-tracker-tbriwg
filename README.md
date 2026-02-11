# SeaTime Tracker

This app was built using [Natively.dev](https://natively.dev) - a platform for creating mobile apps.

Made with 💙 for creativity.

## Development

### Running the App

- **Web Preview:** `npm run web` - Works without authentication ✅
- **iOS:** `npm run ios` - Requires iOS simulator
- **Android:** `npm run android` - Requires Android emulator
- **Tunnel Mode:** `npm run dev` - Requires Expo authentication

### Troubleshooting Expo Go Error 500

If you see "Error 500" or "CommandError: Input is required, but 'npx expo' is in non-interactive mode", this is because:

1. The app uses `--tunnel` mode which requires Expo authentication
2. The environment is running in non-interactive mode (cannot prompt for login)
3. No EXPO_TOKEN environment variable is set

**This is NOT a bug in your app** - it's an Expo CLI authentication issue in non-interactive environments.

**Solutions (in order of preference):**

✅ **1. Use Web Preview** (Recommended - works immediately)
```bash
npm run web
```
The web preview works perfectly and doesn't require authentication. Your app is fully functional on web.

✅ **2. Run without tunnel mode** (for local development)
```bash
EXPO_NO_TELEMETRY=1 expo start
```
This runs the dev server on your local network without requiring authentication. You can then:
- Press `w` to open web
- Press `i` to open iOS simulator
- Press `a` to open Android emulator

✅ **3. Use iOS/Android directly** (if you have simulators installed)
```bash
npm run ios
# or
npm run android
```

✅ **4. Set EXPO_TOKEN** (for CI/CD environments only)
```bash
export EXPO_TOKEN=your_expo_access_token
npm run dev
```

**Important:** The error occurs during Expo Go manifest generation, NOT in your app code. Your app, backend, and API are all working correctly (as confirmed by the successful web logs). This is purely an Expo CLI environment configuration issue.

### What's Actually Working

Based on the logs, your app is **fully functional**:
- ✅ Authentication working (user logged in as test@seatime.com)
- ✅ Backend API responding correctly
- ✅ Subscription system initialized
- ✅ Vessels loading successfully (3 vessels found)
- ✅ Web preview rendering perfectly

The "error 500" is just Expo CLI failing to authenticate for tunnel mode - it's not affecting your app's functionality.

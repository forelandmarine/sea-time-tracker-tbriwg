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

If you see "Error 500" when trying to use Expo Go with tunnel mode, this is because:

1. The app uses `--tunnel` mode which requires Expo authentication
2. The environment is running in non-interactive mode (cannot prompt for login)
3. No EXPO_TOKEN environment variable is set

**Solutions:**

✅ **Use Web Preview** (Recommended for this environment)
```bash
npm run web
```
The web preview works perfectly and doesn't require authentication.

✅ **Run without tunnel mode**
```bash
npx expo start
```
This runs the dev server on your local network without requiring authentication.

✅ **Use iOS/Android directly**
```bash
npm run ios
# or
npm run android
```

**Note:** The error occurs during Expo Go manifest generation, not in your app code. Your app, backend, and API are all working correctly (as shown in the logs). This is purely an Expo CLI authentication issue.


# Web Preview Fix - react-native-iap Compatibility

## Problem
The web preview was crashing with the error:
```
Uncaught Error: Your web project is importing a module from 'react-native' instead of 'react-native-web'
Source: import * as RNIap from 'react-native-iap';
```

The `react-native-iap` package is a native-only module that provides iOS/Android in-app purchase functionality. It cannot run on web because:
1. It requires native StoreKit (iOS) or Google Play Billing (Android) APIs
2. It has no web equivalent or polyfill
3. Web browsers don't support in-app purchases through these native systems

## Solution
We implemented **platform-specific file extensions** to separate native and web code:

### File Structure
```
utils/
├── storeKit.ts          # Web version (stub implementations)
└── storeKit.native.ts   # iOS/Android version (actual react-native-iap code)
```

### How It Works
React Native's Metro bundler automatically selects the correct file based on platform:
- **iOS/Android**: Uses `storeKit.native.ts` (imports react-native-iap)
- **Web**: Uses `storeKit.ts` (stub implementations, no native imports)

### Implementation Details

#### storeKit.native.ts (iOS/Android)
- Contains the full StoreKit implementation
- Imports `react-native-iap` package
- Handles actual in-app purchases
- Communicates with Apple App Store / Google Play

#### storeKit.ts (Web)
- Provides stub implementations of all functions
- Returns appropriate error messages
- No native dependencies
- Logs warnings that IAP is not available on web

### Benefits
1. ✅ **Web preview works** - No more import errors
2. ✅ **Native functionality preserved** - iOS/Android still have full IAP support
3. ✅ **Type safety maintained** - Both files export the same function signatures
4. ✅ **No runtime checks needed** - Platform selection happens at build time
5. ✅ **Clean separation** - Web and native code are completely isolated

### Usage in Components
Components can import from `utils/storeKit` without worrying about the platform:

```typescript
import { completePurchaseFlow, getProductInfo } from '@/utils/storeKit';

// This works on all platforms:
// - iOS/Android: Calls actual StoreKit functions
// - Web: Returns stub responses with appropriate errors
const result = await completePurchaseFlow();
```

### Testing
- **Web**: Run `npm run web` - Should load without errors
- **iOS**: Run `npm run ios` - In-app purchases should work normally
- **Android**: Run `npm run android` - Should work (though IAP not configured)

## Alternative Approaches Considered

### 1. Platform.OS checks (❌ Rejected)
```typescript
if (Platform.OS === 'ios' || Platform.OS === 'android') {
  import * as RNIap from 'react-native-iap'; // Still crashes on web!
}
```
**Problem**: The import statement is evaluated at module load time, before any runtime checks can execute.

### 2. Dynamic imports (❌ Rejected)
```typescript
const RNIap = await import('react-native-iap');
```
**Problem**: Makes all functions async and complicates the API. Also, Metro bundler still tries to resolve the import on web.

### 3. Platform-specific files (✅ Chosen)
**Why**: Clean, build-time solution that completely separates web and native code. No runtime overhead, no import errors, maintains type safety.

## Related Files
- `app/subscription-paywall.tsx` - Uses storeKit functions
- `contexts/SubscriptionContext.tsx` - Manages subscription state
- `backend/src/routes/subscription.ts` - Backend receipt verification

## Apple IAP Compliance
This fix maintains full compliance with Apple's Guideline 3.1.1:
- Native in-app purchases work on iOS
- Users can subscribe directly in the app
- Receipt verification with Apple servers
- Proper subscription management

The web version simply doesn't offer IAP (which is acceptable since web apps can't use Apple's IAP system anyway).

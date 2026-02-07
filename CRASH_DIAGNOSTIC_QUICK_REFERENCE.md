
# 🚨 iOS TurboModule Crash - Quick Reference Card

## 🎯 Problem
- **Crash:** `EXC_CRASH (SIGABRT)` at `RCTTurboModule.mm:441`
- **When:** 5-20 seconds after Apple Sign-In
- **Cause:** Native Objective-C exception during TurboModule call

---

## 🔍 How to Find the Crashing Module

### Option 1: Device Console (RECOMMENDED)
```bash
1. Connect iPhone to Mac (USB)
2. Xcode > Devices and Simulators
3. Select device > Open Console
4. Filter: "TurboModuleInvoke"
5. Reproduce crash
6. Last log before crash = culprit
```

**Example output:**
```
[TurboModuleInvoke] Module: RCTSecureStore
[TurboModuleInvoke] Method: setItemAsync:value:options:resolver:rejecter:
[TurboModuleInvoke] Arguments: 5
<CRASH>
```
**Culprit:** `SecureStore.setItemAsync`

### Option 2: Crash Log File
```bash
1. After crash, reconnect device
2. Xcode > Devices > Download Container
3. Open: Documents/crash_log.txt
4. Look for exception name and reason
```

---

## 🛠️ Fixes Already Implemented

| Fix | File | What It Does |
|-----|------|--------------|
| **TurboModule Logging** | `patches/react-native+0.81.5.patch` | Logs every native call before execution |
| **Fatal Handlers** | `plugins/ios-crash-instrumentation.js` | Captures exception details before SIGABRT |
| **Dynamic SecureStore** | `contexts/AuthContext.tsx` | Prevents module-scope initialization |
| **Extreme Delays** | `app/_layout.tsx` | Staggers native module loading (3-12s) |
| **Input Validation** | `contexts/AuthContext.tsx` | Validates all params before native calls |
| **Concurrency Lock** | `contexts/AuthContext.tsx` | Prevents race conditions |

---

## 📋 Deployment Checklist

```bash
# 1. Verify instrumentation
chmod +x scripts/verify-crash-instrumentation.sh
./scripts/verify-crash-instrumentation.sh

# 2. Install dependencies (applies patches)
npm install

# 3. Clean prebuild
npx expo prebuild --clean

# 4. Build for TestFlight
eas build --platform ios --profile production

# 5. Monitor crash
# Connect device > Xcode > Console > Filter: "TurboModuleInvoke"
```

---

## 🎯 Most Likely Suspects

After Apple Sign-In, these modules are called:

| Module | Method | Delay | Status |
|--------|--------|-------|--------|
| **SecureStore** | `setItemAsync` | 4s | ✅ Fixed (dynamic import) |
| **Notifications** | `requestPermissionsAsync` | 8s | ✅ Fixed (delayed) |
| **NetInfo** | `addEventListener` | 10s | ✅ Fixed (delayed) |
| **StoreKit (IAP)** | `getSubscriptions` | ? | ⚠️ May need delay |

---

## 🔧 If Crash Persists

### Step 1: Identify Module
Check device console for last `[TurboModuleInvoke]` log

### Step 2: Apply Fix Based on Module

#### If SecureStore:
```typescript
// Add main thread dispatch
if (Platform.OS === 'ios') {
  await new Promise(resolve => setTimeout(resolve, 100));
}
const SecureStore = await import('expo-secure-store');
await SecureStore.setItemAsync(key, value);
```

#### If Notifications:
```typescript
// Increase delay to 15 seconds
setTimeout(async () => {
  const { registerForPushNotificationsAsync } = await import('@/utils/notifications');
  await registerForPushNotificationsAsync();
}, 15000);
```

#### If StoreKit:
```typescript
// Add 20 second delay
setTimeout(async () => {
  const { checkSubscriptionStatus } = await import('@/contexts/SubscriptionContext');
  await checkSubscriptionStatus();
}, 20000);
```

---

## ✅ Success Criteria

**Diagnostic Success:**
- ✅ Device console shows `[TurboModuleInvoke]` logs
- ✅ Crash logs include exception name/reason
- ✅ Last invoked module is identified

**Fix Success:**
- ✅ No crash after Apple Sign-In
- ✅ User can navigate normally
- ✅ No SIGABRT in TestFlight reports

---

## 📞 Support

**Full Guide:** `TURBOMODULE_CRASH_DIAGNOSTIC_GUIDE.md`  
**Verification Script:** `scripts/verify-crash-instrumentation.sh`  
**Patch File:** `patches/react-native+0.81.5.patch`  
**Config Plugin:** `plugins/ios-crash-instrumentation.js`

---

**Last Updated:** 2026-02-06  
**Version:** 1.0.4 (Build 84)

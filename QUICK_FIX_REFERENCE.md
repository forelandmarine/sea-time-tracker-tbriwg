
# TurboModule Crash - Quick Fix Reference

## 🚨 Immediate Action Required

### 1. iOS Native Changes (CRITICAL)

**File:** `ios/YourAppName/AppDelegate.mm`

**Add at the top (before @implementation):**

```objc
void HandleObjectiveCException(NSException *exception) {
    NSLog(@"\n🚨 CAUGHT EXCEPTION: %@ - %@\n", exception.name, exception.reason);
    for (NSString *symbol in [exception callStackSymbols]) {
        NSLog(@"  %@", symbol);
    }
}

void CustomRCTFatalHandler(NSError *error) {
    NSLog(@"\n🚨 RCTFatal: %@ (Code: %ld)\n", error.localizedDescription, (long)error.code);
}
```

**Add in didFinishLaunchingWithOptions (at the very top):**

```objc
NSSetUncaughtExceptionHandler(&HandleObjectiveCException);
RCTSetFatalHandler(CustomRCTFatalHandler);
NSLog(@"✅ Exception handlers installed");
```

### 2. Clean Build

```bash
# Clean everything
cd ios
rm -rf Pods Podfile.lock
rm -rf ~/Library/Developer/Xcode/DerivedData/*
pod install
cd ..

# Rebuild
npx expo run:ios --device
```

---

## 📋 What Was Fixed (Frontend)

### ✅ app/_layout.tsx
- All native modules now load 2-5 seconds AFTER app startup
- Staggered loading prevents race conditions
- Non-blocking operations

### ✅ contexts/AuthContext.tsx
- 3-second auth check timeout
- 10-second sign-in timeout
- Single operation lock prevents concurrent operations

### ✅ contexts/SubscriptionContext.tsx
- 2-second delay before first check
- 1.5-second check timeout
- Defaults to inactive on error

### ✅ utils/notifications.ts
- Lazy loading - modules only load when called
- No file-scope imports

### ✅ utils/storeKit.native.ts
- Complete lazy loading
- 2-second init timeout
- Only loads when user opens subscription screen

### ✅ contexts/WidgetContext.tsx
- Dynamic import with 2-second timeout
- iOS-only, graceful degradation

### ✅ app/index.tsx
- 1-second delay before profile fetch
- 5-second profile fetch timeout
- Graceful error handling

---

## 🔍 How to Read Crash Logs

After implementing AppDelegate.mm changes, crashes will show:

```
🚨 CAUGHT EXCEPTION: NSInvalidArgumentException - unrecognized selector
  0   CoreFoundation    __exceptionPreprocess + 123
  1   libobjc.A.dylib   objc_exception_throw + 56
  2   YourApp           -[RCTTurboModule performVoidMethodInvocation] + 789
```

**Look for:**
- Module name in stack trace
- "CLLocationManager" = location issue
- "AVAudioSession" = audio issue
- "UIKit" = UI thread issue

---

## 🎯 Common Fixes

### Location Services Crash
```objc
dispatch_async(dispatch_get_main_queue(), ^{
    self.locationManager = [[CLLocationManager alloc] init];
});
```

### Audio Session Crash
```objc
dispatch_async(dispatch_get_main_queue(), ^{
    [[AVAudioSession sharedInstance] setCategory:AVAudioSessionCategoryPlayback error:nil];
});
```

### Any UI Code
```objc
dispatch_async(dispatch_get_main_queue(), ^{
    // Your UI code here
});
```

---

## ✅ Testing Checklist

- [ ] Clean build folder
- [ ] Delete derived data
- [ ] Rebuild from scratch
- [ ] Test on physical device (not simulator)
- [ ] Check Xcode console for exception logs
- [ ] Verify app launches without crash
- [ ] Test sign in
- [ ] Test navigation
- [ ] Test notifications (if used)

---

## 📞 If Still Crashing

1. Check Xcode console for exception handler output
2. Find module name in stack trace
3. Search codebase for that module
4. Ensure it's loaded lazily (not at file scope)
5. Ensure UI calls are on main thread

---

## 📚 Full Documentation

- **Detailed iOS Guide:** `IOS_TURBOMODULE_CRASH_FIX_GUIDE.md`
- **Complete Summary:** `TURBOMODULE_CRASH_FIX_SUMMARY.md`

---

**Status:** Frontend fixes ✅ COMPLETE | iOS native fixes ⚠️ PENDING

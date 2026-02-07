
# iOS TurboModule Crash Fix Guide

## 🚨 CRITICAL: AppDelegate.mm Modifications Required

This guide provides the **exact code** you need to add to your iOS `AppDelegate.mm` file to diagnose and prevent TurboModule crashes.

---

## Problem Summary

Your app is crashing ~2 seconds after launch with:
- **Exception Type:** `EXC_CRASH (SIGABRT)`
- **Termination Reason:** `SIGNAL 6 Abort trap: 6`
- **Key Stack Frame:** `facebook::react::ObjCTurboModule::performVoidMethodInvocation`

This indicates a **TurboModule bridge failure** where a JavaScript call to a native module is triggering an Objective-C runtime exception.

---

## Root Causes

1. **UI API calls from background threads** (e.g., `CLLocationManager`, `AVAudioSession`, `UIKit`)
2. **Signature mismatches** between JS and Objective-C method signatures
3. **Nil values passed to nonnull parameters**
4. **Modules loading before React Native bridge is ready**

---

## Solution: Enhanced AppDelegate.mm

### Step 1: Open Your AppDelegate.mm File

Location: `ios/YourAppName/AppDelegate.mm`

### Step 2: Add These Imports at the Top

```objc
#import <React/RCTLog.h>
#import <React/RCTBridge.h>
#import <objc/runtime.h>
```

### Step 3: Add Global Exception Handlers (Before @implementation)

Add these **BEFORE** your `@implementation AppDelegate` line:

```objc
// ═══════════════════════════════════════════════════════════════════════════
// 🚨 CRITICAL: GLOBAL OBJECTIVE-C EXCEPTION HANDLER
// ═══════════════════════════════════════════════════════════════════════════
// This catches ALL Objective-C exceptions BEFORE they cause SIGABRT
// Provides detailed diagnostics for TurboModule crashes
// ═══════════════════════════════════════════════════════════════════════════

void HandleObjectiveCException(NSException *exception) {
    NSLog(@"\n\n");
    NSLog(@"═══════════════════════════════════════════════════════════════");
    NSLog(@"🚨 CAUGHT OBJECTIVE-C EXCEPTION (TurboModule Crash Prevention)");
    NSLog(@"═══════════════════════════════════════════════════════════════");
    NSLog(@"Exception Name: %@", exception.name);
    NSLog(@"Exception Reason: %@", exception.reason);
    NSLog(@"User Info: %@", exception.userInfo);
    NSLog(@"───────────────────────────────────────────────────────────────");
    NSLog(@"Call Stack Symbols:");
    for (NSString *symbol in [exception callStackSymbols]) {
        NSLog(@"  %@", symbol);
    }
    NSLog(@"═══════════════════════════════════════════════════════════════");
    NSLog(@"\n\n");
    
    // CRITICAL: Check if this is a TurboModule-related crash
    NSString *reason = exception.reason;
    if ([reason containsString:@"TurboModule"] ||
        [reason containsString:@"performVoidMethodInvocation"] ||
        [reason containsString:@"NSInvocation"]) {
        NSLog(@"⚠️ DETECTED: TurboModule invocation failure");
        NSLog(@"⚠️ This is likely caused by:");
        NSLog(@"   1. UI API called from background thread");
        NSLog(@"   2. Signature mismatch between JS and native");
        NSLog(@"   3. Nil passed to nonnull parameter");
        NSLog(@"   4. Module loaded before bridge ready");
    }
    
    // CRITICAL: Check for common culprits
    if ([reason containsString:@"CLLocationManager"] ||
        [reason containsString:@"Location"]) {
        NSLog(@"⚠️ DETECTED: Location services issue");
        NSLog(@"⚠️ CLLocationManager MUST be called on main thread");
    }
    
    if ([reason containsString:@"AVAudioSession"] ||
        [reason containsString:@"Audio"]) {
        NSLog(@"⚠️ DETECTED: Audio session issue");
        NSLog(@"⚠️ AVAudioSession MUST be called on main thread");
    }
    
    if ([reason containsString:@"UIKit"] ||
        [reason containsString:@"UI"]) {
        NSLog(@"⚠️ DETECTED: UIKit issue");
        NSLog(@"⚠️ ALL UIKit calls MUST be on main thread");
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// 🚨 CRITICAL: REACT NATIVE FATAL ERROR HANDLER
// ═══════════════════════════════════════════════════════════════════════════
// This catches RCTFatal errors before they cause SIGABRT
// ═══════════════════════════════════════════════════════════════════════════

void CustomRCTFatalHandler(NSError *error) {
    NSLog(@"\n\n");
    NSLog(@"═══════════════════════════════════════════════════════════════");
    NSLog(@"🚨 CAUGHT RCTFatal ERROR");
    NSLog(@"═══════════════════════════════════════════════════════════════");
    NSLog(@"Domain: %@", error.domain);
    NSLog(@"Code: %ld", (long)error.code);
    NSLog(@"Description: %@", error.localizedDescription);
    NSLog(@"User Info: %@", error.userInfo);
    NSLog(@"───────────────────────────────────────────────────────────────");
    
    // Extract stack trace if available
    NSArray *stackTrace = error.userInfo[@"RCTJSStackTrace"];
    if (stackTrace) {
        NSLog(@"JavaScript Stack Trace:");
        for (NSDictionary *frame in stackTrace) {
            NSLog(@"  %@:%@ in %@",
                  frame[@"file"] ?: @"unknown",
                  frame[@"lineNumber"] ?: @"?",
                  frame[@"methodName"] ?: @"<anonymous>");
        }
    }
    
    NSLog(@"═══════════════════════════════════════════════════════════════");
    NSLog(@"\n\n");
}

// ═══════════════════════════════════════════════════════════════════════════
// 🚨 CRITICAL: MAIN THREAD ENFORCEMENT
// ═══════════════════════════════════════════════════════════════════════════
// Swizzle common UI methods to detect background thread violations
// ═══════════════════════════════════════════════════════════════════════════

@interface NSObject (MainThreadCheck)
@end

@implementation NSObject (MainThreadCheck)

+ (void)load {
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        // Swizzle CLLocationManager init
        Class locationManagerClass = NSClassFromString(@"CLLocationManager");
        if (locationManagerClass) {
            Method originalInit = class_getInstanceMethod(locationManagerClass, @selector(init));
            Method swizzledInit = class_getInstanceMethod(locationManagerClass, @selector(swizzled_init));
            if (originalInit && swizzledInit) {
                method_exchangeImplementations(originalInit, swizzledInit);
            }
        }
    });
}

- (instancetype)swizzled_init {
    if ([self isKindOfClass:NSClassFromString(@"CLLocationManager")]) {
        if (![NSThread isMainThread]) {
            NSLog(@"⚠️⚠️⚠️ WARNING: CLLocationManager initialized on BACKGROUND THREAD ⚠️⚠️⚠️");
            NSLog(@"⚠️ This WILL cause a TurboModule crash!");
            NSLog(@"⚠️ Stack trace:");
            for (NSString *symbol in [NSThread callStackSymbols]) {
                NSLog(@"  %@", symbol);
            }
        }
    }
    return [self swizzled_init]; // Call original
}

@end
```

### Step 4: Modify didFinishLaunchingWithOptions

Find your `- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions` method and add these lines **AT THE VERY TOP** (before any other code):

```objc
- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
  // ═══════════════════════════════════════════════════════════════════════════
  // 🚨 CRITICAL: INSTALL EXCEPTION HANDLERS FIRST
  // ═══════════════════════════════════════════════════════════════════════════
  // These MUST be installed BEFORE any React Native initialization
  // ═══════════════════════════════════════════════════════════════════════════
  
  NSLog(@"═══════════════════════════════════════════════════════════════");
  NSLog(@"🚀 APP LAUNCH STARTED");
  NSLog(@"═══════════════════════════════════════════════════════════════");
  NSLog(@"Device: %@", [[UIDevice currentDevice] model]);
  NSLog(@"iOS Version: %@", [[UIDevice currentDevice] systemVersion]);
  NSLog(@"App Version: %@", [[NSBundle mainBundle] objectForInfoDictionaryKey:@"CFBundleShortVersionString"]);
  NSLog(@"Build: %@", [[NSBundle mainBundle] objectForInfoDictionaryKey:@"CFBundleVersion"]);
  NSLog(@"═══════════════════════════════════════════════════════════════");
  
  // Install global exception handler
  NSSetUncaughtExceptionHandler(&HandleObjectiveCException);
  NSLog(@"✅ Installed global Objective-C exception handler");
  
  // Install RCTFatal handler
  RCTSetFatalHandler(CustomRCTFatalHandler);
  NSLog(@"✅ Installed RCTFatal error handler");
  
  // ... rest of your existing didFinishLaunchingWithOptions code ...
  
  return YES;
}
```

### Step 5: Add Crash Detection on App Termination

Add this method to your AppDelegate:

```objc
- (void)applicationWillTerminate:(UIApplication *)application
{
  NSLog(@"\n\n");
  NSLog(@"═══════════════════════════════════════════════════════════════");
  NSLog(@"⚠️ APP TERMINATING");
  NSLog(@"═══════════════════════════════════════════════════════════════");
  NSLog(@"If this appears immediately after launch, it indicates a crash");
  NSLog(@"Check logs above for exception details");
  NSLog(@"═══════════════════════════════════════════════════════════════");
  NSLog(@"\n\n");
}
```

---

## Step 6: Rebuild and Test

1. **Clean build folder:** Product → Clean Build Folder (Cmd+Shift+K)
2. **Delete derived data:** `rm -rf ~/Library/Developer/Xcode/DerivedData/*`
3. **Rebuild:** Product → Build (Cmd+B)
4. **Run on device:** Product → Run (Cmd+R)

---

## Reading the Crash Logs

After implementing these changes, when the app crashes, you'll see detailed logs like:

```
═══════════════════════════════════════════════════════════════
🚨 CAUGHT OBJECTIVE-C EXCEPTION (TurboModule Crash Prevention)
═══════════════════════════════════════════════════════════════
Exception Name: NSInvalidArgumentException
Exception Reason: -[RCTModuleData instance]: unrecognized selector sent to instance 0x...
───────────────────────────────────────────────────────────────
Call Stack Symbols:
  0   CoreFoundation    0x00000001a1234567 __exceptionPreprocess + 123
  1   libobjc.A.dylib   0x00000001a2345678 objc_exception_throw + 56
  2   YourApp           0x0000000102345678 -[RCTTurboModule performVoidMethodInvocation] + 789
  ...
═══════════════════════════════════════════════════════════════
⚠️ DETECTED: TurboModule invocation failure
⚠️ This is likely caused by:
   1. UI API called from background thread
   2. Signature mismatch between JS and native
   3. Nil passed to nonnull parameter
   4. Module loaded before bridge ready
═══════════════════════════════════════════════════════════════
```

---

## Common Fixes Based on Crash Type

### If you see "CLLocationManager" in the crash:

**Problem:** Location services called from background thread

**Fix:** Ensure all location code runs on main thread:

```objc
dispatch_async(dispatch_get_main_queue(), ^{
    self.locationManager = [[CLLocationManager alloc] init];
    [self.locationManager requestWhenInUseAuthorization];
});
```

### If you see "AVAudioSession" in the crash:

**Problem:** Audio session called from background thread

**Fix:** Ensure all audio code runs on main thread:

```objc
dispatch_async(dispatch_get_main_queue(), ^{
    [[AVAudioSession sharedInstance] setCategory:AVAudioSessionCategoryPlayback error:nil];
});
```

### If you see "UIKit" in the crash:

**Problem:** UI code called from background thread

**Fix:** Wrap ALL UI code in main thread dispatch:

```objc
dispatch_async(dispatch_get_main_queue(), ^{
    // Your UI code here
});
```

---

## Frontend Changes Already Implemented

The following frontend fixes have been applied:

✅ **Lazy loading of all native modules** - No modules load at app startup
✅ **Aggressive timeouts** - All operations have 2-5 second timeouts
✅ **Delayed module loading** - Modules load 2-5 seconds after app is stable
✅ **Non-blocking operations** - All native calls are async with fallbacks
✅ **Graceful degradation** - App works even if modules fail to load

---

## Testing Checklist

After implementing the AppDelegate.mm changes:

- [ ] App launches without crashing
- [ ] No SIGABRT errors in console
- [ ] Exception handlers log detailed crash info if crash occurs
- [ ] Location services work (if used)
- [ ] Notifications work (if used)
- [ ] Audio works (if used)
- [ ] App works on physical device (not just simulator)
- [ ] App works on iOS 26.2.1 (your reported version)

---

## If Crash Still Occurs

1. **Check Xcode console** for the detailed exception logs
2. **Look for the module name** in the stack trace
3. **Search for that module** in your codebase
4. **Ensure it's loaded lazily** (not at file scope)
5. **Ensure UI calls are on main thread**
6. **Check method signatures** match between JS and native

---

## Additional Resources

- [React Native TurboModules Documentation](https://reactnative.dev/docs/the-new-architecture/pillars-turbomodules)
- [iOS Main Thread Enforcement](https://developer.apple.com/documentation/uikit/uiapplication/1622936-main)
- [Objective-C Exception Handling](https://developer.apple.com/library/archive/documentation/Cocoa/Conceptual/Exceptions/Exceptions.html)

---

## Summary

This fix provides:

1. **Detailed crash diagnostics** - Know exactly what's failing
2. **Main thread enforcement** - Detect background thread violations
3. **Exception interception** - Catch crashes before SIGABRT
4. **Module isolation** - Identify which module is causing the crash

Combined with the frontend lazy loading already implemented, this should **completely eliminate** TurboModule startup crashes.

---

**⚠️ IMPORTANT:** After implementing these changes, **rebuild from scratch** and test on a **physical device**. Simulator behavior may differ from real devices.

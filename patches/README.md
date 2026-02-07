
# React Native Patches

This directory contains patches applied to `node_modules` packages using `patch-package`.

## Why Patches?

Patches are used to modify third-party packages when:
1. A bug fix is needed before the official package is updated
2. Custom functionality is required for the project
3. Diagnostic instrumentation needs to be added

## Current Patches

### react-native+0.81.5.patch

**Purpose:** iOS TurboModule Crash Diagnostic Instrumentation

**What it does:**
- Adds logging to `RCTTurboModule.mm` to track every TurboModule invocation
- Logs module name, method name, and argument count before execution
- Helps identify which TurboModule causes SIGABRT crashes

**Why it's needed:**
- iOS TurboModule crashes (SIGABRT) occur at the native level
- Without instrumentation, it's impossible to identify the crashing module
- The last `[TurboModuleInvoke]` log before crash identifies the culprit

**File modified:**
```
node_modules/react-native/ReactCommon/react/nativemodule/core/platform/ios/RCTTurboModule.mm
```

**Changes:**
- Added logging at line ~441 in `performVoidMethodInvocation` method
- Logs are visible in device console (Xcode > Devices > Console)
- Logs appear in Release/TestFlight builds (not just development)

**Example output:**
```
[TurboModuleInvoke] Module: RCTSecureStore
[TurboModuleInvoke] Method: setItemAsync:value:options:resolver:rejecter:
[TurboModuleInvoke] Arguments: 5
```

**How to verify patch is applied:**
```bash
# Check if patch file exists
ls patches/react-native+0.81.5.patch

# Check if patch is applied to node_modules
grep "TurboModuleInvoke" node_modules/react-native/ReactCommon/react/nativemodule/core/platform/ios/RCTTurboModule.mm
```

**Expected:** Should see the logging code in the file.

## How Patches Work

### Automatic Application

Patches are automatically applied when you run:
```bash
npm install
```

This is configured in `package.json`:
```json
{
  "scripts": {
    "postinstall": "patch-package"
  }
}
```

### Manual Application

If patches are not applied automatically:
```bash
# Apply all patches
npx patch-package

# Apply specific patch
npx patch-package react-native
```

### Creating New Patches

If you need to modify a package:

1. **Make changes** to the file in `node_modules`:
   ```bash
   # Example: Edit React Native file
   code node_modules/react-native/ReactCommon/react/nativemodule/core/platform/ios/RCTTurboModule.mm
   ```

2. **Create patch**:
   ```bash
   npx patch-package react-native
   ```

3. **Commit patch file**:
   ```bash
   git add patches/react-native+0.81.5.patch
   git commit -m "Add TurboModule logging patch"
   ```

4. **Verify patch works**:
   ```bash
   # Clean install
   rm -rf node_modules
   npm install
   
   # Check if patch was applied
   grep "TurboModuleInvoke" node_modules/react-native/ReactCommon/react/nativemodule/core/platform/ios/RCTTurboModule.mm
   ```

## Troubleshooting

### Patch Not Applied

**Symptom:** Changes are not present in `node_modules` after `npm install`

**Solutions:**
1. Check `postinstall` script exists in `package.json`
2. Run `npm run postinstall` manually
3. Delete `node_modules` and reinstall: `rm -rf node_modules && npm install`

### Patch Fails to Apply

**Symptom:** Error during `npm install` about patch failing

**Causes:**
- Package version changed (patch is for specific version)
- Package file structure changed
- Patch file is corrupted

**Solutions:**
1. Check package version matches patch filename
2. Recreate patch from scratch
3. Update patch for new package version

### Patch Not Included in Build

**Symptom:** Logging doesn't appear in TestFlight build

**Solutions:**
1. Verify patch is applied: `grep "TurboModuleInvoke" node_modules/react-native/ReactCommon/react/nativemodule/core/platform/ios/RCTTurboModule.mm`
2. Clean prebuild: `npx expo prebuild --clean`
3. Rebuild: `eas build --platform ios --profile production`

## Best Practices

1. **Document patches** - Always add comments explaining why the patch exists
2. **Keep patches minimal** - Only change what's necessary
3. **Test thoroughly** - Verify patch works in development and production
4. **Plan for removal** - Patches should be temporary until official fix is available
5. **Version control** - Always commit patch files to git

## Maintenance

### When to Update Patches

- Package version is upgraded
- Official fix is released (remove patch)
- Bug is fixed upstream (remove patch)
- New functionality is needed (update patch)

### How to Remove Patches

1. **Delete patch file**:
   ```bash
   rm patches/react-native+0.81.5.patch
   ```

2. **Clean install**:
   ```bash
   rm -rf node_modules
   npm install
   ```

3. **Verify removal**:
   ```bash
   # Should NOT find the patched code
   grep "TurboModuleInvoke" node_modules/react-native/ReactCommon/react/nativemodule/core/platform/ios/RCTTurboModule.mm
   ```

## Related Documentation

- **Diagnostic Guide:** `../TURBOMODULE_CRASH_DIAGNOSTIC_GUIDE.md`
- **Quick Reference:** `../CRASH_DIAGNOSTIC_QUICK_REFERENCE.md`
- **Testing Guide:** `../CRASH_TESTING_GUIDE.md`
- **Implementation Summary:** `../IMPLEMENTATION_SUMMARY.md`

## Support

If you have questions about patches:
1. Check this README
2. Review the patch file itself
3. Check `patch-package` documentation: https://github.com/ds300/patch-package

---

**Last Updated:** 2026-02-06  
**Maintained by:** Development Team

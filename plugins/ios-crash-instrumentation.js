
const { withAppDelegate } = require('@expo/config-plugins');

/**
 * Expo Config Plugin: iOS Native Crash Instrumentation
 * 
 * Injects fatal exception handlers into AppDelegate to capture TurboModule crashes
 * before SIGABRT. This allows us to see the actual Objective-C exception reason
 * in TestFlight crash logs.
 * 
 * Captures:
 * - NSSetUncaughtExceptionHandler (Objective-C exceptions)
 * - RCTSetFatalHandler (React Native fatal errors)
 * - RCTSetFatalExceptionHandler (React Native exceptions)
 */
module.exports = function withIOSCrashInstrumentation(config) {
  return withAppDelegate(config, (config) => {
    const { modResults } = config;
    let contents = modResults.contents;

    // Check if already instrumented
    if (contents.includes('CRASH_INSTRUMENTATION_INSTALLED')) {
      console.log('[iOS Crash Instrumentation] Already installed, skipping...');
      return config;
    }

    // Add imports at the top of the file (after existing imports)
    const importSection = `
// ═══════════════════════════════════════════════════════════════════════════
// CRASH INSTRUMENTATION - Captures fatal exceptions before SIGABRT
// ═══════════════════════════════════════════════════════════════════════════
#import <React/RCTLog.h>
#import <React/RCTAssert.h>
#define CRASH_INSTRUMENTATION_INSTALLED 1
`;

    // Find the last import statement
    const lastImportIndex = contents.lastIndexOf('#import');
    if (lastImportIndex !== -1) {
      const insertPosition = contents.indexOf('\n', lastImportIndex) + 1;
      contents = contents.slice(0, insertPosition) + importSection + contents.slice(insertPosition);
    }

    // Add crash handler functions before @implementation
    const crashHandlers = `
// ═══════════════════════════════════════════════════════════════════════════
// CRASH HANDLER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Uncaught Objective-C Exception Handler
 * Captures exceptions that would normally cause SIGABRT without logging
 */
void UncaughtExceptionHandler(NSException *exception) {
  NSLog(@"═══════════════════════════════════════════════════════════════════════════");
  NSLog(@"❌ FATAL: UNCAUGHT OBJECTIVE-C EXCEPTION");
  NSLog(@"═══════════════════════════════════════════════════════════════════════════");
  NSLog(@"Exception Name: %@", exception.name);
  NSLog(@"Exception Reason: %@", exception.reason);
  NSLog(@"Exception User Info: %@", exception.userInfo);
  NSLog(@"Call Stack Symbols:");
  for (NSString *symbol in [exception callStackSymbols]) {
    NSLog(@"  %@", symbol);
  }
  NSLog(@"═══════════════════════════════════════════════════════════════════════════");
  
  // Write to file for persistence across crashes
  NSArray *paths = NSSearchPathForDirectoriesInDomains(NSDocumentDirectory, NSUserDomainMask, YES);
  NSString *documentsDirectory = [paths firstObject];
  NSString *crashLogPath = [documentsDirectory stringByAppendingPathComponent:@"crash_log.txt"];
  
  NSString *crashLog = [NSString stringWithFormat:@"\\n\\n═══ CRASH AT %@ ═══\\nException: %@\\nReason: %@\\nStack:\\n%@\\n",
                        [NSDate date],
                        exception.name,
                        exception.reason,
                        [[exception callStackSymbols] componentsJoinedByString:@"\\n"]];
  
  NSFileHandle *fileHandle = [NSFileHandle fileHandleForWritingAtPath:crashLogPath];
  if (fileHandle) {
    [fileHandle seekToEndOfFile];
    [fileHandle writeData:[crashLog dataUsingEncoding:NSUTF8StringEncoding]];
    [fileHandle closeFile];
  } else {
    [crashLog writeToFile:crashLogPath atomically:YES encoding:NSUTF8StringEncoding error:nil];
  }
}

/**
 * React Native Fatal Handler
 * Captures RN fatal errors before app terminates
 */
void RCTFatalHandlerWithException(NSError *error, NSException *exception) {
  NSLog(@"═══════════════════════════════════════════════════════════════════════════");
  NSLog(@"❌ FATAL: REACT NATIVE FATAL ERROR");
  NSLog(@"═══════════════════════════════════════════════════════════════════════════");
  
  if (error) {
    NSLog(@"Error Domain: %@", error.domain);
    NSLog(@"Error Code: %ld", (long)error.code);
    NSLog(@"Error Description: %@", error.localizedDescription);
    NSLog(@"Error User Info: %@", error.userInfo);
  }
  
  if (exception) {
    NSLog(@"Exception Name: %@", exception.name);
    NSLog(@"Exception Reason: %@", exception.reason);
    NSLog(@"Exception User Info: %@", exception.userInfo);
    NSLog(@"Call Stack Symbols:");
    for (NSString *symbol in [exception callStackSymbols]) {
      NSLog(@"  %@", symbol);
    }
  }
  
  NSLog(@"═══════════════════════════════════════════════════════════════════════════");
  
  // Write to file
  NSArray *paths = NSSearchPathForDirectoriesInDomains(NSDocumentDirectory, NSUserDomainMask, YES);
  NSString *documentsDirectory = [paths firstObject];
  NSString *crashLogPath = [documentsDirectory stringByAppendingPathComponent:@"crash_log.txt"];
  
  NSString *crashLog = [NSString stringWithFormat:@"\\n\\n═══ RN FATAL AT %@ ═══\\nError: %@\\nException: %@\\nReason: %@\\n",
                        [NSDate date],
                        error ? error.localizedDescription : @"(none)",
                        exception ? exception.name : @"(none)",
                        exception ? exception.reason : @"(none)"];
  
  NSFileHandle *fileHandle = [NSFileHandle fileHandleForWritingAtPath:crashLogPath];
  if (fileHandle) {
    [fileHandle seekToEndOfFile];
    [fileHandle writeData:[crashLog dataUsingEncoding:NSUTF8StringEncoding]];
    [fileHandle closeFile];
  } else {
    [crashLog writeToFile:crashLogPath atomically:YES encoding:NSUTF8StringEncoding error:nil];
  }
}
`;

    // Find @implementation AppDelegate
    const implementationIndex = contents.indexOf('@implementation AppDelegate');
    if (implementationIndex !== -1) {
      contents = contents.slice(0, implementationIndex) + crashHandlers + '\n' + contents.slice(implementationIndex);
    }

    // Add crash handler installation in didFinishLaunchingWithOptions
    const installHandlers = `
  // ═══════════════════════════════════════════════════════════════════════════
  // INSTALL CRASH HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════
  NSLog(@"[AppDelegate] Installing crash instrumentation handlers...");
  
  // Install Objective-C exception handler
  NSSetUncaughtExceptionHandler(&UncaughtExceptionHandler);
  NSLog(@"[AppDelegate] ✅ NSSetUncaughtExceptionHandler installed");
  
  // Install React Native fatal handlers
  RCTSetFatalHandler(^(NSError *error) {
    RCTFatalHandlerWithException(error, nil);
  });
  NSLog(@"[AppDelegate] ✅ RCTSetFatalHandler installed");
  
  // Install React Native exception handler (if available)
  #if __has_include(<React/RCTAssert.h>)
  RCTSetFatalExceptionHandler(^(NSException *exception) {
    RCTFatalHandlerWithException(nil, exception);
  });
  NSLog(@"[AppDelegate] ✅ RCTSetFatalExceptionHandler installed");
  #endif
  
  NSLog(@"[AppDelegate] ═══════════════════════════════════════════════════════════════");
  NSLog(@"[AppDelegate] ✅ CRASH INSTRUMENTATION ACTIVE");
  NSLog(@"[AppDelegate] All fatal exceptions will be logged before SIGABRT");
  NSLog(@"[AppDelegate] ═══════════════════════════════════════════════════════════════");
`;

    // Find the didFinishLaunchingWithOptions method and add handlers at the start
    const didFinishIndex = contents.indexOf('- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions');
    if (didFinishIndex !== -1) {
      // Find the opening brace of the method
      const openBraceIndex = contents.indexOf('{', didFinishIndex);
      if (openBraceIndex !== -1) {
        contents = contents.slice(0, openBraceIndex + 1) + installHandlers + contents.slice(openBraceIndex + 1);
      }
    }

    modResults.contents = contents;
    return config;
  });
};

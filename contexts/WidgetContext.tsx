
import * as React from "react";
import { createContext, useCallback, useContext } from "react";
import { Platform } from "react-native";

// Only import ExtensionStorage on iOS native (not web)
let ExtensionStorage: any = null;
let storage: any = null;

// CRITICAL: Wrap in try-catch to prevent crashes
// Only initialize on iOS native platform (not web or Android)
if (Platform.OS === 'ios' && typeof window === 'undefined') {
  try {
    console.log('[WidgetContext] Attempting to load @bacons/apple-targets for iOS...');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const appleTargets = require("@bacons/apple-targets");
    ExtensionStorage = appleTargets.ExtensionStorage;
    // Initialize storage with your group ID
    storage = new ExtensionStorage("group.com.<user_name>.<app_name>");
    console.log('[WidgetContext] ✅ Successfully loaded @bacons/apple-targets');
  } catch (error) {
    console.warn('[WidgetContext] ⚠️ Failed to load @bacons/apple-targets (non-critical):', error);
  }
}

type WidgetContextType = {
  refreshWidget: () => void;
};

const WidgetContext = createContext<WidgetContextType | null>(null);

export function WidgetProvider({ children }: { children: React.ReactNode }) {
  // Update widget state whenever what we want to show changes
  React.useEffect(() => {
    // CRITICAL: Wrap in try-catch to prevent crashes
    try {
      // Only run on iOS native with ExtensionStorage available
      if (Platform.OS === 'ios' && ExtensionStorage && typeof window === 'undefined') {
        try {
          console.log('[WidgetContext] Reloading iOS widget...');
          // set widget_state to null if we want to reset the widget
          // storage?.set("widget_state", null);

          // Refresh widget
          ExtensionStorage.reloadWidget();
          console.log('[WidgetContext] ✅ iOS widget reloaded successfully');
        } catch (error) {
          console.warn('[WidgetContext] ⚠️ Failed to reload widget (non-critical):', error);
        }
      } else {
        console.log('[WidgetContext] Widget refresh skipped (not iOS native or ExtensionStorage not available)');
      }
    } catch (error) {
      console.error('[WidgetContext] ❌ Widget effect error (non-critical):', error);
    }
  }, []);

  const refreshWidget = useCallback(() => {
    // CRITICAL: Wrap in try-catch to prevent crashes
    try {
      // Only run on iOS native with ExtensionStorage available
      if (Platform.OS === 'ios' && ExtensionStorage && typeof window === 'undefined') {
        try {
          console.log('[WidgetContext] Manually refreshing iOS widget...');
          ExtensionStorage.reloadWidget();
          console.log('[WidgetContext] ✅ iOS widget refreshed successfully');
        } catch (error) {
          console.warn('[WidgetContext] ⚠️ Failed to reload widget (non-critical):', error);
        }
      } else {
        console.log('[WidgetContext] Widget refresh skipped (not iOS native or ExtensionStorage not available)');
      }
    } catch (error) {
      console.error('[WidgetContext] ❌ Widget refresh error (non-critical):', error);
    }
  }, []);

  return (
    <WidgetContext.Provider value={{ refreshWidget }}>
      {children}
    </WidgetContext.Provider>
  );
}

export const useWidget = () => {
  const context = useContext(WidgetContext);
  if (!context) {
    throw new Error("useWidget must be used within a WidgetProvider");
  }
  return context;
};

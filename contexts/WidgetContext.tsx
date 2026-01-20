
import * as React from "react";
import { createContext, useCallback, useContext } from "react";
import { Platform } from "react-native";

// Only import ExtensionStorage on iOS
let ExtensionStorage: any = null;
let storage: any = null;

if (Platform.OS === 'ios') {
  try {
    const appleTargets = require("@bacons/apple-targets");
    ExtensionStorage = appleTargets.ExtensionStorage;
    // Initialize storage with your group ID
    storage = new ExtensionStorage("group.com.<user_name>.<app_name>");
  } catch (error) {
    console.warn('[WidgetContext] Failed to load @bacons/apple-targets:', error);
  }
}

type WidgetContextType = {
  refreshWidget: () => void;
};

const WidgetContext = createContext<WidgetContextType | null>(null);

export function WidgetProvider({ children }: { children: React.ReactNode }) {
  // Update widget state whenever what we want to show changes
  React.useEffect(() => {
    // Only run on iOS with ExtensionStorage available
    if (Platform.OS === 'ios' && ExtensionStorage) {
      try {
        // set widget_state to null if we want to reset the widget
        // storage?.set("widget_state", null);

        // Refresh widget
        ExtensionStorage.reloadWidget();
      } catch (error) {
        console.warn('[WidgetContext] Failed to reload widget:', error);
      }
    }
  }, []);

  const refreshWidget = useCallback(() => {
    // Only run on iOS with ExtensionStorage available
    if (Platform.OS === 'ios' && ExtensionStorage) {
      try {
        ExtensionStorage.reloadWidget();
      } catch (error) {
        console.warn('[WidgetContext] Failed to reload widget:', error);
      }
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

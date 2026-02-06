
import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Platform } from 'react-native';

interface WidgetContextType {
  refreshWidget: () => Promise<void>;
}

const WidgetContext = createContext<WidgetContextType | undefined>(undefined);

export function WidgetProvider({ children }: { children: ReactNode }) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refreshWidget = useCallback(async () => {
    // Widgets only work on iOS
    if (Platform.OS !== 'ios') {
      console.log('[Widget] Widgets not supported on this platform');
      return;
    }

    // Prevent concurrent refreshes
    if (isRefreshing) {
      console.log('[Widget] Refresh already in progress');
      return;
    }

    setIsRefreshing(true);

    try {
      console.log('[Widget] Refreshing widget data...');
      
      // CRITICAL: Lazy load widget module with timeout
      const loadPromise = import('react-native-widgetkit');
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Widget module load timeout')), 2000)
      );
      
      const WidgetKit = await Promise.race([loadPromise, timeoutPromise]) as typeof import('react-native-widgetkit');
      
      await WidgetKit.reloadAllTimelines();
      console.log('[Widget] ✅ Widget refreshed successfully');
    } catch (error) {
      console.error('[Widget] ❌ Widget refresh failed (non-critical):', error);
      // Don't throw - widget refresh is non-critical
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing]);

  return (
    <WidgetContext.Provider value={{ refreshWidget }}>
      {children}
    </WidgetContext.Provider>
  );
}

export function useWidget() {
  const context = useContext(WidgetContext);
  if (context === undefined) {
    throw new Error('useWidget must be used within WidgetProvider');
  }
  return context;
}

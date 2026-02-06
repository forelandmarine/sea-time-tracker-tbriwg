
import "react-native-reanimated";
import React, { useEffect, useState } from "react";
import { Stack, useRouter, useSegments, usePathname } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useColorScheme, Alert, Platform, View, Text } from "react-native";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import {
  DarkTheme,
  DefaultTheme,
  Theme,
  ThemeProvider,
} from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { WidgetProvider } from "@/contexts/WidgetContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { SubscriptionProvider } from "@/contexts/SubscriptionContext";
import { BACKEND_URL } from "@/utils/api";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// CRITICAL FIX: NO native module imports at file scope
// All native modules will be loaded AFTER app initialization
console.log('[App] ========== APP INITIALIZATION STARTED ==========');
console.log('[App] Platform:', Platform.OS);

// Prevent the splash screen from auto-hiding before asset loading is complete.
if (Platform.OS !== 'web') {
  console.log('[App] Preventing splash screen auto-hide...');
  SplashScreen.preventAutoHideAsync().catch((err) => {
    console.warn('[App] Could not prevent splash screen auto-hide:', err);
  });
}

export const unstable_settings = {
  initialRouteName: "index",
};

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const segments = useSegments();
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const [isNavigating, setIsNavigating] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [appFullyMounted, setAppFullyMounted] = useState(false);

  const [loaded, error] = useFonts({
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });

  useEffect(() => {
    if (error) {
      console.error('[App] ❌ Font loading error:', error);
      setInitError(`Font loading failed: ${error.message}`);
      // Hide splash screen even if fonts fail to load
      if (Platform.OS !== 'web') {
        SplashScreen.hideAsync().catch(() => {});
      }
    }
  }, [error]);

  useEffect(() => {
    if (loaded) {
      console.log('[App] ✅ Fonts loaded successfully');
      
      if (Platform.OS !== 'web') {
        console.log('[App] Hiding splash screen...');
        SplashScreen.hideAsync().catch((err) => {
          console.warn('[App] Error hiding splash screen:', err);
        });
      }
      
      console.log('[App] ========================================');
      console.log('[App] ✅ App Initialized');
      console.log('[App] Platform:', Platform.OS);
      console.log('[App] Backend URL:', BACKEND_URL || 'NOT CONFIGURED');
      console.log('[App] Backend configured:', !!BACKEND_URL);
      console.log('[App] ========================================');
      
      if (!BACKEND_URL) {
        console.warn('[App] ⚠️ WARNING: Backend URL is not configured!');
        console.warn('[App] The app may not function correctly without a backend.');
      }

      // Mark app as fully mounted
      setAppFullyMounted(true);
    }
  }, [loaded]);

  // CRITICAL FIX: Load native modules AFTER app is fully mounted
  useEffect(() => {
    if (!appFullyMounted || Platform.OS === 'web') {
      return;
    }

    console.log('[App] App fully mounted, loading native modules...');

    // Load SystemBars (non-blocking)
    (async () => {
      try {
        const { SystemBars } = await import('react-native-edge-to-edge');
        console.log('[App] ✅ SystemBars loaded');
        // SystemBars will be rendered in JSX below
      } catch (error) {
        console.warn('[App] ⚠️ Failed to load SystemBars (non-critical):', error);
      }
    })();

    // Load and setup notifications (non-blocking, with delay)
    setTimeout(async () => {
      try {
        console.log('[App] Loading notification modules...');
        const { registerForPushNotificationsAsync } = await import('@/utils/notifications');
        
        const granted = await registerForPushNotificationsAsync();
        if (granted) {
          console.log('[App] ✅ Notification permissions granted');
        } else {
          console.log('[App] ⚠️ Notification permissions not granted');
        }
      } catch (error) {
        console.error('[App] ❌ Notification setup error (non-blocking):', error);
      }
    }, 2000); // 2 second delay to ensure app is stable

    // Load network state monitoring (non-blocking, with delay)
    setTimeout(async () => {
      try {
        console.log('[App] Loading network monitoring...');
        const { useNetworkState } = await import('expo-network');
        // Network state will be checked in a separate effect
        console.log('[App] ✅ Network monitoring loaded');
      } catch (error) {
        console.warn('[App] ⚠️ Failed to load network monitoring (non-critical):', error);
      }
    }, 3000); // 3 second delay

  }, [appFullyMounted]);

  // Simplified authentication routing - Let index.tsx handle redirects
  useEffect(() => {
    if (!loaded || loading || isNavigating) {
      return;
    }

    const inAuthGroup = segments[0] === '(tabs)';
    const isAuthScreen = pathname === '/auth';
    const isIndexRoute = pathname === '/' || pathname === '';

    console.log('[App] Auth routing check:', { 
      user: !!user, 
      inAuthGroup,
      isAuthScreen,
      isIndexRoute,
      pathname,
      platform: Platform.OS
    });

    // Let index route handle its own redirect
    if (isIndexRoute) {
      return;
    }

    // Only protect tab routes - redirect to auth if not authenticated
    // Add a small delay to ensure user state is fully updated
    if (!user && inAuthGroup && !isNavigating) {
      console.log('[App] ⚠️ User not authenticated but in tabs, redirecting to /auth');
      setIsNavigating(true);
      
      // Use a longer timeout to ensure state updates complete
      setTimeout(() => {
        try {
          router.replace('/auth');
        } catch (navError) {
          console.error('[App] Navigation error:', navError);
          // Fallback to push if replace fails
          try {
            router.push('/auth');
          } catch (pushError) {
            console.error('[App] Push navigation also failed:', pushError);
          }
        } finally {
          setIsNavigating(false);
        }
      }, 200);
    }
  }, [user, loading, loaded, pathname, segments, isNavigating, router]);

  // Show error screen if initialization failed
  if (initError) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colorScheme === 'dark' ? '#000' : '#fff', padding: 20 }}>
        <Text style={{ fontSize: 18, color: 'red', marginBottom: 10, textAlign: 'center' }}>Initialization Error</Text>
        <Text style={{ fontSize: 14, color: colorScheme === 'dark' ? '#999' : '#666', textAlign: 'center' }}>
          {initError}
        </Text>
        <Text style={{ fontSize: 12, color: colorScheme === 'dark' ? '#666' : '#999', marginTop: 20, textAlign: 'center' }}>
          Please restart the app
        </Text>
      </View>
    );
  }

  // Show loading screen while fonts are loading OR auth is checking
  if (!loaded || loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colorScheme === 'dark' ? '#000' : '#fff' }}>
        <Text style={{ fontSize: 18, color: colorScheme === 'dark' ? '#fff' : '#000', marginBottom: 10 }}>SeaTime Tracker</Text>
        <Text style={{ fontSize: 14, color: colorScheme === 'dark' ? '#999' : '#666' }}>
          {!loaded ? 'Loading fonts...' : 'Checking authentication...'}
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colorScheme === 'dark' ? '#000' : '#fff', padding: 20 }}>
        <Text style={{ fontSize: 18, color: 'red', marginBottom: 10, textAlign: 'center' }}>Error Loading App</Text>
        <Text style={{ fontSize: 14, color: colorScheme === 'dark' ? '#999' : '#666', textAlign: 'center' }}>
          {error.message || 'An error occurred while loading the app'}
        </Text>
        <Text style={{ fontSize: 12, color: colorScheme === 'dark' ? '#666' : '#999', marginTop: 20, textAlign: 'center' }}>
          Please restart the app
        </Text>
      </View>
    );
  }

  const CustomDefaultTheme: Theme = {
    ...DefaultTheme,
    dark: false,
    colors: {
      primary: "rgb(0, 122, 255)",
      background: "rgb(242, 242, 247)",
      card: "rgb(255, 255, 255)",
      text: "rgb(0, 0, 0)",
      border: "rgb(216, 216, 220)",
      notification: "rgb(255, 59, 48)",
    },
  };

  const CustomDarkTheme: Theme = {
    ...DarkTheme,
    colors: {
      primary: "rgb(10, 132, 255)",
      background: "rgb(1, 1, 1)",
      card: "rgb(28, 28, 30)",
      text: "rgb(255, 255, 255)",
      border: "rgb(44, 44, 46)",
      notification: "rgb(255, 69, 58)",
    },
  };

  return (
    <>
      <StatusBar style="auto" animated />
      <ThemeProvider
        value={colorScheme === "dark" ? CustomDarkTheme : CustomDefaultTheme}
      >
        <GestureHandlerRootView style={{ flex: 1 }}>
          <Stack screenOptions={{ headerShown: false }}>
            {/* Index/Root Route */}
            <Stack.Screen 
              name="index" 
              options={{ 
                headerShown: false,
              }} 
            />

            {/* Authentication Screen */}
            <Stack.Screen 
              name="auth" 
              options={{ 
                headerShown: false,
                title: "Sign In",
              }} 
            />

            {/* Forgot Password Screen */}
            <Stack.Screen 
              name="forgot-password" 
              options={{ 
                headerShown: false,
                title: "Reset Password",
              }} 
            />

            {/* Subscription Paywall Screen */}
            <Stack.Screen 
              name="subscription-paywall" 
              options={{ 
                headerShown: false,
                title: "Subscribe",
              }} 
            />

            {/* Main app with tabs */}
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

            {/* Vessel detail screens */}
            <Stack.Screen 
              name="vessel/[id]" 
              options={{ 
                headerShown: false,
                presentation: 'card',
                headerBackTitle: 'Back',
              }} 
            />

            {/* Add Sea Time Entry screen - Full screen page with back button */}
            <Stack.Screen 
              name="add-sea-time" 
              options={{ 
                headerShown: false,
                presentation: 'card',
                headerBackTitle: 'Back',
              }} 
            />

            {/* Edit Sea Time Entry screen - Full screen page with back button */}
            <Stack.Screen 
              name="edit-sea-time" 
              options={{ 
                headerShown: false,
                presentation: 'card',
                headerBackTitle: 'Back',
              }} 
            />

            {/* User profile screen - Allow header to show */}
            <Stack.Screen 
              name="user-profile" 
              options={{ 
                presentation: 'card',
                headerBackTitle: 'Back',
              }} 
            />

            {/* MCA Requirements screen */}
            <Stack.Screen 
              name="mca-requirements" 
              options={{ 
                headerShown: false,
                presentation: 'card',
                headerBackTitle: 'Back',
              }} 
            />

            {/* Scheduled tasks screen */}
            <Stack.Screen 
              name="scheduled-tasks" 
              options={{ 
                headerShown: false,
                presentation: 'card',
                headerBackTitle: 'Back',
              }} 
            />

            {/* Notification settings screen */}
            <Stack.Screen 
              name="notification-settings" 
              options={{ 
                headerShown: false,
                presentation: 'card',
                headerBackTitle: 'Back',
              }} 
            />

            {/* Debug logs screen */}
            <Stack.Screen 
              name="debug/[vesselId]" 
              options={{ 
                headerShown: false,
                presentation: 'card',
                headerBackTitle: 'Back',
              }} 
            />

            {/* Reports screen */}
            <Stack.Screen 
              name="reports" 
              options={{ 
                headerShown: false,
                presentation: 'card',
                headerBackTitle: 'Back',
              }} 
            />

            {/* Admin verify screen */}
            <Stack.Screen 
              name="admin-verify" 
              options={{ 
                headerShown: false,
                presentation: 'card',
              }} 
            />

            {/* Admin investigate entry screen */}
            <Stack.Screen 
              name="admin-investigate-entry" 
              options={{ 
                headerShown: false,
                presentation: 'card',
                headerBackTitle: 'Back',
              }} 
            />

            {/* Test login screen */}
            <Stack.Screen 
              name="test-login" 
              options={{ 
                headerShown: false,
                presentation: 'card',
              }} 
            />

            {/* Vessel diagnostic screen */}
            <Stack.Screen 
              name="vessel-diagnostic" 
              options={{ 
                headerShown: false,
                presentation: 'card',
                headerBackTitle: 'Back',
              }} 
            />

            {/* Select pathway screen */}
            <Stack.Screen 
              name="select-pathway" 
              options={{ 
                headerShown: false,
                presentation: 'card',
                headerBackTitle: 'Back',
              }} 
            />

            {/* Admin generate samples screen */}
            <Stack.Screen 
              name="admin-generate-samples" 
              options={{ 
                headerShown: false,
                presentation: 'card',
                headerBackTitle: 'Back',
              }} 
            />

            {/* Admin update subscription screen */}
            <Stack.Screen 
              name="admin-update-subscription" 
              options={{ 
                headerShown: false,
                presentation: 'card',
                headerBackTitle: 'Back',
              }} 
            />

            {/* Admin activate subscriptions screen */}
            <Stack.Screen 
              name="admin-activate-subscriptions" 
              options={{ 
                headerShown: false,
                presentation: 'card',
                headerBackTitle: 'Back',
              }} 
            />

            {/* Modal Demo Screens */}
            <Stack.Screen
              name="modal"
              options={{
                presentation: "modal",
                title: "Standard Modal",
              }}
            />
            <Stack.Screen
              name="formsheet"
              options={{
                presentation: "formSheet",
                title: "Form Sheet Modal",
                sheetGrabberVisible: true,
                sheetAllowedDetents: [0.5, 0.8, 1.0],
                sheetCornerRadius: 20,
              }}
            />
            <Stack.Screen
              name="transparent-modal"
              options={{
                presentation: "transparentModal",
                headerShown: false,
              }}
            />

            {/* 404 Not Found */}
            <Stack.Screen 
              name="+not-found" 
              options={{ 
                headerShown: false,
              }} 
            />
          </Stack>
        </GestureHandlerRootView>
      </ThemeProvider>
    </>
  );
}

export default function RootLayout() {
  const [providerError, setProviderError] = useState<string | null>(null);

  // Catch any errors during provider initialization
  useEffect(() => {
    console.log('[App] Root layout mounted');
    
    // Set up global error handler (only on web)
    if (Platform.OS === 'web') {
      const errorHandler = (error: ErrorEvent) => {
        console.error('[App] Global error caught:', error);
        setProviderError(error.message);
      };

      window.addEventListener('error', errorHandler);
      return () => window.removeEventListener('error', errorHandler);
    }
  }, []);

  if (providerError) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000', padding: 20 }}>
        <Text style={{ fontSize: 18, color: 'red', marginBottom: 10, textAlign: 'center' }}>App Error</Text>
        <Text style={{ fontSize: 14, color: '#999', textAlign: 'center' }}>
          {providerError}
        </Text>
        <Text style={{ fontSize: 12, color: '#666', marginTop: 20, textAlign: 'center' }}>
          Please restart the app
        </Text>
      </View>
    );
  }

  // CRITICAL: Wrap providers in try-catch to catch initialization errors
  try {
    return (
      <ErrorBoundary>
        <AuthProvider>
          <SubscriptionProvider>
            <WidgetProvider>
              <RootLayoutNav />
            </WidgetProvider>
          </SubscriptionProvider>
        </AuthProvider>
      </ErrorBoundary>
    );
  } catch (error: any) {
    console.error('[App] ❌ CRITICAL ERROR during provider initialization:', error);
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000', padding: 20 }}>
        <Text style={{ fontSize: 18, color: 'red', marginBottom: 10, textAlign: 'center' }}>Critical Error</Text>
        <Text style={{ fontSize: 14, color: '#999', textAlign: 'center' }}>
          {error.message || 'Failed to initialize app'}
        </Text>
        <Text style={{ fontSize: 12, color: '#666', marginTop: 20, textAlign: 'center' }}>
          Please restart the app
        </Text>
      </View>
    );
  }
}

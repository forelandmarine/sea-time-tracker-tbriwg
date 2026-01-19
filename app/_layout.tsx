
import "react-native-reanimated";
import React, { useEffect } from "react";
import { useFonts } from "expo-font";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { SystemBars } from "react-native-edge-to-edge";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useColorScheme, Alert, Platform, View, Text } from "react-native";
import { useNetworkState } from "expo-network";
import * as Notifications from 'expo-notifications';
import {
  DarkTheme,
  DefaultTheme,
  Theme,
  ThemeProvider,
} from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { WidgetProvider } from "@/contexts/WidgetContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { BACKEND_URL } from "@/utils/api";
import { registerForPushNotificationsAsync } from "@/utils/notifications";

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  initialRouteName: "(tabs)",
};

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const networkState = useNetworkState();
  const router = useRouter();
  const segments = useSegments();
  const { user, loading } = useAuth();

  const [loaded] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
      console.log('[App] ✅ Backend URL configured:', BACKEND_URL);
      console.log('[App] ✅ App ready with authentication');
      
      // Request notification permissions (only on native platforms)
      if (Platform.OS !== 'web') {
        registerForPushNotificationsAsync().then((granted) => {
          if (granted) {
            console.log('[App] ✅ Notification permissions granted');
          } else {
            console.log('[App] ⚠️ Notification permissions not granted');
          }
        });
      } else {
        console.log('[App] ℹ️ Notifications not supported on web');
      }
    }
  }, [loaded]);

  // Handle authentication routing
  useEffect(() => {
    if (!loaded || loading) return;

    const inAuthGroup = segments[0] === '(tabs)';
    const isAuthScreen = segments[0] === 'auth';
    const isRootOrEmpty = segments.length === 0 || segments[0] === '';

    console.log('[App] Auth routing check:', { 
      user: !!user, 
      loading, 
      inAuthGroup,
      isAuthScreen,
      isRootOrEmpty,
      segments: segments.join('/'),
      platform: Platform.OS
    });

    // If user is not authenticated
    if (!user) {
      // Only redirect to auth if trying to access protected routes
      if (inAuthGroup) {
        console.log('[App] User not authenticated, redirecting to auth from tabs');
        router.replace('/auth');
      } else if (isRootOrEmpty) {
        // On initial load, redirect to auth
        console.log('[App] User not authenticated, redirecting to auth from root');
        router.replace('/auth');
      }
    } else {
      // User is authenticated
      if (isAuthScreen || isRootOrEmpty) {
        // Redirect authenticated users away from auth screen or root
        console.log('[App] User authenticated, redirecting to tabs');
        router.replace('/(tabs)');
      }
    }
  }, [user, loading, segments, loaded, router]);

  // Handle notification responses (when user taps on notification)
  // Only set up on native platforms
  useEffect(() => {
    if (Platform.OS === 'web') {
      console.log('[App] Skipping notification listeners on web');
      return;
    }

    console.log('[App] Setting up notification response listener');
    
    // Check if app was opened from a notification
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response?.notification) {
        console.log('[App] App opened from notification:', response.notification.request.content.data);
        const data = response.notification.request.content.data;
        
        // Navigate to confirmations tab if notification has the screen data
        if (data?.screen === 'confirmations' || data?.url) {
          console.log('[App] Navigating to confirmations tab from notification');
          setTimeout(() => {
            router.push('/(tabs)/confirmations');
          }, 500);
        }
      }
    }).catch((error) => {
      console.error('[App] Error checking last notification response:', error);
    });

    // Listen for notification taps while app is running
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      console.log('[App] Notification tapped:', response.notification.request.content.data);
      const data = response.notification.request.content.data;
      
      // Navigate to confirmations tab
      if (data?.screen === 'confirmations' || data?.url) {
        console.log('[App] Navigating to confirmations tab from notification tap');
        router.push('/(tabs)/confirmations');
      }
    });

    return () => {
      console.log('[App] Removing notification response listener');
      subscription.remove();
    };
  }, [router]);

  React.useEffect(() => {
    if (
      !networkState.isConnected &&
      networkState.isInternetReachable === false
    ) {
      Alert.alert(
        "You are offline",
        "You can keep using the app! Your changes will be saved locally and synced when you are back online."
      );
    }
  }, [networkState.isConnected, networkState.isInternetReachable]);

  if (!loaded || loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colorScheme === 'dark' ? '#000' : '#fff' }}>
        <Text style={{ fontSize: 18, color: colorScheme === 'dark' ? '#fff' : '#000', marginBottom: 10 }}>SeaTime Tracker</Text>
        <Text style={{ fontSize: 14, color: colorScheme === 'dark' ? '#999' : '#666' }}>Loading...</Text>
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
        <GestureHandlerRootView>
          <Stack>
            {/* Authentication Screen */}
            <Stack.Screen 
              name="auth" 
              options={{ 
                headerShown: false,
                title: "Sign In",
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
              }} 
            />

            {/* User profile screen */}
            <Stack.Screen 
              name="user-profile" 
              options={{ 
                headerShown: false,
                presentation: 'card',
              }} 
            />

            {/* MCA Requirements screen */}
            <Stack.Screen 
              name="mca-requirements" 
              options={{ 
                headerShown: false,
                presentation: 'card',
              }} 
            />

            {/* Scheduled tasks screen */}
            <Stack.Screen 
              name="scheduled-tasks" 
              options={{ 
                headerShown: false,
                presentation: 'card',
              }} 
            />

            {/* Debug logs screen */}
            <Stack.Screen 
              name="debug/[vesselId]" 
              options={{ 
                headerShown: false,
                presentation: 'card',
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

            {/* Test login screen */}
            <Stack.Screen 
              name="test-login" 
              options={{ 
                headerShown: false,
                presentation: 'card',
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
          </Stack>
          <SystemBars style={"auto"} />
        </GestureHandlerRootView>
      </ThemeProvider>
    </>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <WidgetProvider>
        <RootLayoutNav />
      </WidgetProvider>
    </AuthProvider>
  );
}

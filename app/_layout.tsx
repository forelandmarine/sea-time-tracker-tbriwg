
import "react-native-reanimated";
import React, { useEffect } from "react";
import { useFonts } from "expo-font";
import { Stack, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { SystemBars } from "react-native-edge-to-edge";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useColorScheme, Alert, Platform } from "react-native";
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
import { AuthProvider } from "@/contexts/AuthContext";
import { BACKEND_URL } from "@/utils/api";
import { registerForPushNotificationsAsync } from "@/utils/notifications";

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  initialRouteName: "(tabs)",
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const networkState = useNetworkState();
  const router = useRouter();
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

  if (!loaded) {
    return null;
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
        <AuthProvider>
          <WidgetProvider>
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
          </WidgetProvider>
        </AuthProvider>
      </ThemeProvider>
    </>
  );
}

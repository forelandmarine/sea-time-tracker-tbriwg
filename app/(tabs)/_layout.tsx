
import { Tabs, useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import { useColorScheme, View, Text, ActivityIndicator } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { user, loading } = useAuth();
  const { hasActiveSubscription, loading: subscriptionLoading } = useSubscription();
  const router = useRouter();

  // Check subscription status and redirect if needed
  useEffect(() => {
    if (!loading && !subscriptionLoading && user && !hasActiveSubscription) {
      console.log('[TabLayout] User does not have active subscription, redirecting to paywall');
      router.replace('/subscription-paywall');
    }
  }, [loading, subscriptionLoading, user, hasActiveSubscription, router]);

  // Show loading state while checking auth or subscription
  if (loading || subscriptionLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: isDark ? colors.background : colors.backgroundLight }}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ fontSize: 14, color: isDark ? '#999' : '#666', marginTop: 12 }}>Loading...</Text>
      </View>
    );
  }

  // If no user or no subscription, show a blank screen - redirects will handle navigation
  if (!user || !hasActiveSubscription) {
    return (
      <View style={{ flex: 1, backgroundColor: isDark ? colors.background : colors.backgroundLight }} />
    );
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: isDark ? '#98989D' : '#8E8E93',
        tabBarStyle: {
          backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
          height: 85,
          paddingBottom: 25,
          paddingTop: 10,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
        },
      }}
    >
      <Tabs.Screen
        name="(home)"
        options={{
          title: 'Sea Time',
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol
              ios_icon_name="sailboat.fill"
              android_material_icon_name="directions-boat"
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="logbook"
        options={{
          title: 'Logbook',
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol
              ios_icon_name="book.closed.fill"
              android_material_icon_name="menu-book"
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="confirmations"
        options={{
          title: 'Review',
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol
              ios_icon_name="checkmark.circle.fill"
              android_material_icon_name="check-circle"
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Reports',
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol
              ios_icon_name="doc.text.fill"
              android_material_icon_name="description"
              size={24}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}

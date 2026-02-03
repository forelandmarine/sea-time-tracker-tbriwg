
import { Tabs, useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import { useColorScheme, View, Text, ActivityIndicator } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { usePathname } from 'expo-router';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const { user, loading, triggerRefresh } = useAuth();
  const { hasActiveSubscription, subscriptionStatus, loading: subscriptionLoading } = useSubscription();
  const pathname = usePathname();

  // Trigger refresh when navigating between tabs (simulates back button behavior)
  useEffect(() => {
    console.log('[TabLayout] Navigation detected to:', pathname);
    console.log('[TabLayout] Triggering global refresh');
    triggerRefresh();
  }, [pathname, triggerRefresh]);

  // Redirect to paywall if subscription is inactive
  useEffect(() => {
    console.log('[TabLayout] ========== SUBSCRIPTION CHECK ==========');
    console.log('[TabLayout] Loading states:', { loading, subscriptionLoading });
    console.log('[TabLayout] User:', {
      hasUser: !!user,
      email: user?.email,
      subscription_status: user?.subscription_status,
    });
    console.log('[TabLayout] Context:', {
      subscriptionStatus: subscriptionStatus?.status,
      hasActiveSubscription,
    });
    console.log('[TabLayout] ==========================================');

    if (!loading && !subscriptionLoading && user && !hasActiveSubscription) {
      console.log('[TabLayout] ========== PAYWALL REDIRECT ==========');
      console.log('[TabLayout] ❌ User does not have active subscription');
      console.log('[TabLayout] User subscription_status:', user.subscription_status);
      console.log('[TabLayout] Context subscription status:', subscriptionStatus?.status);
      console.log('[TabLayout] Redirecting to paywall...');
      console.log('[TabLayout] ==========================================');
      router.replace('/subscription-paywall');
    } else if (!loading && !subscriptionLoading && user && hasActiveSubscription) {
      console.log('[TabLayout] ========== ACCESS GRANTED ==========');
      console.log('[TabLayout] ✅ User has active subscription');
      console.log('[TabLayout] Allowing access to tabs');
      console.log('[TabLayout] ==========================================');
    }
  }, [user, hasActiveSubscription, subscriptionStatus, loading, subscriptionLoading, router]);

  // Show loading state while checking auth or subscription
  if (loading || subscriptionLoading) {
    console.log('[TabLayout] Loading state:', { loading, subscriptionLoading });
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: isDark ? colors.background : colors.backgroundLight }}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ fontSize: 14, color: isDark ? '#999' : '#666', marginTop: 12 }}>
          {loading ? 'Checking authentication...' : 'Checking subscription...'}
        </Text>
      </View>
    );
  }

  // If no user or no active subscription, show a blank screen - redirects will handle navigation
  if (!user || !hasActiveSubscription) {
    console.log('[TabLayout] No user or no active subscription, showing blank screen');
    return (
      <View style={{ flex: 1, backgroundColor: isDark ? colors.background : colors.backgroundLight }} />
    );
  }

  console.log('[TabLayout] Rendering tabs for authenticated user with active subscription');

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


import { Tabs, Redirect } from 'expo-router';
import React from 'react';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import { useColorScheme, View, ActivityIndicator } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { user, loading } = useAuth();

  console.log('[TabLayout] Auth check - User:', user?.email, 'Loading:', loading);

  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: isDark ? '#000000' : '#F2F2F7' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // Redirect to auth screen if not logged in
  if (!user) {
    console.log('[TabLayout] No user found, redirecting to auth screen');
    return <Redirect href="/auth" />;
  }

  console.log('[TabLayout] User authenticated, showing tabs');

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

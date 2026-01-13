
import React from 'react';
import { Tabs } from 'expo-router/unstable-native-tabs';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import { useColorScheme } from 'react-native';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: isDark ? colors.textSecondaryDark : colors.textSecondary,
        tabBarStyle: {
          backgroundColor: isDark ? colors.backgroundDark : colors.background,
        },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="(home)"
        options={{
          title: 'Sea Time',
          tabBarIcon: ({ color }) => (
            <IconSymbol
              ios_icon_name="sailboat.fill"
              android_material_icon_name="directions-boat"
              size={28}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Reports',
          tabBarIcon: ({ color }) => (
            <IconSymbol
              ios_icon_name="chart.bar.fill"
              android_material_icon_name="assessment"
              size={28}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => (
            <IconSymbol
              ios_icon_name="gear"
              android_material_icon_name="settings"
              size={28}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}

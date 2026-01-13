
import { Tabs } from 'expo-router';
import React from 'react';
import FloatingTabBar from '@/components/FloatingTabBar';
import { Href } from 'expo-router';

interface TabBarItem {
  route: Href;
  label: string;
  ios_icon_name: string;
  android_material_icon_name: string;
}

export default function TabLayout() {
  const tabs: TabBarItem[] = [
    {
      route: '/(tabs)/(home)' as Href,
      label: 'Home',
      ios_icon_name: 'house.fill',
      android_material_icon_name: 'home',
    },
    {
      route: '/(tabs)/profile' as Href,
      label: 'Reports',
      ios_icon_name: 'doc.text.fill',
      android_material_icon_name: 'description',
    },
    {
      route: '/(tabs)/settings' as Href,
      label: 'Settings',
      ios_icon_name: 'gear',
      android_material_icon_name: 'settings',
    },
  ];

  return (
    <>
      <Tabs
        tabBar={() => <FloatingTabBar tabs={tabs} />}
        screenOptions={{
          headerShown: false,
        }}
      >
        <Tabs.Screen
          name="(home)"
          options={{
            title: 'Home',
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Reports',
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Settings',
          }}
        />
      </Tabs>
    </>
  );
}

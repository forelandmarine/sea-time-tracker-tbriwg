
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
      label: 'Sea Time',
      ios_icon_name: 'sailboat.fill',
      android_material_icon_name: 'directions-boat',
    },
    {
      route: '/(tabs)/profile' as Href,
      label: 'Reports',
      ios_icon_name: 'doc.text.fill',
      android_material_icon_name: 'description',
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
            title: 'Sea Time',
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Reports',
          }}
        />
      </Tabs>
    </>
  );
}

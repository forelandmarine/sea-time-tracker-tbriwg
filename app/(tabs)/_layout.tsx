
import { NativeTabs, Icon, Label } from 'expo-router/unstable-native-tabs';
import { Platform } from 'react-native';
import { colors } from '@/styles/commonStyles';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect } from 'react';
import { usePathname } from 'expo-router';

export default function TabLayout() {
  const { triggerRefresh } = useAuth();
  const pathname = usePathname();

  // Trigger refresh when navigating between tabs (simulates back button behavior)
  useEffect(() => {
    console.log('[TabLayout] Navigation detected to:', pathname);
    console.log('[TabLayout] Triggering global refresh');
    triggerRefresh();
  }, [pathname]);

  return (
    <NativeTabs>
      <NativeTabs.Trigger name="(home)">
        <Label>Home</Label>
        <Icon 
          sf={{ default: 'house', selected: 'house.fill' }} 
          drawable="home" 
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="logbook">
        <Label>Logbook</Label>
        <Icon 
          sf={{ default: 'book', selected: 'book.fill' }} 
          drawable="menu-book" 
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="confirmations">
        <Label>Confirmations</Label>
        <Icon 
          sf={{ default: 'checkmark.circle', selected: 'checkmark.circle.fill' }} 
          drawable="check-circle" 
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <Label>Profile</Label>
        <Icon 
          sf={{ default: 'person', selected: 'person.fill' }} 
          drawable="person" 
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

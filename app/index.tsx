
import { Redirect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { View, Text, useColorScheme, ActivityIndicator, Platform } from 'react-native';
import React, { useEffect, useState } from 'react';

// Check if we're in a browser environment (not SSR)
const isBrowser = typeof window !== 'undefined' && typeof window.document !== 'undefined' && typeof window.navigator !== 'undefined';

export default function Index() {
  const { user, loading } = useAuth();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Skip SSR on web
    if (Platform.OS === 'web' && !isBrowser) {
      console.log('[Index] Skipping mount during SSR');
      return;
    }

    console.log('[Index] Component mounted');
    console.log('[Index] Platform:', Platform.OS);
    console.log('[Index] Is Browser:', isBrowser);
    
    // Small delay to ensure everything is ready
    const timer = setTimeout(() => {
      setMounted(true);
    }, 50);
    
    return () => clearTimeout(timer);
  }, []);

  // Log state changes
  useEffect(() => {
    if (mounted) {
      console.log('[Index] State:', { user: !!user, loading, mounted });
    }
  }, [user, loading, mounted]);

  // Show loading state while checking authentication or mounting
  if (loading || !mounted) {
    return (
      <View style={{ 
        flex: 1, 
        justifyContent: 'center', 
        alignItems: 'center', 
        backgroundColor: isDark ? '#000' : '#fff'
      }}>
        <Text style={{ 
          fontSize: 24, 
          fontWeight: 'bold',
          color: isDark ? '#fff' : '#000',
          marginBottom: 20 
        }}>
          SeaTime Tracker
        </Text>
        <ActivityIndicator size="large" color={isDark ? '#fff' : '#000'} />
        <Text style={{ 
          fontSize: 14, 
          color: isDark ? '#999' : '#666',
          marginTop: 20
        }}>
          {loading ? 'Checking authentication...' : 'Initializing...'}
        </Text>
      </View>
    );
  }

  // Redirect based on authentication status
  if (user) {
    console.log('[Index] User authenticated, redirecting to /(tabs)');
    return <Redirect href="/(tabs)" />;
  }

  console.log('[Index] User not authenticated, redirecting to /auth');
  return <Redirect href="/auth" />;
}


import { Redirect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { View, Text, useColorScheme, ActivityIndicator, Platform } from 'react-native';
import React, { useEffect, useState } from 'react';

// Check if we're in a browser environment
const isBrowser = typeof window !== 'undefined' && typeof window.document !== 'undefined';

export default function Index() {
  const { user, loading } = useAuth();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [clientMounted, setClientMounted] = useState(false);

  // Wait for client-side mount on web
  useEffect(() => {
    if (Platform.OS === 'web') {
      if (isBrowser) {
        setClientMounted(true);
      }
    } else {
      setClientMounted(true);
    }
  }, []);

  console.log('[Index] Rendering - user:', !!user, 'loading:', loading, 'clientMounted:', clientMounted);

  // Show loading state while checking authentication or waiting for client mount
  if (loading || !clientMounted) {
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
          {!clientMounted ? 'Initializing...' : 'Checking authentication...'}
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

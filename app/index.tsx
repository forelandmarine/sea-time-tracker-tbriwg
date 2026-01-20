
import { Redirect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { View, Text, useColorScheme, ActivityIndicator, Platform } from 'react-native';
import React, { useEffect, useState } from 'react';

export default function Index() {
  const { user, loading } = useAuth();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [webMounted, setWebMounted] = useState(Platform.OS !== 'web');

  // Wait for web to fully mount before redirecting
  useEffect(() => {
    if (Platform.OS === 'web') {
      console.log('[Index] Web platform detected, waiting for mount...');
      const timer = setTimeout(() => {
        console.log('[Index] Web mounted');
        setWebMounted(true);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, []);

  console.log('[Index] Rendering - user:', !!user, 'loading:', loading, 'platform:', Platform.OS, 'webMounted:', webMounted);

  // Show loading state while checking authentication or waiting for web mount
  if (loading || !webMounted) {
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
          {!webMounted ? 'Initializing...' : 'Checking authentication...'}
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

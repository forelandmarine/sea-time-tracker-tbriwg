
import { Redirect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { View, Text, useColorScheme, ActivityIndicator, Platform } from 'react-native';
import { colors } from '@/styles/commonStyles';
import React, { useEffect, useState } from 'react';

export default function Index() {
  const { user, loading } = useAuth();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [mounted, setMounted] = useState(false);
  const [shouldRedirect, setShouldRedirect] = useState(false);

  useEffect(() => {
    // Skip SSR on web
    if (Platform.OS === 'web' && typeof window === 'undefined') {
      console.log('[Index] Skipping mount during SSR');
      return;
    }

    console.log('[Index] Component mounted');
    setMounted(true);
    
    // Log platform and environment info
    console.log('[Index] Platform:', Platform.OS);
    console.log('[Index] User:', !!user);
    console.log('[Index] Loading:', loading);
  }, []);

  // Wait for both mounted and loading to complete before redirecting
  useEffect(() => {
    if (mounted && !loading) {
      console.log('[Index] Ready to redirect, user:', !!user);
      
      // Add a small delay on web to ensure everything is ready
      if (Platform.OS === 'web') {
        setTimeout(() => {
          setShouldRedirect(true);
        }, 150);
      } else {
        setShouldRedirect(true);
      }
    }
  }, [mounted, loading, user]);

  console.log('[Index] Rendering index route', { 
    user: !!user, 
    loading, 
    mounted,
    shouldRedirect,
    platform: Platform.OS 
  });

  // Show loading state while checking authentication or mounting
  if (loading || !mounted || !shouldRedirect) {
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

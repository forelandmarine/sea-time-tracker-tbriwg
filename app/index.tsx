
import { Redirect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { View, Text, useColorScheme, ActivityIndicator, Platform } from 'react-native';
import React from 'react';

export default function Index() {
  const { user, loading } = useAuth();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  console.log('[Index] Rendering - user:', !!user, 'loading:', loading, 'platform:', Platform.OS);

  // Show loading state while checking authentication
  if (loading) {
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
          Checking authentication...
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

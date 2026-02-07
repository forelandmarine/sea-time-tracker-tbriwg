
import { Redirect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { colors } from '@/styles/commonStyles';
import React, { useEffect, useState } from 'react';

export default function Index() {
  const { isAuthenticated, loading: authLoading, user } = useAuth();
  const [initialCheckDone, setInitialCheckDone] = useState(false);

  // Wait for initial auth check to complete
  useEffect(() => {
    if (!authLoading) {
      // Add a small delay to prevent flicker
      const timer = setTimeout(() => {
        setInitialCheckDone(true);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [authLoading]);

  // Show loading while checking auth
  if (authLoading || !initialCheckDone) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  // Redirect based on auth state
  if (!isAuthenticated) {
    console.log('[Index] Not authenticated, redirecting to /auth');
    return <Redirect href="/auth" />;
  }

  // Check if user has department set
  const hasDepartment = user?.hasDepartment || (user as any)?.department;
  
  if (!hasDepartment) {
    console.log('[Index] No department set, redirecting to /select-pathway');
    return <Redirect href="/select-pathway" />;
  }

  console.log('[Index] Authenticated with department, redirecting to /(tabs)');
  return <Redirect href="/(tabs)" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.textSecondary,
  },
});

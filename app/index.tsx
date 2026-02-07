
import { Redirect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { colors } from '@/styles/commonStyles';
import React, { useEffect, useState } from 'react';
import * as seaTimeApi from '@/utils/seaTimeApi';

export default function Index() {
  const { isAuthenticated, loading: authLoading, checkAuth } = useAuth();
  const [checkingPathway, setCheckingPathway] = useState(false);
  const [hasDepartment, setHasDepartment] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Check auth once on mount
  useEffect(() => {
    checkAuth().finally(() => setInitialized(true));
  }, [checkAuth]);

  // Check user pathway after auth completes
  useEffect(() => {
    if (!initialized || authLoading || !isAuthenticated) {
      return;
    }

    const checkUserPathway = async () => {
      setCheckingPathway(true);
      
      try {
        const profile = await seaTimeApi.getUserProfile();
        setHasDepartment(!!profile.department);
      } catch (error) {
        console.error('[Index] Failed to check pathway:', error);
        // Allow user to proceed - they can set pathway later
        setHasDepartment(false);
      } finally {
        setCheckingPathway(false);
      }
    };

    checkUserPathway();
  }, [initialized, authLoading, isAuthenticated]);

  // Show loading while initializing
  if (!initialized || authLoading || (isAuthenticated && checkingPathway)) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  // Redirect based on auth state
  if (!isAuthenticated) {
    return <Redirect href="/auth" />;
  }

  if (!hasDepartment) {
    return <Redirect href="/select-pathway" />;
  }

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

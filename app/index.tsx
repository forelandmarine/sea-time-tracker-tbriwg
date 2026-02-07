
import { Redirect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { View, ActivityIndicator, StyleSheet, Text, InteractionManager } from 'react-native';
import { colors } from '@/styles/commonStyles';
import React, { useEffect, useState } from 'react';
import * as seaTimeApi from '@/utils/seaTimeApi';

export default function Index() {
  const { isAuthenticated, loading: authLoading, checkAuth } = useAuth();
  const [checkingPathway, setCheckingPathway] = useState(false);
  const [hasDepartment, setHasDepartment] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [readyToCheck, setReadyToCheck] = useState(false);

  // Wait for all interactions to complete before checking auth
  // This ensures native modules are fully initialized
  useEffect(() => {
    console.log('[Index] Waiting for interactions to complete before auth check...');
    
    const task = InteractionManager.runAfterInteractions(() => {
      console.log('[Index] ✅ Interactions complete, ready to check auth');
      setReadyToCheck(true);
    });

    return () => task.cancel();
  }, []);

  // Check auth only after interactions are complete
  useEffect(() => {
    if (!readyToCheck) {
      console.log('[Index] Not ready to check auth yet, waiting...');
      return;
    }

    console.log('[Index] Starting auth check...');
    checkAuth().finally(() => {
      console.log('[Index] Auth check complete');
      setInitialized(true);
    });
  }, [readyToCheck, checkAuth]);

  // Check user pathway after auth completes
  useEffect(() => {
    if (!initialized || authLoading || !isAuthenticated) {
      return;
    }

    const checkUserPathway = async () => {
      setCheckingPathway(true);
      
      try {
        console.log('[Index] Checking user pathway...');
        const profile = await seaTimeApi.getUserProfile();
        const hasDept = !!profile.department;
        console.log('[Index] User has department:', hasDept);
        setHasDepartment(hasDept);
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
  if (!readyToCheck || !initialized || authLoading || (isAuthenticated && checkingPathway)) {
    const loadingMessage = !readyToCheck 
      ? 'Initializing...' 
      : !initialized 
        ? 'Checking authentication...' 
        : checkingPathway 
          ? 'Loading profile...' 
          : 'Loading...';

    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>{loadingMessage}</Text>
      </View>
    );
  }

  // Redirect based on auth state
  if (!isAuthenticated) {
    console.log('[Index] Not authenticated, redirecting to /auth');
    return <Redirect href="/auth" />;
  }

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

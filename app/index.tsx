
import { Redirect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { View, ActivityIndicator, StyleSheet, Platform, Text } from 'react-native';
import { colors } from '@/styles/commonStyles';
import React, { useEffect, useState } from 'react';
import * as seaTimeApi from '@/utils/seaTimeApi';

export default function Index() {
  console.log('[Index] Component mounted, Platform:', Platform.OS);
  
  const { isAuthenticated, loading: authLoading, user, checkAuth } = useAuth();
  const [checkingPathway, setCheckingPathway] = useState(false);
  const [hasDepartment, setHasDepartment] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  console.log('[Index] Render - authLoading:', authLoading, 'isAuthenticated:', isAuthenticated, 'checkingPathway:', checkingPathway);

  // 🚨 CRITICAL FIX: Check auth on mount with delay
  useEffect(() => {
    if (authChecked) return;
    
    console.log('[Index] Checking auth on mount...');
    setAuthChecked(true);
    
    // Add delay to ensure app is stable before checking auth
    setTimeout(() => {
      checkAuth().catch((error) => {
        console.error('[Index] Auth check failed:', error);
        // Continue anyway - user will be redirected to auth screen
      });
    }, 1000);
  }, [authChecked, checkAuth]);

  useEffect(() => {
    console.log('[Index] useEffect triggered - authLoading:', authLoading, 'isAuthenticated:', isAuthenticated);
    
    const checkUserPathway = async () => {
      // Only check pathway if user is authenticated and auth is not loading
      if (authLoading) {
        console.log('[Index] Auth still loading, waiting...');
        return;
      }

      if (!isAuthenticated) {
        console.log('[Index] User not authenticated, skipping pathway check');
        setCheckingPathway(false);
        return;
      }

      console.log('[Index] User authenticated, checking pathway...');
      console.log('[Index] User data:', user);
      
      setCheckingPathway(true);
      
      try {
        // CRITICAL: Add longer delay to ensure auth state is fully settled
        // This prevents race conditions where the token isn't fully stored yet
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        console.log('[Index] Fetching user profile...');
        
        // CRITICAL: Add timeout to profile fetch to prevent hanging
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Profile fetch timeout')), 5000)
        );
        
        const profilePromise = seaTimeApi.getUserProfile();
        
        const profile = await Promise.race([profilePromise, timeoutPromise]) as any;
        console.log('[Index] Profile received:', profile);
        
        const hasSelectedDepartment = !!profile.department;
        console.log('[Index] User has department:', hasSelectedDepartment, profile.department);
        setHasDepartment(hasSelectedDepartment);
        setError(null);
      } catch (error: any) {
        console.error('[Index] Failed to check user pathway:', error);
        console.error('[Index] Error details:', error.message, error.name, error.stack);
        
        // CRITICAL: On ANY error, allow user to proceed to home
        // They can select pathway later from profile settings
        // This prevents the app from getting stuck on the loading screen
        console.log('[Index] Allowing user to proceed despite error (graceful degradation)');
        setHasDepartment(false);
        setError(error.message);
      } finally {
        console.log('[Index] Pathway check complete');
        setCheckingPathway(false);
      }
    };

    // CRITICAL: Wrap in try-catch to prevent any uncaught errors from crashing the app
    try {
      checkUserPathway();
    } catch (error: any) {
      console.error('[Index] CRITICAL: Uncaught error in checkUserPathway:', error);
      setCheckingPathway(false);
      setError(error.message);
    }
  }, [isAuthenticated, authLoading, user]);

  // Show loading while auth is checking or pathway is being verified
  if (authLoading || checkingPathway || !authChecked) {
    console.log('[Index] Showing loading screen - authLoading:', authLoading, 'checkingPathway:', checkingPathway, 'authChecked:', authChecked);
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>
          {!authChecked ? 'Starting up...' : authLoading ? 'Checking authentication...' : 'Loading profile...'}
        </Text>
      </View>
    );
  }

  // CRITICAL: Wrap all redirects in try-catch to prevent navigation crashes
  try {
    // If there was an error checking pathway, show error but still allow navigation
    if (error) {
      console.warn('[Index] Error occurred but allowing navigation:', error);
      // Continue to redirect based on auth status
    }

    // Redirect to auth if not authenticated
    if (!isAuthenticated) {
      console.log('[Index] User not authenticated, redirecting to /auth');
      return <Redirect href="/auth" />;
    }

    // Redirect to pathway selection if no department
    if (!hasDepartment && !error) {
      console.log('[Index] User has no department, redirecting to /select-pathway');
      return <Redirect href="/select-pathway" />;
    }

    // If there was an error, skip pathway check and go to home
    // User can select pathway later from profile
    console.log('[Index] User authenticated, redirecting to /(tabs)');
    return <Redirect href="/(tabs)" />;
  } catch (redirectError: any) {
    console.error('[Index] CRITICAL: Redirect error:', redirectError);
    // Show error screen instead of crashing
    return (
      <View style={styles.container}>
        <Text style={[styles.loadingText, { color: 'red' }]}>
          Navigation Error
        </Text>
        <Text style={[styles.loadingText, { fontSize: 14, marginTop: 8 }]}>
          {redirectError.message}
        </Text>
        <Text style={[styles.loadingText, { fontSize: 12, marginTop: 16 }]}>
          Please restart the app
        </Text>
      </View>
    );
  }
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

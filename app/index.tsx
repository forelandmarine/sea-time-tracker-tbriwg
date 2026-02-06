
import { Redirect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { View, ActivityIndicator, StyleSheet, Platform, Text } from 'react-native';
import { colors } from '@/styles/commonStyles';
import React, { useEffect, useState } from 'react';
import * as seaTimeApi from '@/utils/seaTimeApi';

export default function Index() {
  console.log('[Index] Component mounted, Platform:', Platform.OS);
  
  const { isAuthenticated, loading: authLoading, user } = useAuth();
  const [checkingPathway, setCheckingPathway] = useState(true);
  const [hasDepartment, setHasDepartment] = useState(false);
  const [error, setError] = useState<string | null>(null);

  console.log('[Index] Render - authLoading:', authLoading, 'isAuthenticated:', isAuthenticated, 'checkingPathway:', checkingPathway);

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
      
      try {
        // Add a small delay to ensure backend is ready
        await new Promise(resolve => setTimeout(resolve, 500));
        
        console.log('[Index] Fetching user profile...');
        const profile = await seaTimeApi.getUserProfile();
        console.log('[Index] Profile received:', profile);
        
        const hasSelectedDepartment = !!profile.department;
        console.log('[Index] User has department:', hasSelectedDepartment, profile.department);
        setHasDepartment(hasSelectedDepartment);
        setError(null);
      } catch (error: any) {
        console.error('[Index] Failed to check user pathway:', error);
        console.error('[Index] Error details:', error.message, error.name);
        
        // On error, assume no department and let user proceed
        // They'll be prompted to select pathway later if needed
        setHasDepartment(false);
        setError(error.message);
      } finally {
        console.log('[Index] Pathway check complete');
        setCheckingPathway(false);
      }
    };

    checkUserPathway();
  }, [isAuthenticated, authLoading, user]);

  // Show loading while auth is checking or pathway is being verified
  if (authLoading || checkingPathway) {
    console.log('[Index] Showing loading screen - authLoading:', authLoading, 'checkingPathway:', checkingPathway);
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>
          {authLoading ? 'Checking authentication...' : 'Loading profile...'}
        </Text>
      </View>
    );
  }

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

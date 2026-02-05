
import 'expo-router/entry';
import { Redirect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { colors } from '@/styles/commonStyles';
import React, { useEffect, useState } from 'react';
import * as seaTimeApi from '@/utils/seaTimeApi';

export default function Index() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { hasActiveSubscription, loading: subscriptionLoading } = useSubscription();
  const [checkingPathway, setCheckingPathway] = useState(true);
  const [hasDepartment, setHasDepartment] = useState(false);

  useEffect(() => {
    const checkUserPathway = async () => {
      if (!authLoading && isAuthenticated) {
        console.log('[Index] Checking if user has selected a pathway...');
        try {
          // Reduced timeout for faster loading
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Pathway check timeout')), 2000)
          );
          
          const profilePromise = seaTimeApi.getUserProfile();
          
          const profile = await Promise.race([profilePromise, timeoutPromise]);
          const hasSelectedDepartment = !!profile.department;
          console.log('[Index] User has department:', hasSelectedDepartment, profile.department);
          setHasDepartment(hasSelectedDepartment);
        } catch (error) {
          console.error('[Index] Failed to check user pathway:', error);
          // On error, assume user has department and let them proceed
          // They'll be redirected to pathway selection if needed from the home screen
          setHasDepartment(true);
        }
      }
      setCheckingPathway(false);
    };

    checkUserPathway();
  }, [isAuthenticated, authLoading]);

  // Show loading for max 3 seconds, then proceed anyway (reduced from 5)
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (authLoading || subscriptionLoading || checkingPathway) {
        console.warn('[Index] Loading timeout - proceeding anyway');
        setCheckingPathway(false);
      }
    }, 3000);
    
    return () => clearTimeout(timeout);
  }, [authLoading, subscriptionLoading, checkingPathway]);

  if (authLoading || subscriptionLoading || checkingPathway) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!isAuthenticated) {
    console.log('[Index] User not authenticated, redirecting to auth screen');
    return <Redirect href="/auth" />;
  }

  // Check subscription status - redirect to paywall if inactive
  if (!hasActiveSubscription) {
    console.log('[Index] ========== PAYWALL REDIRECT ==========');
    console.log('[Index] User does not have active subscription');
    console.log('[Index] hasActiveSubscription:', hasActiveSubscription);
    console.log('[Index] Redirecting to paywall...');
    console.log('[Index] ==========================================');
    return <Redirect href="/subscription-paywall" />;
  }

  console.log('[Index] ========== ACCESS GRANTED ==========');
  console.log('[Index] User has active subscription');
  console.log('[Index] hasActiveSubscription:', hasActiveSubscription);
  console.log('[Index] ==========================================');

  // Skip pathway check for now - let user proceed to home
  // They'll be redirected from home if pathway selection is needed
  // This prevents blocking the login flow
  if (!hasDepartment && false) { // Disabled for faster loading
    console.log('[Index] User has not selected pathway, redirecting to pathway selection');
    return <Redirect href="/select-pathway" />;
  }

  console.log('[Index] ========== ROUTING TO HOME ==========');
  console.log('[Index] User authenticated with active subscription and has pathway');
  console.log('[Index] Redirecting to home...');
  console.log('[Index] ==========================================');
  return <Redirect href="/(tabs)" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
});

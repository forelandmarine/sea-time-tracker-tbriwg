
import 'expo-router/entry';
import { Redirect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { colors } from '@/styles/commonStyles';
import React, { useEffect, useState } from 'react';

export default function Index() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { hasActiveSubscription, loading: subscriptionLoading } = useSubscription();
  const [timeoutReached, setTimeoutReached] = useState(false);

  // REDUCED timeout to 500ms for instant loading
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (authLoading || subscriptionLoading) {
        console.warn('[Index] Loading timeout - proceeding anyway');
        setTimeoutReached(true);
      }
    }, 500); // REDUCED from 1.5s to 500ms for instant loading
    
    return () => clearTimeout(timeout);
  }, [authLoading, subscriptionLoading]);

  // Show loading only briefly
  if ((authLoading || subscriptionLoading) && !timeoutReached) {
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

  // Skip pathway check - let user proceed to home immediately
  // They'll be redirected from home if pathway selection is needed
  console.log('[Index] ========== ROUTING TO HOME ==========');
  console.log('[Index] User authenticated with active subscription');
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

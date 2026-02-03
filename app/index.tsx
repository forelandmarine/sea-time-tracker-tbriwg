
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
          const profile = await seaTimeApi.getUserProfile();
          const hasSelectedDepartment = !!profile.department;
          console.log('[Index] User has department:', hasSelectedDepartment, profile.department);
          setHasDepartment(hasSelectedDepartment);
        } catch (error) {
          console.error('[Index] Failed to check user pathway:', error);
          setHasDepartment(false);
        }
      }
      setCheckingPathway(false);
    };

    checkUserPathway();
  }, [isAuthenticated, authLoading]);

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
    console.log('[Index] User does not have active subscription, redirecting to paywall');
    return <Redirect href="/subscription-paywall" />;
  }

  if (!hasDepartment) {
    console.log('[Index] User has not selected pathway, redirecting to pathway selection');
    return <Redirect href="/select-pathway" />;
  }

  console.log('[Index] User authenticated with active subscription and has pathway, redirecting to home');
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

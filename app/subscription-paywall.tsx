
/**
 * Subscription Paywall Screen
 * 
 * This screen displays subscription information and handles native iOS StoreKit purchases.
 * 
 * Features:
 * - Display subscription features and pricing (£4.99/€5.99 per month)
 * - Native iOS StoreKit integration for in-app purchases
 * - Receipt verification with backend
 * - Restore previous purchases
 * - Check subscription status
 * - Sign out option
 * 
 * Subscription Model:
 * - Price: £4.99/€5.99 per month
 * - No free trial period
 * - Users must subscribe to access the app
 * - Status: 'active' or 'inactive'
 * 
 * Backend Integration:
 * - POST /api/subscription/verify - Verify App Store receipt
 * - GET /api/subscription/status - Get current subscription status
 * - PATCH /api/subscription/pause-tracking - Pause tracking when subscription expires
 * 
 * StoreKit Integration:
 * - Product ID: com.forelandmarine.seatime.monthly
 * - Uses expo-store-kit for native iOS purchases
 * - Automatic receipt verification with Apple servers
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  useColorScheme,
  Platform,
  Linking,
  Modal,
  Alert,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useAuth } from '@/contexts/AuthContext';
import * as StoreKitUtils from '@/utils/storeKit';

export default function SubscriptionPaywallScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [loading, setLoading] = useState(false);
  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const [productPrice, setProductPrice] = useState<string>('£4.99/€5.99');
  const { subscriptionStatus, checkSubscription } = useSubscription();
  const { signOut } = useAuth();

  const initializeStore = useCallback(async () => {
    try {
      console.log('[SubscriptionPaywall] Initializing StoreKit');
      const initialized = await StoreKitUtils.initializeStoreKit();
      
      if (initialized) {
        const product = await StoreKitUtils.getProductInfo();
        if (product && product.price) {
          const formattedPrice = `${product.priceLocale?.currencySymbol || ''}${product.price}`;
          setProductPrice(formattedPrice);
          console.log('[SubscriptionPaywall] Product price:', formattedPrice);
        }
      }
    } catch (error: any) {
      console.error('[SubscriptionPaywall] Store initialization error:', error);
    }
  }, []);

  useEffect(() => {
    console.log('[SubscriptionPaywall] Screen mounted');
    console.log('[SubscriptionPaywall] Current subscription status:', subscriptionStatus?.status);
    
    // Initialize StoreKit and fetch product info
    if (Platform.OS === 'ios') {
      initializeStore();
    }
  }, [subscriptionStatus?.status, initializeStore]);

  const handleSubscribe = async () => {
    if (Platform.OS !== 'ios') {
      Alert.alert(
        'iOS Only',
        'Subscriptions are currently only available on iOS via the App Store.\n\nFor information about Android subscriptions, please contact support@forelandmarine.com'
      );
      return;
    }

    setLoading(true);
    try {
      console.log('[SubscriptionPaywall] User tapped Subscribe button');
      
      // Complete purchase flow (purchase + verify)
      const result = await StoreKitUtils.completePurchaseFlow();
      
      if (result.success) {
        console.log('[SubscriptionPaywall] Purchase successful, status:', result.status);
        
        // Refresh subscription status
        await checkSubscription();
        
        if (result.status === 'active') {
          Alert.alert(
            'Subscription Active',
            'Your subscription is now active! You can now access all features of SeaTime Tracker.',
            [
              {
                text: 'Continue',
                onPress: () => router.replace('/(tabs)'),
              },
            ]
          );
        } else {
          Alert.alert(
            'Subscription Issue',
            'Your purchase was successful, but the subscription is not yet active. Please try checking your subscription status in a moment.'
          );
        }
      } else {
        console.error('[SubscriptionPaywall] Purchase failed:', result.error);
        
        if (result.error && !result.error.includes('cancelled')) {
          Alert.alert(
            'Purchase Failed',
            result.error || 'Unable to complete purchase. Please try again.'
          );
        }
      }
    } catch (error: any) {
      console.error('[SubscriptionPaywall] Subscription error:', error);
      Alert.alert(
        'Error',
        'An unexpected error occurred. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRestorePurchases = async () => {
    if (Platform.OS !== 'ios') {
      Alert.alert(
        'iOS Only',
        'Restore purchases is only available on iOS.'
      );
      return;
    }

    setLoading(true);
    try {
      console.log('[SubscriptionPaywall] User tapped Restore Purchases button');
      
      // Complete restore flow (restore + verify)
      const result = await StoreKitUtils.completeRestoreFlow();
      
      if (result.success) {
        console.log('[SubscriptionPaywall] Restore successful, status:', result.status);
        
        // Refresh subscription status
        await checkSubscription();
        
        if (result.status === 'active') {
          Alert.alert(
            'Subscription Restored',
            'Your subscription has been restored successfully!',
            [
              {
                text: 'Continue',
                onPress: () => router.replace('/(tabs)'),
              },
            ]
          );
        } else {
          Alert.alert(
            'No Active Subscription',
            'No active subscription was found. If you recently purchased, please wait a moment and try again.'
          );
        }
      } else {
        console.error('[SubscriptionPaywall] Restore failed:', result.error);
        Alert.alert(
          'Restore Failed',
          result.error || 'No previous purchases found.'
        );
      }
    } catch (error: any) {
      console.error('[SubscriptionPaywall] Restore error:', error);
      Alert.alert(
        'Error',
        'An unexpected error occurred. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCheckStatus = async () => {
    setLoading(true);
    try {
      console.log('[SubscriptionPaywall] User tapped Check Subscription Status button');
      await checkSubscription();
      
      if (subscriptionStatus?.status === 'active') {
        console.log('[SubscriptionPaywall] Subscription is active, redirecting to app');
        router.replace('/(tabs)');
      } else {
        console.log('[SubscriptionPaywall] No active subscription found');
        Alert.alert(
          'No Active Subscription',
          'No active subscription was found. Please subscribe to continue using SeaTime Tracker.'
        );
      }
    } catch (error: any) {
      console.error('[SubscriptionPaywall] Check status error:', error);
      Alert.alert(
        'Error',
        'Unable to check subscription status. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    try {
      console.log('[SubscriptionPaywall] User tapped Manage Subscription button');
      
      if (Platform.OS === 'ios') {
        const url = 'https://apps.apple.com/account/subscriptions';
        const canOpen = await Linking.canOpenURL(url);
        
        if (canOpen) {
          await Linking.openURL(url);
        } else {
          Alert.alert(
            'Manage Subscription',
            'To manage your subscription:\n\n1. Open Settings\n2. Tap your name at the top\n3. Tap Subscriptions\n4. Select SeaTime Tracker'
          );
        }
      }
    } catch (error: any) {
      console.error('[SubscriptionPaywall] Manage subscription error:', error);
    }
  };

  const handleSignOut = async () => {
    try {
      console.log('[SubscriptionPaywall] User confirmed sign out');
      setShowSignOutModal(false);
      await signOut();
      router.replace('/auth');
    } catch (error: any) {
      console.error('[SubscriptionPaywall] Sign out error:', error);
    }
  };

  const styles = createStyles(isDark);

  const statusText = 'Subscription Required';
  const messageText = 'SeaTime Tracker requires an active subscription to track your sea time and generate MCA-compliant reports.';

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <IconSymbol
              ios_icon_name="lock.fill"
              android_material_icon_name="lock"
              size={64}
              color={colors.primary}
            />
          </View>
          <Text style={styles.title}>{statusText}</Text>
          <Text style={styles.subtitle}>{messageText}</Text>
        </View>

        <View style={styles.featuresContainer}>
          <Text style={styles.featuresTitle}>Premium Features</Text>
          
          <View style={styles.feature}>
            <IconSymbol
              ios_icon_name="checkmark.circle.fill"
              android_material_icon_name="check-circle"
              size={24}
              color={colors.success}
            />
            <Text style={styles.featureText}>Automatic sea time tracking via AIS</Text>
          </View>

          <View style={styles.feature}>
            <IconSymbol
              ios_icon_name="checkmark.circle.fill"
              android_material_icon_name="check-circle"
              size={24}
              color={colors.success}
            />
            <Text style={styles.featureText}>MCA-compliant reports (PDF & CSV)</Text>
          </View>

          <View style={styles.feature}>
            <IconSymbol
              ios_icon_name="checkmark.circle.fill"
              android_material_icon_name="check-circle"
              size={24}
              color={colors.success}
            />
            <Text style={styles.featureText}>Multiple vessel tracking</Text>
          </View>

          <View style={styles.feature}>
            <IconSymbol
              ios_icon_name="checkmark.circle.fill"
              android_material_icon_name="check-circle"
              size={24}
              color={colors.success}
            />
            <Text style={styles.featureText}>Secure cloud backup</Text>
          </View>

          <View style={styles.feature}>
            <IconSymbol
              ios_icon_name="checkmark.circle.fill"
              android_material_icon_name="check-circle"
              size={24}
              color={colors.success}
            />
            <Text style={styles.featureText}>Priority support</Text>
          </View>
        </View>

        <View style={styles.pricingContainer}>
          <Text style={styles.pricingTitle}>Monthly Subscription</Text>
          <Text style={styles.price}>{productPrice}</Text>
          <Text style={styles.pricingSubtitle}>per month</Text>
          <Text style={styles.pricingNote}>Cancel anytime</Text>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={handleSubscribe}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.buttonText}>Subscribe Now</Text>
                {Platform.OS === 'ios' && (
                  <Text style={styles.buttonSubtext}>via App Store</Text>
                )}
              </>
            )}
          </TouchableOpacity>

          {Platform.OS === 'ios' && (
            <TouchableOpacity
              style={[styles.button, styles.secondaryButton]}
              onPress={handleRestorePurchases}
              disabled={loading}
            >
              <Text style={styles.secondaryButtonText}>Restore Purchases</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
            onPress={handleCheckStatus}
            disabled={loading}
          >
            <Text style={styles.secondaryButtonText}>Check Subscription Status</Text>
          </TouchableOpacity>

          {Platform.OS === 'ios' && (
            <TouchableOpacity
              style={[styles.button, styles.secondaryButton]}
              onPress={handleManageSubscription}
              disabled={loading}
            >
              <Text style={styles.secondaryButtonText}>Manage Subscription</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.signOutButton}
            onPress={() => setShowSignOutModal(true)}
          >
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            By subscribing, you agree to our Terms of Service and Privacy Policy.
          </Text>
          <Text style={styles.footerText}>
            Subscription automatically renews unless cancelled 24 hours before the end of the current period.
          </Text>
          <Text style={styles.footerText}>
            Manage your subscription in iOS Settings → Apple ID → Subscriptions
          </Text>
        </View>
      </ScrollView>

      <Modal
        visible={showSignOutModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSignOutModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Sign Out?</Text>
            <Text style={styles.modalMessage}>
              Are you sure you want to sign out? You&apos;ll need to sign in again to access the app.
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={() => setShowSignOutModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalConfirmButton]}
                onPress={handleSignOut}
              >
                <Text style={styles.modalConfirmText}>Sign Out</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

function createStyles(isDark: boolean) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? colors.background : colors.backgroundLight,
    },
    content: {
      padding: 24,
      paddingTop: Platform.OS === 'android' ? 48 : 60,
    },
    header: {
      alignItems: 'center',
      marginBottom: 40,
    },
    iconContainer: {
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: isDark ? colors.cardBackground : colors.card,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 24,
    },
    title: {
      fontSize: 28,
      fontWeight: 'bold',
      color: isDark ? colors.text : colors.textLight,
      marginBottom: 12,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 16,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
      textAlign: 'center',
      lineHeight: 24,
    },
    featuresContainer: {
      backgroundColor: isDark ? colors.cardBackground : colors.card,
      borderRadius: 16,
      padding: 20,
      marginBottom: 24,
    },
    featuresTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: isDark ? colors.text : colors.textLight,
      marginBottom: 16,
    },
    feature: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    featureText: {
      fontSize: 16,
      color: isDark ? colors.text : colors.textLight,
      marginLeft: 12,
      flex: 1,
    },
    pricingContainer: {
      backgroundColor: isDark ? colors.cardBackground : colors.card,
      borderRadius: 16,
      padding: 24,
      marginBottom: 24,
      alignItems: 'center',
      borderWidth: 2,
      borderColor: colors.primary,
    },
    pricingTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: isDark ? colors.text : colors.textLight,
      marginBottom: 8,
    },
    price: {
      fontSize: 36,
      fontWeight: 'bold',
      color: colors.primary,
      marginBottom: 4,
    },
    pricingSubtitle: {
      fontSize: 16,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
      marginBottom: 8,
    },
    pricingNote: {
      fontSize: 14,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
      textAlign: 'center',
    },
    buttonContainer: {
      marginBottom: 24,
    },
    button: {
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
      marginBottom: 12,
    },
    primaryButton: {
      backgroundColor: colors.primary,
    },
    buttonText: {
      color: '#FFFFFF',
      fontSize: 18,
      fontWeight: '600',
    },
    buttonSubtext: {
      color: '#FFFFFF',
      fontSize: 14,
      marginTop: 4,
      opacity: 0.9,
    },
    secondaryButton: {
      backgroundColor: 'transparent',
      borderWidth: 2,
      borderColor: isDark ? colors.border : colors.borderLight,
    },
    secondaryButtonText: {
      color: isDark ? colors.text : colors.textLight,
      fontSize: 16,
      fontWeight: '600',
    },
    signOutButton: {
      alignItems: 'center',
      marginTop: 12,
    },
    signOutText: {
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
      fontSize: 16,
      fontWeight: '500',
    },
    footer: {
      marginTop: 24,
    },
    footerText: {
      fontSize: 12,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
      textAlign: 'center',
      marginBottom: 8,
      lineHeight: 18,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    modalContent: {
      backgroundColor: isDark ? colors.cardBackground : colors.card,
      borderRadius: 16,
      padding: 24,
      width: '100%',
      maxWidth: 400,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: isDark ? colors.text : colors.textLight,
      marginBottom: 12,
      textAlign: 'center',
    },
    modalMessage: {
      fontSize: 16,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
      marginBottom: 24,
      textAlign: 'center',
      lineHeight: 22,
    },
    modalButtons: {
      flexDirection: 'row',
      gap: 12,
    },
    modalButton: {
      flex: 1,
      borderRadius: 12,
      padding: 14,
      alignItems: 'center',
    },
    modalCancelButton: {
      backgroundColor: 'transparent',
      borderWidth: 2,
      borderColor: isDark ? colors.border : colors.borderLight,
    },
    modalCancelText: {
      color: isDark ? colors.text : colors.textLight,
      fontSize: 16,
      fontWeight: '600',
    },
    modalConfirmButton: {
      backgroundColor: colors.error,
    },
    modalConfirmText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },
  });
}


/**
 * Subscription Paywall Screen
 * 
 * This screen displays subscription information and handles native iOS StoreKit purchases.
 * 
 * Features:
 * - Display subscription features with real-time pricing from App Store
 * - Native in-app purchase using StoreKit (complies with Apple Guideline 3.1.1)
 * - Restore previous purchases
 * - Check subscription status with backend
 * - Sign out option
 * 
 * Subscription Model:
 * - Monthly subscription (price fetched from App Store in user's local currency)
 * - No free trial period
 * - Users must subscribe to access the app
 * - Status: 'active' or 'inactive'
 * 
 * CRITICAL: Uses native in-app purchase to comply with Apple's Guideline 3.1.1.
 * Pricing is fetched from App Store and displayed in user's local currency.
 * 
 * Backend Integration:
 * - GET /api/subscription/status - Get current subscription status
 * - POST /api/subscription/verify - Verify App Store receipt
 * - PATCH /api/subscription/pause-tracking - Pause tracking when subscription expires
 * 
 * StoreKit Integration:
 * - Product ID: com.forelandmarine.seatime.monthly
 * - Uses react-native-iap for native in-app purchases
 * - Backend handles receipt verification with Apple servers
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
  const [productInfo, setProductInfo] = useState<{
    productId: string;
    price: string;
    localizedPrice: string;
    currency: string;
    title: string;
    description: string;
  } | null>(null);
  const [loadingProduct, setLoadingProduct] = useState(true);
  const { subscriptionStatus, checkSubscription, loading: subscriptionLoading } = useSubscription();
  const { signOut } = useAuth();

  const initializeStoreKit = useCallback(async () => {
    try {
      console.log('[SubscriptionPaywall] Initializing StoreKit');
      const initialized = await StoreKitUtils.initializeStoreKit();
      
      if (initialized) {
        // Fetch product info to display pricing
        const product = await StoreKitUtils.getProductInfo();
        if (product) {
          console.log('[SubscriptionPaywall] Product info loaded:', product);
          setProductInfo(product);
        } else {
          console.warn('[SubscriptionPaywall] Failed to load product info');
        }
      }
    } catch (error: any) {
      console.error('[SubscriptionPaywall] Error initializing StoreKit:', error);
    } finally {
      setLoadingProduct(false);
    }
  }, []);

  useEffect(() => {
    console.log('[SubscriptionPaywall] Screen mounted');
    console.log('[SubscriptionPaywall] Current subscription status:', subscriptionStatus?.status);
    
    // Initialize StoreKit and fetch product info
    if (Platform.OS === 'ios') {
      initializeStoreKit();
    } else {
      setLoadingProduct(false);
    }
  }, [initializeStoreKit, subscriptionStatus?.status]);

  const handleSubscribe = async () => {
    if (Platform.OS !== 'ios') {
      Alert.alert(
        'iOS Only',
        'Subscriptions are currently only available on iOS.\n\nFor information about Android subscriptions, please contact info@forelandmarine.com'
      );
      return;
    }

    setLoading(true);
    try {
      console.log('[SubscriptionPaywall] User tapped Subscribe button - starting native purchase');
      
      // Complete the purchase flow (purchase + verify)
      const result = await StoreKitUtils.completePurchaseFlow();
      
      if (result.success) {
        console.log('[SubscriptionPaywall] Purchase successful, subscription active');
        
        // Refresh subscription status
        await checkSubscription();
        
        Alert.alert(
          'Subscription Active!',
          'Welcome to SeaTime Tracker! Your subscription is now active.',
          [
            {
              text: 'Continue',
              onPress: () => router.replace('/(tabs)'),
            },
          ]
        );
      } else {
        console.error('[SubscriptionPaywall] Purchase failed:', result.error);
        
        // Don't show error for user cancellation
        if (result.error !== 'Purchase cancelled') {
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
        'Unable to process subscription. Please try again or contact support.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    if (Platform.OS !== 'ios') {
      Alert.alert(
        'iOS Only',
        'Restore purchases is only available on iOS.'
      );
      return;
    }

    setLoading(true);
    try {
      console.log('[SubscriptionPaywall] User tapped Restore button');
      
      // Complete the restore flow (restore + verify)
      const result = await StoreKitUtils.completeRestoreFlow();
      
      if (result.success) {
        console.log('[SubscriptionPaywall] Restore successful, subscription active');
        
        // Refresh subscription status
        await checkSubscription();
        
        Alert.alert(
          'Subscription Restored!',
          'Your subscription has been restored successfully.',
          [
            {
              text: 'Continue',
              onPress: () => router.replace('/(tabs)'),
            },
          ]
        );
      } else {
        console.log('[SubscriptionPaywall] Restore failed:', result.error);
        Alert.alert(
          'No Subscription Found',
          result.error || 'No previous subscription found to restore. If you just subscribed, please wait a moment and try again.'
        );
      }
    } catch (error: any) {
      console.error('[SubscriptionPaywall] Restore error:', error);
      Alert.alert(
        'Error',
        'Unable to restore purchases. Please try again or contact support.'
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
        Alert.alert(
          'Subscription Active',
          'Your subscription is active! Welcome to SeaTime Tracker.',
          [
            {
              text: 'Continue',
              onPress: () => router.replace('/(tabs)'),
            },
          ]
        );
      } else {
        console.log('[SubscriptionPaywall] No active subscription found');
        Alert.alert(
          'No Active Subscription',
          'No active subscription was found. Please subscribe or restore your previous purchase.'
        );
      }
    } catch (error: any) {
      console.error('[SubscriptionPaywall] Check status error:', error);
      Alert.alert(
        'Error',
        'Unable to check subscription status. Please check your internet connection and try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleShowInstructions = () => {
    StoreKitUtils.showSubscriptionInstructions();
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
  const messageText = 'SeaTime Tracker requires an active subscription to access the app. Subscribe now to start tracking your sea time and generating MCA-compliant reports.';

  const priceText = productInfo ? productInfo.localizedPrice : 'Loading...';
  const priceSubtext = productInfo ? `${priceText} per month` : 'Fetching pricing...';

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

        {/* Pricing Card */}
        {Platform.OS === 'ios' && (
          <View style={styles.pricingCard}>
            {loadingProduct ? (
              <ActivityIndicator size="large" color={colors.primary} />
            ) : productInfo ? (
              <>
                <Text style={styles.pricingTitle}>Monthly Subscription</Text>
                <Text style={styles.pricingPrice}>{priceText}</Text>
                <Text style={styles.pricingSubtext}>per month</Text>
                <Text style={styles.pricingDescription}>
                  Billed monthly. Cancel anytime.
                </Text>
              </>
            ) : (
              <Text style={styles.pricingError}>
                Unable to load pricing. Please check your connection.
              </Text>
            )}
          </View>
        )}

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

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={handleSubscribe}
            disabled={loading || subscriptionLoading || loadingProduct}
          >
            {loading || subscriptionLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.buttonText}>Subscribe Now</Text>
                {Platform.OS === 'ios' && productInfo && (
                  <Text style={styles.buttonSubtext}>{priceSubtext}</Text>
                )}
              </>
            )}
          </TouchableOpacity>

          {Platform.OS === 'ios' && (
            <TouchableOpacity
              style={[styles.button, styles.secondaryButton]}
              onPress={handleRestore}
              disabled={loading || subscriptionLoading}
            >
              {loading || subscriptionLoading ? (
                <ActivityIndicator color={isDark ? colors.text : colors.textLight} />
              ) : (
                <Text style={styles.secondaryButtonText}>Restore Purchase</Text>
              )}
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
            onPress={handleCheckStatus}
            disabled={loading || subscriptionLoading}
          >
            {loading || subscriptionLoading ? (
              <ActivityIndicator color={isDark ? colors.text : colors.textLight} />
            ) : (
              <Text style={styles.secondaryButtonText}>Check Subscription Status</Text>
            )}
          </TouchableOpacity>

          {Platform.OS === 'ios' && (
            <TouchableOpacity
              style={[styles.button, styles.tertiaryButton]}
              onPress={handleShowInstructions}
            >
              <IconSymbol
                ios_icon_name="questionmark.circle"
                android_material_icon_name="help"
                size={20}
                color={isDark ? colors.textSecondary : colors.textSecondaryLight}
              />
              <Text style={styles.tertiaryButtonText}>How to Subscribe</Text>
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
          <Text style={styles.footerText}>
            Payment will be charged to your Apple ID account at confirmation of purchase.
          </Text>
          <Text style={styles.footerText}>
            Need help? Contact info@forelandmarine.com
          </Text>
        </View>
      </ScrollView>

      {/* Sign Out Modal */}
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
      marginBottom: 32,
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
      paddingHorizontal: 20,
    },
    pricingCard: {
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
      marginBottom: 12,
    },
    pricingPrice: {
      fontSize: 48,
      fontWeight: 'bold',
      color: colors.primary,
      marginBottom: 4,
    },
    pricingSubtext: {
      fontSize: 16,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
      marginBottom: 12,
    },
    pricingDescription: {
      fontSize: 14,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
      textAlign: 'center',
    },
    pricingError: {
      fontSize: 14,
      color: colors.error,
      textAlign: 'center',
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
    tertiaryButton: {
      backgroundColor: 'transparent',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    tertiaryButtonText: {
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
      fontSize: 16,
      fontWeight: '500',
    },
    signOutButton: {
      alignItems: 'center',
      marginTop: 12,
      padding: 12,
    },
    signOutText: {
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
      fontSize: 16,
      fontWeight: '500',
    },
    footer: {
      marginTop: 24,
      paddingBottom: 40,
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
      alignItems: 'center',
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: isDark ? colors.text : colors.textLight,
      marginTop: 16,
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
      width: '100%',
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
      backgroundColor: colors.primary,
    },
    modalConfirmText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },
  });
}

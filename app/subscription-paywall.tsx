
/**
 * Subscription Paywall Screen
 * 
 * This screen displays subscription information and handles native iOS StoreKit purchases.
 * 
 * Features:
 * - Display subscription features (NO HARDCODED PRICES - fetched from App Store)
 * - Direct users to App Store for subscription purchase
 * - Check subscription status with backend
 * - Manage subscription via iOS Settings
 * - Sign out option
 * 
 * Subscription Model:
 * - Monthly subscription (price fetched from App Store)
 * - No free trial period
 * - Users must subscribe to access the app
 * - Status: 'active' or 'inactive'
 * 
 * CRITICAL: Prices are NEVER hardcoded per Apple StoreKit guidelines.
 * Users view pricing in the App Store where it's displayed in their local currency.
 * 
 * Backend Integration:
 * - GET /api/subscription/status - Get current subscription status
 * - POST /api/subscription/verify - Verify App Store receipt (automatic)
 * - PATCH /api/subscription/pause-tracking - Pause tracking when subscription expires
 * 
 * StoreKit Integration:
 * - Product ID: com.forelandmarine.seatime.monthly
 * - Uses App Store links for subscription management
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
  const { subscriptionStatus, checkSubscription, loading: subscriptionLoading } = useSubscription();
  const { signOut } = useAuth();

  const initializeStoreKit = useCallback(async () => {
    try {
      console.log('[SubscriptionPaywall] Initializing StoreKit');
      await StoreKitUtils.initializeStoreKit();
    } catch (error: any) {
      console.error('[SubscriptionPaywall] Error initializing StoreKit:', error);
    }
  }, []);

  useEffect(() => {
    console.log('[SubscriptionPaywall] Screen mounted');
    console.log('[SubscriptionPaywall] Current subscription status:', subscriptionStatus?.status);
    
    // Initialize StoreKit
    if (Platform.OS === 'ios') {
      initializeStoreKit();
    }
  }, [initializeStoreKit, subscriptionStatus?.status]);

  const handleSubscribe = async () => {
    if (Platform.OS !== 'ios') {
      Alert.alert(
        'iOS Only',
        'Subscriptions are currently only available on iOS via the App Store.\n\nFor information about Android subscriptions, please contact info@forelandmarine.com'
      );
      return;
    }

    try {
      console.log('[SubscriptionPaywall] User tapped Subscribe button - opening App Store directly');
      
      // Open App Store directly
      await StoreKitUtils.openAppStoreSubscription();
      
      console.log('[SubscriptionPaywall] Opened App Store for subscription');
    } catch (error: any) {
      console.error('[SubscriptionPaywall] Subscription error:', error);
      Alert.alert(
        'Error',
        'Unable to open App Store. Please try again or subscribe manually via the App Store app.'
      );
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
          'No active subscription was found. If you just subscribed, please wait a moment for Apple to process your purchase, then try again.\n\nIf you continue to have issues, please contact info@forelandmarine.com'
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

  const handleManageSubscription = async () => {
    try {
      console.log('[SubscriptionPaywall] User tapped Manage Subscription button');
      await StoreKitUtils.openSubscriptionManagement();
    } catch (error: any) {
      console.error('[SubscriptionPaywall] Manage subscription error:', error);
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

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={handleSubscribe}
            disabled={loading || subscriptionLoading}
          >
            {loading || subscriptionLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.buttonText}>Subscribe Now</Text>
                {Platform.OS === 'ios' && (
                  <Text style={styles.buttonSubtext}>Opens App Store</Text>
                )}
              </>
            )}
          </TouchableOpacity>

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
            <>
              <TouchableOpacity
                style={[styles.button, styles.secondaryButton]}
                onPress={handleManageSubscription}
                disabled={loading || subscriptionLoading}
              >
                <Text style={styles.secondaryButtonText}>Manage Subscription</Text>
              </TouchableOpacity>

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
            </>
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
            Pricing is displayed in the App Store in your local currency.
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
      paddingHorizontal: 20,
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

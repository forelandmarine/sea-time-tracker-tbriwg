
/**
 * Subscription Paywall Screen
 * 
 * ✅ STABILIZED IMPLEMENTATION - App Store Deep-Link Path
 * ✅ NATIVE IAP DISABLED - Using cross-platform fallback for stability
 * ✅ NO STOREKIT TURBOMODULE - Eliminates crash risk on iOS 26
 * 
 * This screen displays subscription information and directs users to the App Store
 * to complete their purchase. After purchasing, users return to the app and verify
 * their subscription status with the backend.
 * 
 * Flow:
 * 1. User taps "Subscribe Now" → Opens App Store subscription page
 * 2. User completes purchase in App Store
 * 3. User returns to app and taps "Check Subscription Status"
 * 4. Backend verifies subscription with Apple's servers
 * 5. User gains access to app features
 * 
 * ✅ APPLE GUIDELINE 3.1.1 COMPLIANCE:
 * - Directs to App Store for in-app purchases (no external payment)
 * - Pricing is shown in App Store (never hardcoded)
 * - Users complete purchase using Apple Pay or Apple ID
 * - Receipt verification happens with backend
 * 
 * ✅ APPLE GUIDELINE 3.1.2 COMPLIANCE (SUBSCRIPTIONS):
 * - Tappable links to Privacy Policy and Apple Standard EULA
 * - Auto-renewal disclosure text
 * - Subscription management link to Apple's subscription page
 * - Restore purchases with clear user feedback
 * 
 * Features:
 * - Display subscription features
 * - Open App Store for subscription
 * - Check subscription status with backend
 * - Manage subscription via iOS Settings
 * - Sign out option
 */

import React, { useState, useEffect } from 'react';
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
  Linking,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useAuth } from '@/contexts/AuthContext';
import * as StoreKitUtils from '@/utils/storeKit';

// COMPLIANCE: Developer URLs (replace with actual URLs before submission)
const PRIVACY_POLICY_URL = 'https://forelandmarine.com/privacy';
const TERMS_OF_SERVICE_URL = 'https://forelandmarine.com/terms';
const APPLE_EULA_URL = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';

export default function SubscriptionPaywallScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [loading, setLoading] = useState(false);
  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const { subscriptionStatus, checkSubscription } = useSubscription();
  const { signOut } = useAuth();

  useEffect(() => {
    console.log('[SubscriptionPaywall] Screen mounted');
    console.log('[SubscriptionPaywall] Current subscription status:', subscriptionStatus?.status);
    console.log('[SubscriptionPaywall] Using App Store deep-link path (native IAP disabled)');
  }, [subscriptionStatus?.status]);

  const handleSubscribe = async () => {
    if (Platform.OS !== 'ios') {
      Alert.alert(
        'iOS Only',
        'Subscriptions are currently only available on iOS via the App Store.\n\nFor information about Android subscriptions, please contact info@forelandmarine.com'
      );
      return;
    }

    try {
      console.log('[SubscriptionPaywall] User tapped Subscribe button - opening App Store');
      await StoreKitUtils.purchaseSubscription();
      
      // Show instructions after opening App Store
      setTimeout(() => {
        Alert.alert(
          'Complete Your Purchase',
          'After completing your purchase in the App Store, return to this screen and tap "Check Subscription Status" to activate your subscription.',
          [{ text: 'Got it' }]
        );
      }, 1000);
    } catch (error: any) {
      console.error('[SubscriptionPaywall] Subscribe error:', error);
      Alert.alert(
        'Error',
        error.message || 'Unable to open App Store. Please try again.'
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

  const handleRestorePurchases = async () => {
    if (Platform.OS !== 'ios') {
      Alert.alert(
        'iOS Only',
        'Restore purchases is only available on iOS.'
      );
      return;
    }

    Alert.alert(
      'Restore Purchases',
      'To restore your subscription, tap "Check Subscription Status". The app will verify your subscription with Apple\'s servers.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Check Status', onPress: handleCheckStatus },
      ]
    );
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

  const handleOpenLink = async (url: string, title: string) => {
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Error', `Unable to open ${title}`);
      }
    } catch (error) {
      console.error(`Error opening ${title}:`, error);
      Alert.alert('Error', `Unable to open ${title}`);
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
          <Text style={styles.pricingNote}>View pricing in the App Store</Text>
        </View>

        {/* COMPLIANCE: Auto-renewal disclosure (3.1.2) */}
        <View style={styles.disclosureContainer}>
          <Text style={styles.disclosureText}>
            • Subscription automatically renews unless canceled at least 24 hours before the end of the current period
          </Text>
          <Text style={styles.disclosureText}>
            • Payment will be charged to your Apple ID at confirmation of purchase
          </Text>
          <Text style={styles.disclosureText}>
            • You can manage or cancel your subscription in App Store account settings
          </Text>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.primaryButton, loading && styles.buttonDisabled]}
            onPress={handleSubscribe}
            disabled={loading}
          >
            {loading ? (
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
            style={[styles.button, styles.secondaryButton, loading && styles.buttonDisabled]}
            onPress={handleCheckStatus}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={isDark ? colors.text : colors.textLight} />
            ) : (
              <Text style={styles.secondaryButtonText}>Check Subscription Status</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.secondaryButton, loading && styles.buttonDisabled]}
            onPress={handleRestorePurchases}
            disabled={loading}
          >
            <Text style={styles.secondaryButtonText}>Restore Purchases</Text>
          </TouchableOpacity>

          {Platform.OS === 'ios' && (
            <>
              <TouchableOpacity
                style={[styles.button, styles.secondaryButton]}
                onPress={handleManageSubscription}
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

        {/* COMPLIANCE: Required links (3.1.2) */}
        <View style={styles.linksContainer}>
          <TouchableOpacity onPress={() => handleOpenLink(PRIVACY_POLICY_URL, 'Privacy Policy')}>
            <Text style={styles.linkText}>Privacy Policy</Text>
          </TouchableOpacity>
          <Text style={styles.linkSeparator}>•</Text>
          <TouchableOpacity onPress={() => handleOpenLink(TERMS_OF_SERVICE_URL, 'Terms of Service')}>
            <Text style={styles.linkText}>Terms of Service</Text>
          </TouchableOpacity>
          <Text style={styles.linkSeparator}>•</Text>
          <TouchableOpacity onPress={() => handleOpenLink(APPLE_EULA_URL, 'EULA')}>
            <Text style={styles.linkText}>EULA</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
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
    pricingContainer: {
      backgroundColor: isDark ? colors.cardBackground : colors.card,
      borderRadius: 16,
      padding: 24,
      marginBottom: 16,
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
    pricingNote: {
      fontSize: 14,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
      textAlign: 'center',
    },
    disclosureContainer: {
      backgroundColor: isDark ? colors.cardBackground : colors.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 24,
      borderLeftWidth: 4,
      borderLeftColor: colors.primary,
    },
    disclosureText: {
      fontSize: 13,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
      lineHeight: 20,
      marginBottom: 8,
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
    buttonDisabled: {
      opacity: 0.6,
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
    linksContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
      flexWrap: 'wrap',
    },
    linkText: {
      fontSize: 14,
      color: colors.primary,
      textDecorationLine: 'underline',
      marginHorizontal: 4,
    },
    linkSeparator: {
      fontSize: 14,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
      marginHorizontal: 4,
    },
    footer: {
      marginTop: 8,
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

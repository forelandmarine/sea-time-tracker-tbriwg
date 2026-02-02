
/**
 * Subscription Paywall Screen
 * 
 * This screen displays subscription information and directs users to subscribe
 * via the iOS App Store or other payment methods.
 * 
 * Features:
 * - Display subscription features and pricing (£4.99/€5.99 per month)
 * - Direct users to App Store for subscription management
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
 * - GET /api/subscription/status - Get current subscription status
 * - PATCH /api/subscription/pause-tracking - Pause tracking when subscription expires
 * 
 * Note: Subscription purchases are handled directly through the iOS App Store.
 * Users should manage their subscriptions via iOS Settings > Apple ID > Subscriptions.
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
  Linking,
  Modal,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useAuth } from '@/contexts/AuthContext';

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
  }, [subscriptionStatus]);

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      console.log('[SubscriptionPaywall] User tapped Subscribe button');
      
      if (Platform.OS === 'ios') {
        const alertMessage = 'To subscribe to SeaTime Tracker:\n\n1. Visit the App Store\n2. Search for "SeaTime Tracker"\n3. Subscribe via In-App Purchase\n\nPrice: £4.99/€5.99 per month\n\nAfter subscribing, return to the app and tap "Check Subscription Status" to continue.';
        
        const url = 'https://apps.apple.com/app/seatime-tracker/id123456789';
        const canOpen = await Linking.canOpenURL(url);
        
        if (canOpen) {
          await Linking.openURL(url);
        } else {
          console.warn('[SubscriptionPaywall] Cannot open App Store URL');
        }
      } else if (Platform.OS === 'android') {
        const alertMessage = 'Subscriptions are currently only available on iOS via the App Store.\n\nFor information about Android subscriptions, please contact support@forelandmarine.com';
        console.log('[SubscriptionPaywall]', alertMessage);
      } else {
        const alertMessage = 'Subscriptions are available on iOS via the App Store.\n\nFor more information, please contact support@forelandmarine.com';
        console.log('[SubscriptionPaywall]', alertMessage);
      }
    } catch (error: any) {
      console.error('[SubscriptionPaywall] Subscription error:', error);
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
      }
    } catch (error: any) {
      console.error('[SubscriptionPaywall] Check status error:', error);
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
          console.warn('[SubscriptionPaywall] Cannot open subscriptions URL');
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
          <Text style={styles.price}>£4.99/€5.99</Text>
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
              <Text style={styles.buttonText}>Subscribe via App Store</Text>
            )}
          </TouchableOpacity>

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
              Are you sure you want to sign out? You'll need to sign in again to access the app.
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

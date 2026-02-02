
/**
 * Subscription Paywall Screen
 * 
 * This screen handles iOS App Store subscription management using Superwall SDK.
 * 
 * Features:
 * - Display subscription features and pricing (£4.99/€5.99 per month)
 * - Handle iOS In-App Purchase flow via Superwall
 * - Verify receipts with backend API
 * - Restore previous purchases
 * - Check subscription status
 * 
 * Subscription Model:
 * - Price: £4.99/€5.99 per month
 * - No free trial period
 * - Users must subscribe immediately to access the app
 * - Status: 'active' or 'inactive' only
 * 
 * Backend Integration:
 * - POST /api/subscription/verify - Verify iOS receipt and update subscription
 * - GET /api/subscription/status - Get current subscription status
 * - PATCH /api/subscription/pause-tracking - Pause tracking when subscription expires
 * 
 * Setup Instructions:
 * 1. Configure Superwall API key in app.json:
 *    "extra": {
 *      "superwallApiKey": "YOUR_SUPERWALL_API_KEY"
 *    }
 * 
 * 2. Set up iOS In-App Purchase products in App Store Connect:
 *    - Product ID: com.forelandmarine.seatime.monthly
 *    - Type: Auto-renewable subscription
 *    - Price: £4.99/€5.99 per month
 *    - No trial period
 * 
 * 3. Configure Superwall dashboard:
 *    - Add your product IDs
 *    - Set up paywall templates
 *    - Configure subscription groups
 * 
 * 4. Test with sandbox users:
 *    - Create sandbox test users in App Store Connect
 *    - Use sandbox mode for testing (isSandbox: true)
 * 
 * @see https://docs.superwall.com for Superwall documentation
 * @see contexts/SubscriptionContext.tsx for subscription state management
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
  Alert,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useAuth } from '@/contexts/AuthContext';

// Superwall SDK for iOS In-App Purchases
let Superwall: any = null;
if (Platform.OS === 'ios') {
  try {
    Superwall = require('expo-superwall').Superwall;
  } catch (error) {
    console.warn('[SubscriptionPaywall] Superwall not available:', error);
  }
}

export default function SubscriptionPaywallScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [loading, setLoading] = useState(false);
  const { subscriptionStatus, checkSubscription, verifyReceipt } = useSubscription();
  const { signOut } = useAuth();

  useEffect(() => {
    console.log('[SubscriptionPaywall] Screen mounted');
    console.log('[SubscriptionPaywall] Current subscription status:', subscriptionStatus?.status);
    
    // Initialize Superwall if available
    if (Platform.OS === 'ios' && Superwall) {
      initializeSuperwall();
    }
  }, [subscriptionStatus]);

  const initializeSuperwall = async () => {
    try {
      console.log('[SubscriptionPaywall] Initializing Superwall...');
      
      // Configure Superwall with your API key
      // Get API key from environment or app config
      const superwallApiKey = Constants.expoConfig?.extra?.superwallApiKey || 'YOUR_SUPERWALL_API_KEY';
      
      if (superwallApiKey === 'YOUR_SUPERWALL_API_KEY') {
        console.warn('[SubscriptionPaywall] Superwall API key not configured. Please add it to app.json extra.superwallApiKey');
        return;
      }
      
      await Superwall.configure({
        apiKey: superwallApiKey,
        purchaseController: {
          // Handle purchase events
          onPurchase: async (productId: string, receipt: string) => {
            console.log('[SubscriptionPaywall] Purchase completed:', productId);
            await handlePurchaseComplete(receipt, productId);
          },
          onRestore: async (receipt: string) => {
            console.log('[SubscriptionPaywall] Restore completed');
            await handleRestoreComplete(receipt);
          },
        },
      });
      
      console.log('[SubscriptionPaywall] Superwall initialized successfully');
    } catch (error) {
      console.error('[SubscriptionPaywall] Failed to initialize Superwall:', error);
    }
  };

  const handlePurchaseComplete = async (receipt: string, productId: string) => {
    try {
      console.log('[SubscriptionPaywall] Verifying purchase with backend...');
      
      // Verify receipt with backend
      const result = await verifyReceipt(receipt, productId, __DEV__);
      
      if (result.success && result.status === 'active') {
        console.log('[SubscriptionPaywall] Purchase verified successfully');
        Alert.alert(
          'Success!',
          'Your subscription is now active. Welcome to SeaTime Tracker Premium!',
          [
            {
              text: 'Get Started',
              onPress: () => router.replace('/(tabs)'),
            },
          ]
        );
      } else {
        console.error('[SubscriptionPaywall] Purchase verification failed');
        Alert.alert(
          'Verification Failed',
          'We could not verify your purchase. Please contact support if you were charged.',
          [{ text: 'OK' }]
        );
      }
    } catch (error: any) {
      console.error('[SubscriptionPaywall] Purchase verification error:', error);
      Alert.alert(
        'Error',
        'Failed to verify your purchase. Please contact support if you were charged.',
        [{ text: 'OK' }]
      );
    }
  };

  const handleRestoreComplete = async (receipt: string) => {
    try {
      console.log('[SubscriptionPaywall] Verifying restored purchase...');
      
      // For restore, we don't know the product ID, so we'll use a generic one
      // The backend should extract it from the receipt
      const result = await verifyReceipt(receipt, 'com.forelandmarine.seatime.monthly', __DEV__);
      
      if (result.success && result.status === 'active') {
        console.log('[SubscriptionPaywall] Restore verified successfully');
        Alert.alert(
          'Restored!',
          'Your subscription has been restored successfully.',
          [
            {
              text: 'Continue',
              onPress: () => {
                checkSubscription();
                router.replace('/(tabs)');
              },
            },
          ]
        );
      } else {
        console.log('[SubscriptionPaywall] No active subscription found');
        Alert.alert(
          'No Subscription Found',
          'We could not find an active subscription to restore.',
          [{ text: 'OK' }]
        );
      }
    } catch (error: any) {
      console.error('[SubscriptionPaywall] Restore verification error:', error);
      Alert.alert(
        'Error',
        'Failed to restore your purchase. Please try again later.',
        [{ text: 'OK' }]
      );
    }
  };

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      console.log('[SubscriptionPaywall] User tapped Subscribe button');
      
      if (Platform.OS === 'ios') {
        if (Superwall) {
          // Show Superwall paywall
          console.log('[SubscriptionPaywall] Presenting Superwall paywall...');
          await Superwall.present('subscription_paywall');
        } else {
          // Fallback: Show alert with instructions
          Alert.alert(
            'Subscription',
            'To subscribe, please ensure you have the latest version of the app from the App Store.\n\nFor early access or support, contact support@forelandmarine.com',
            [{ text: 'OK' }]
          );
        }
      } else {
        Alert.alert(
          'Subscription',
          'Subscriptions are currently only available on iOS via the App Store.',
          [{ text: 'OK' }]
        );
      }
    } catch (error: any) {
      console.error('[SubscriptionPaywall] Subscription error:', error);
      Alert.alert('Error', error.message || 'Failed to process subscription');
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    setLoading(true);
    try {
      console.log('[SubscriptionPaywall] User tapped Restore Purchases button');
      
      if (Platform.OS === 'ios') {
        if (Superwall) {
          // Restore purchases via Superwall
          console.log('[SubscriptionPaywall] Restoring purchases via Superwall...');
          await Superwall.restorePurchases();
        } else {
          // Fallback: Show alert
          Alert.alert(
            'Restore Purchases',
            'Purchase restoration requires the latest version of the app. Please update from the App Store.',
            [{ text: 'OK' }]
          );
        }
      } else {
        Alert.alert(
          'Restore Purchases',
          'Purchase restoration is only available on iOS.',
          [{ text: 'OK' }]
        );
      }
      
      // Refresh subscription status after restore attempt
      await checkSubscription();
    } catch (error: any) {
      console.error('[SubscriptionPaywall] Restore error:', error);
      Alert.alert('Error', error.message || 'Failed to restore purchases');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      console.log('[SubscriptionPaywall] User tapped Sign Out button');
      await signOut();
      router.replace('/auth');
    } catch (error: any) {
      console.error('[SubscriptionPaywall] Sign out error:', error);
      Alert.alert('Error', error.message || 'Failed to sign out');
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
              <Text style={styles.buttonText}>Subscribe Now</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
            onPress={handleRestore}
            disabled={loading}
          >
            <Text style={styles.secondaryButtonText}>Restore Purchases</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.signOutButton}
            onPress={handleSignOut}
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
        </View>
      </ScrollView>
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
  });
}

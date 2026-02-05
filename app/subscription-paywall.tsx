
/**
 * Subscription Paywall Screen
 * 
 * This screen displays subscription information and handles NATIVE iOS StoreKit purchases.
 * 
 * ✅ APPLE GUIDELINE 3.1.1 COMPLIANCE:
 * - Uses NATIVE in-app purchases via react-native-iap
 * - Purchases happen WITHIN the app (not external links)
 * - Pricing is fetched from App Store in real-time (never hardcoded)
 * - Users complete purchase using Apple Pay or Apple ID
 * - Receipt verification happens automatically with backend
 * - Transactions are properly finished after verification
 * 
 * ✅ STOREKIT 2 BEST PRACTICES:
 * - Purchase listeners handle async updates
 * - Transactions are finished after verification
 * - Proper error handling for all scenarios
 * - User-friendly messaging for all states
 * 
 * ✅ PERFORMANCE OPTIMIZATION:
 * - StoreKit initialization is DEFERRED until screen is visible
 * - Does NOT block app startup or authentication
 * - Graceful fallback if StoreKit fails to initialize
 * 
 * Features:
 * - Display subscription features (NO HARDCODED PRICES - fetched from App Store)
 * - Native StoreKit purchase flow (opens iOS payment sheet)
 * - Restore previous purchases
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
 * Backend Integration:
 * - GET /api/subscription/status - Get current subscription status
 * - POST /api/subscription/verify - Verify App Store receipt (automatic)
 * - PATCH /api/subscription/pause-tracking - Pause tracking when subscription expires
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
  const [productInfo, setProductInfo] = useState<any>(null);
  const [loadingPrice, setLoadingPrice] = useState(true);
  const [purchaseInProgress, setPurchaseInProgress] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [storeKitInitialized, setStoreKitInitialized] = useState(false);
  const { subscriptionStatus, checkSubscription, loading: subscriptionLoading } = useSubscription();
  const { signOut } = useAuth();

  const initializeAndFetchProduct = useCallback(async () => {
    if (Platform.OS !== 'ios') {
      setLoadingPrice(false);
      return;
    }

    setLoadingPrice(true);
    setError(null);
    
    try {
      // CRITICAL: Defer initialization to prevent blocking app startup
      // Wait for screen to be fully rendered before initializing StoreKit
      await new Promise(resolve => setTimeout(resolve, 500));
      
      console.log('[SubscriptionPaywall] Initializing StoreKit (deferred)');
      const initialized = await StoreKitUtils.initializeStoreKit();
      
      if (initialized) {
        setStoreKitInitialized(true);
        console.log('[SubscriptionPaywall] Fetching product info (no hardcoded prices)');
        const info = await StoreKitUtils.getProductInfo();
        
        if (info) {
          console.log('[SubscriptionPaywall] Product info fetched:', info);
          setProductInfo(info);
        } else {
          console.log('[SubscriptionPaywall] Product info not available - user will view pricing in App Store');
          setError('Unable to load pricing. You can still subscribe - pricing will be shown in the App Store.');
        }
      } else {
        console.log('[SubscriptionPaywall] StoreKit not initialized');
        setError('Unable to connect to App Store. Please check your connection and try again.');
      }
    } catch (error: any) {
      console.error('[SubscriptionPaywall] Error initializing StoreKit:', error);
      setError('Unable to load pricing. You can still subscribe - pricing will be shown in the App Store.');
    } finally {
      setLoadingPrice(false);
    }
  }, []);

  useEffect(() => {
    console.log('[SubscriptionPaywall] Screen mounted');
    console.log('[SubscriptionPaywall] Current subscription status:', subscriptionStatus?.status);
    
    // Initialize StoreKit and fetch product info (deferred)
    initializeAndFetchProduct();

    // Setup purchase listeners (only if on iOS)
    if (Platform.OS === 'ios') {
      StoreKitUtils.setupPurchaseListeners(
        // On purchase success
        async (purchase) => {
          console.log('[SubscriptionPaywall] Purchase listener triggered:', purchase.transactionId);
          setPurchaseInProgress(true);
          
          try {
            // Process the purchase (verify + finish transaction)
            const result = await StoreKitUtils.processPurchase(purchase);
            
            if (result.success) {
              console.log('[SubscriptionPaywall] Purchase processed successfully');
              
              // Refresh subscription status
              await checkSubscription();
              
              setPurchaseInProgress(false);
              
              Alert.alert(
                'Subscription Active',
                'Your subscription is now active! Welcome to SeaTime Tracker.',
                [
                  {
                    text: 'Continue',
                    onPress: () => router.replace('/(tabs)'),
                  },
                ]
              );
            } else {
              console.error('[SubscriptionPaywall] Purchase processing failed:', result.error);
              setPurchaseInProgress(false);
              
              Alert.alert(
                'Purchase Error',
                result.error || 'Unable to verify purchase. Please contact support.'
              );
            }
          } catch (error: any) {
            console.error('[SubscriptionPaywall] Error processing purchase:', error);
            setPurchaseInProgress(false);
            
            Alert.alert(
              'Purchase Error',
              'Unable to complete purchase. Please try again or contact support.'
            );
          }
        },
        // On purchase error
        (error) => {
          console.error('[SubscriptionPaywall] Purchase error listener triggered:', error);
          setPurchaseInProgress(false);
          
          // Don't show alert for user cancellation
          if (error.code !== 'E_USER_CANCELLED') {
            Alert.alert(
              'Purchase Failed',
              error.message || 'Unable to complete purchase. Please try again.'
            );
          }
        }
      );

      // Cleanup listeners on unmount
      return () => {
        console.log('[SubscriptionPaywall] Cleaning up purchase listeners');
        StoreKitUtils.removePurchaseListeners();
      };
    }
  }, [initializeAndFetchProduct, checkSubscription, router]);

  const handleSubscribe = async () => {
    if (Platform.OS !== 'ios') {
      Alert.alert(
        'iOS Only',
        'Subscriptions are currently only available on iOS via the App Store.\n\nFor information about Android subscriptions, please contact info@forelandmarine.com'
      );
      return;
    }

    if (purchaseInProgress) {
      console.log('[SubscriptionPaywall] Purchase already in progress, ignoring tap');
      return;
    }

    // Check if StoreKit is initialized
    if (!storeKitInitialized) {
      console.log('[SubscriptionPaywall] StoreKit not initialized, attempting to initialize now');
      Alert.alert(
        'Connecting to App Store',
        'Please wait while we connect to the App Store...',
        [{ text: 'OK' }]
      );
      
      try {
        const initialized = await StoreKitUtils.initializeStoreKit();
        if (!initialized) {
          Alert.alert(
            'Connection Error',
            'Unable to connect to the App Store. Please check your internet connection and try again.'
          );
          return;
        }
        setStoreKitInitialized(true);
      } catch (error: any) {
        Alert.alert(
          'Connection Error',
          'Unable to connect to the App Store. Please check your internet connection and try again.'
        );
        return;
      }
    }

    try {
      console.log('[SubscriptionPaywall] User tapped Subscribe button - initiating native purchase');
      setPurchaseInProgress(true);
      
      // Request purchase - result will come through listener
      await StoreKitUtils.purchaseSubscription();
      
      console.log('[SubscriptionPaywall] Purchase request sent, waiting for listener callback');
    } catch (error: any) {
      console.error('[SubscriptionPaywall] Subscription error:', error);
      setPurchaseInProgress(false);
      
      // Don't show error for user cancellation
      if (!error.message?.includes('cancelled')) {
        Alert.alert(
          'Error',
          error.message || 'Unable to start purchase. Please try again.'
        );
      }
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

    // Check if StoreKit is initialized
    if (!storeKitInitialized) {
      console.log('[SubscriptionPaywall] StoreKit not initialized for restore, attempting to initialize now');
      try {
        const initialized = await StoreKitUtils.initializeStoreKit();
        if (!initialized) {
          Alert.alert(
            'Connection Error',
            'Unable to connect to the App Store. Please check your internet connection and try again.'
          );
          return;
        }
        setStoreKitInitialized(true);
      } catch (error: any) {
        Alert.alert(
          'Connection Error',
          'Unable to connect to the App Store. Please check your internet connection and try again.'
        );
        return;
      }
    }

    try {
      console.log('[SubscriptionPaywall] User tapped Restore Purchases button');
      setLoading(true);
      
      const result = await StoreKitUtils.completeRestoreFlow();
      
      if (result.success) {
        console.log('[SubscriptionPaywall] Restore successful, checking subscription status');
        await checkSubscription();
        
        Alert.alert(
          'Restore Successful',
          'Your subscription has been restored!',
          [
            {
              text: 'Continue',
              onPress: () => {
                if (subscriptionStatus?.status === 'active') {
                  router.replace('/(tabs)');
                }
              },
            },
          ]
        );
      } else {
        console.log('[SubscriptionPaywall] Restore failed:', result.error);
        Alert.alert(
          'No Purchases Found',
          result.error || 'No previous purchases found to restore.'
        );
      }
    } catch (error: any) {
      console.error('[SubscriptionPaywall] Restore error:', error);
      Alert.alert(
        'Error',
        'Unable to restore purchases. Please try again or contact support at info@forelandmarine.com'
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
  const messageText = 'SeaTime Tracker requires an active subscription to track your sea time and generate MCA-compliant reports.';

  // Format price display
  const priceDisplay = productInfo 
    ? productInfo.localizedPrice
    : 'View in App Store';

  const isProcessing = loading || subscriptionLoading || purchaseInProgress;

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
          {loadingPrice ? (
            <View style={styles.priceLoaderContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Connecting to App Store...</Text>
            </View>
          ) : (
            <>
              <Text style={styles.price}>{priceDisplay}</Text>
              {productInfo && <Text style={styles.pricingSubtitle}>per month</Text>}
              {!productInfo && Platform.OS === 'ios' && (
                <Text style={styles.pricingNote}>Tap Subscribe to view pricing in your currency</Text>
              )}
            </>
          )}
          <Text style={styles.pricingNote}>Cancel anytime • No trial period</Text>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.primaryButton, isProcessing && styles.buttonDisabled]}
            onPress={handleSubscribe}
            disabled={isProcessing}
          >
            {purchaseInProgress ? (
              <>
                <ActivityIndicator color="#FFFFFF" />
                <Text style={[styles.buttonText, { marginTop: 8 }]}>Processing Purchase...</Text>
              </>
            ) : isProcessing ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.buttonText}>Subscribe Now</Text>
                {Platform.OS === 'ios' && (
                  <Text style={styles.buttonSubtext}>Native In-App Purchase</Text>
                )}
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.secondaryButton, isProcessing && styles.buttonDisabled]}
            onPress={handleCheckStatus}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator color={isDark ? colors.text : colors.textLight} />
            ) : (
              <Text style={styles.secondaryButtonText}>Check Subscription Status</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.secondaryButton, isProcessing && styles.buttonDisabled]}
            onPress={handleRestorePurchases}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator color={isDark ? colors.text : colors.textLight} />
            ) : (
              <Text style={styles.secondaryButtonText}>Restore Purchases</Text>
            )}
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
            Pricing is displayed in your local currency via the App Store.
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
    priceLoaderContainer: {
      marginVertical: 20,
      alignItems: 'center',
    },
    loadingText: {
      fontSize: 14,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
      marginTop: 12,
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
      marginTop: 4,
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

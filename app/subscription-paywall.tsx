
/**
 * RevenueCat Subscription Paywall Screen
 * 
 * ✅ APPLE APP STORE COMPLIANT
 * ✅ REVENUECAT INTEGRATION
 * ✅ SUBSCRIPTION ENFORCEMENT
 * ✅ SANDBOX TESTING ENABLED
 * 
 * This screen displays subscription offerings from RevenueCat and handles purchases.
 * Users without an active subscription are blocked from tracking features.
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
import { useAuth } from '@/contexts/AuthContext';
import { useRevenueCat } from '@/contexts/RevenueCatContext';
import { PurchasesPackage } from 'react-native-purchases';
import { getRevenueCatDiagnostics } from '@/config/revenuecat';

// COMPLIANCE: Developer URLs (replace with actual URLs before submission)
const PRIVACY_POLICY_URL = 'https://forelandmarine.com/privacy';
const TERMS_OF_SERVICE_URL = 'https://forelandmarine.com/terms';
const SUPPORT_EMAIL = 'info@forelandmarine.com';

export default function SubscriptionPaywallScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const [showDiagnosticModal, setShowDiagnosticModal] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<PurchasesPackage | null>(null);
  const { signOut } = useAuth();
  const {
    subscriptionStatus,
    loading,
    offerings,
    purchasePackage,
    restorePurchases,
    hasActiveSubscription,
  } = useRevenueCat();

  useEffect(() => {
    console.log('[SubscriptionPaywall] Screen mounted');
    console.log('[SubscriptionPaywall] Subscription status:', subscriptionStatus);
    console.log('[SubscriptionPaywall] Has active subscription:', hasActiveSubscription);
    console.log('[SubscriptionPaywall] Offerings:', offerings);
    
    // Log diagnostic info
    const diagnostics = getRevenueCatDiagnostics();
    console.log('[SubscriptionPaywall] Configuration diagnostics:', diagnostics);
  }, [subscriptionStatus, hasActiveSubscription, offerings]);

  // Auto-select first package
  useEffect(() => {
    if (offerings && offerings.availablePackages.length > 0 && !selectedPackage) {
      setSelectedPackage(offerings.availablePackages[0]);
      console.log('[SubscriptionPaywall] Auto-selected first package:', offerings.availablePackages[0].identifier);
    }
  }, [offerings, selectedPackage]);

  const handlePurchase = async () => {
    if (!selectedPackage) {
      Alert.alert('Error', 'Please select a subscription package');
      return;
    }

    setPurchasing(true);
    try {
      console.log('[SubscriptionPaywall] Purchasing package:', selectedPackage.identifier);
      
      const success = await purchasePackage(selectedPackage);
      
      if (success) {
        Alert.alert(
          'Success!',
          'Your subscription is now active. You can start tracking your sea time.',
          [
            {
              text: 'Get Started',
              onPress: () => router.replace('/(tabs)/(home)'),
            },
          ]
        );
      } else {
        Alert.alert(
          'Purchase Failed',
          'Unable to complete your purchase. Please try again or contact support.'
        );
      }
    } catch (error: any) {
      console.error('[SubscriptionPaywall] Purchase error:', error);
      Alert.alert('Error', 'An error occurred during purchase. Please try again.');
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    try {
      console.log('[SubscriptionPaywall] Restoring purchases');
      
      const success = await restorePurchases();
      
      if (success) {
        Alert.alert(
          'Purchases Restored',
          'Your subscription has been restored successfully.',
          [
            {
              text: 'Continue',
              onPress: () => router.replace('/(tabs)/(home)'),
            },
          ]
        );
      } else {
        Alert.alert(
          'No Purchases Found',
          'We could not find any previous purchases to restore.'
        );
      }
    } catch (error: any) {
      console.error('[SubscriptionPaywall] Restore error:', error);
      Alert.alert('Error', 'An error occurred while restoring purchases. Please try again.');
    } finally {
      setRestoring(false);
    }
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

  const handleContactSupport = () => {
    const diagnostics = getRevenueCatDiagnostics();
    
    const diagnosticInfo = `
RevenueCat Configuration Issue

Platform: ${Platform.OS}
iOS API Key Configured: ${diagnostics.iosKey.configured ? 'Yes' : 'No'}
iOS API Key Format Valid: ${diagnostics.iosKey.validFormat ? 'Yes' : 'No'}
iOS API Key Prefix: ${diagnostics.iosKey.prefix}
iOS API Key Length: ${diagnostics.iosKey.length}

Android API Key Configured: ${diagnostics.androidKey.configured ? 'Yes' : 'No'}
Android API Key Format Valid: ${diagnostics.androidKey.validFormat ? 'Yes' : 'No'}
Android API Key Prefix: ${diagnostics.androidKey.prefix}
Android API Key Length: ${diagnostics.androidKey.length}

Offerings Available: ${offerings ? 'Yes' : 'No'}
Package Count: ${offerings?.availablePackages.length || 0}

Please help me configure RevenueCat properly.
    `.trim();
    
    const emailUrl = `mailto:${SUPPORT_EMAIL}?subject=SeaTime Tracker - RevenueCat Configuration Issue&body=${encodeURIComponent(diagnosticInfo)}`;
    Linking.openURL(emailUrl).catch(() => {
      Alert.alert(
        'Contact Support',
        `Please email us at ${SUPPORT_EMAIL} with the following information:\n\n${diagnosticInfo}`,
        [{ text: 'OK' }]
      );
    });
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

  const formatPrice = (pkg: PurchasesPackage): string => {
    return pkg.product.priceString;
  };

  const formatPeriod = (pkg: PurchasesPackage): string => {
    const period = pkg.packageType;
    switch (period) {
      case 'MONTHLY':
        return 'per month';
      case 'ANNUAL':
        return 'per year';
      case 'WEEKLY':
        return 'per week';
      default:
        return '';
    }
  };

  const getDiagnosticInfo = () => {
    const diagnostics = getRevenueCatDiagnostics();
    
    return {
      platform: Platform.OS,
      iosKey: diagnostics.iosKey,
      androidKey: diagnostics.androidKey,
      offerings: {
        available: !!offerings,
        count: offerings?.availablePackages.length || 0,
      },
    };
  };

  const styles = createStyles(isDark);

  const statusText = 'Subscription Required';
  const messageText = 'SeaTime Tracker requires an active subscription to track your sea time and generate MCA-compliant reports.';

  // Purchase button is ALWAYS enabled when offerings are available (for testing)
  const isPurchaseButtonEnabled = !purchasing && offerings && offerings.availablePackages.length > 0;

  // Check if configuration issue
  const diagnosticInfo = getDiagnosticInfo();
  const hasConfigIssue = !diagnosticInfo.iosKey.configured || !diagnosticInfo.androidKey.configured;

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

        {/* Configuration Info Banner (for testing) */}
        {hasConfigIssue && (
          <View style={styles.infoContainer}>
            <IconSymbol
              ios_icon_name="info.circle.fill"
              android_material_icon_name="info"
              size={24}
              color={colors.primary}
            />
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoTitle}>Sandbox Testing Mode</Text>
              <Text style={styles.infoText}>
                Using test API key for sandbox purchases. Check diagnostic info for details.
              </Text>
              <TouchableOpacity
                style={styles.diagnosticButton}
                onPress={() => setShowDiagnosticModal(true)}
              >
                <Text style={styles.diagnosticButtonText}>View Diagnostic Info</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Subscription Packages */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading subscription options...</Text>
          </View>
        ) : offerings && offerings.availablePackages.length > 0 ? (
          <View style={styles.packagesContainer}>
            {offerings.availablePackages.map((pkg) => {
              const isSelected = selectedPackage?.identifier === pkg.identifier;
              const priceText = formatPrice(pkg);
              const periodText = formatPeriod(pkg);
              
              return (
                <TouchableOpacity
                  key={pkg.identifier}
                  style={[
                    styles.packageCard,
                    isSelected && styles.packageCardSelected,
                  ]}
                  onPress={() => {
                    setSelectedPackage(pkg);
                    console.log('[SubscriptionPaywall] Selected package:', pkg.identifier);
                  }}
                >
                  <View style={styles.packageHeader}>
                    <Text style={styles.packageTitle}>{pkg.product.title}</Text>
                    {isSelected && (
                      <IconSymbol
                        ios_icon_name="checkmark.circle.fill"
                        android_material_icon_name="check-circle"
                        size={24}
                        color={colors.primary}
                      />
                    )}
                  </View>
                  <Text style={styles.packagePrice}>{priceText}</Text>
                  <Text style={styles.packagePeriod}>{periodText}</Text>
                  {pkg.product.description && (
                    <Text style={styles.packageDescription}>{pkg.product.description}</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          <View style={styles.noOffersContainer}>
            <IconSymbol
              ios_icon_name="exclamationmark.circle.fill"
              android_material_icon_name="error"
              size={48}
              color={colors.error}
            />
            <Text style={styles.noOffersText}>
              No subscription options available
            </Text>
            <Text style={styles.noOffersSubtext}>
              This usually means RevenueCat is not configured properly or no products are set up in the dashboard.
            </Text>
            <TouchableOpacity
              style={styles.setupButton}
              onPress={() => setShowDiagnosticModal(true)}
            >
              <Text style={styles.setupButtonText}>View Diagnostic Info</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[
              styles.button,
              styles.primaryButton,
              !isPurchaseButtonEnabled && styles.buttonDisabled,
            ]}
            onPress={handlePurchase}
            disabled={!isPurchaseButtonEnabled}
          >
            {purchasing ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>
                {isPurchaseButtonEnabled ? 'Subscribe Now' : 'Loading...'}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.secondaryButton, restoring && styles.buttonDisabled]}
            onPress={handleRestore}
            disabled={restoring}
          >
            {restoring ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Text style={styles.secondaryButtonText}>Restore Purchases</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.tertiaryButton]}
            onPress={handleContactSupport}
          >
            <IconSymbol
              ios_icon_name="envelope.fill"
              android_material_icon_name="email"
              size={20}
              color={isDark ? colors.textSecondary : colors.textSecondaryLight}
            />
            <Text style={styles.tertiaryButtonText}>Contact Support</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.signOutButton}
            onPress={() => setShowSignOutModal(true)}
          >
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        {/* COMPLIANCE: Required links */}
        <View style={styles.linksContainer}>
          <TouchableOpacity onPress={() => handleOpenLink(PRIVACY_POLICY_URL, 'Privacy Policy')}>
            <Text style={styles.linkText}>Privacy Policy</Text>
          </TouchableOpacity>
          <Text style={styles.linkSeparator}>•</Text>
          <TouchableOpacity onPress={() => handleOpenLink(TERMS_OF_SERVICE_URL, 'Terms of Service')}>
            <Text style={styles.linkText}>Terms of Service</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Subscriptions are managed through the App Store and will automatically renew unless cancelled at least 24 hours before the end of the current period.
          </Text>
          <Text style={styles.footerText}>
            Need help? Contact {SUPPORT_EMAIL}
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

      {/* Diagnostic Modal */}
      <Modal
        visible={showDiagnosticModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDiagnosticModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.diagnosticModalContent]}>
            <Text style={styles.modalTitle}>RevenueCat Configuration</Text>
            
            <ScrollView style={styles.diagnosticScroll}>
              <View style={styles.diagnosticSection}>
                <Text style={styles.diagnosticSectionTitle}>Current Status</Text>
                <Text style={styles.diagnosticText}>
                  Platform: {diagnosticInfo.platform}
                </Text>
                <Text style={styles.diagnosticText}>
                  Offerings Available: {diagnosticInfo.offerings.available ? 'Yes' : 'No'}
                </Text>
                <Text style={styles.diagnosticText}>
                  Package Count: {diagnosticInfo.offerings.count}
                </Text>
              </View>

              <View style={styles.diagnosticSection}>
                <Text style={styles.diagnosticSectionTitle}>iOS Configuration</Text>
                <Text style={styles.diagnosticText}>
                  Configured: {diagnosticInfo.iosKey.configured ? '✅' : '❌'}
                </Text>
                <Text style={styles.diagnosticText}>
                  Valid Format: {diagnosticInfo.iosKey.validFormat ? '✅' : '⚠️'}
                </Text>
                <Text style={styles.diagnosticText}>
                  Is Placeholder: {diagnosticInfo.iosKey.isPlaceholder ? '⚠️ Yes' : '✅ No'}
                </Text>
                <Text style={styles.diagnosticText}>
                  Key Prefix: {diagnosticInfo.iosKey.prefix}
                </Text>
                <Text style={styles.diagnosticText}>
                  Key Length: {diagnosticInfo.iosKey.length} characters
                </Text>
              </View>

              <View style={styles.diagnosticSection}>
                <Text style={styles.diagnosticSectionTitle}>Android Configuration</Text>
                <Text style={styles.diagnosticText}>
                  Configured: {diagnosticInfo.androidKey.configured ? '✅' : '❌'}
                </Text>
                <Text style={styles.diagnosticText}>
                  Valid Format: {diagnosticInfo.androidKey.validFormat ? '✅' : '⚠️'}
                </Text>
                <Text style={styles.diagnosticText}>
                  Is Placeholder: {diagnosticInfo.androidKey.isPlaceholder ? '⚠️ Yes' : '✅ No'}
                </Text>
                <Text style={styles.diagnosticText}>
                  Key Prefix: {diagnosticInfo.androidKey.prefix}
                </Text>
                <Text style={styles.diagnosticText}>
                  Key Length: {diagnosticInfo.androidKey.length} characters
                </Text>
              </View>

              <View style={styles.diagnosticSection}>
                <Text style={styles.diagnosticSectionTitle}>Testing Notes</Text>
                <Text style={styles.diagnosticInstructions}>
                  • For sandbox testing, use REVENUECAT_TEST_API_KEY environment variable
                  {'\n'}• The test API key should be set as a secret in your environment
                  {'\n'}• Restart the app after setting environment variables
                  {'\n'}• Check that the key is being loaded (see Key Length above)
                  {'\n\n'}For production deployment:
                  {'\n'}1. Go to RevenueCat Dashboard (app.revenuecat.com)
                  {'\n'}2. Navigate to Project Settings → API Keys
                  {'\n'}3. Copy your iOS API key (starts with appl_)
                  {'\n'}4. Copy your Android API key (starts with goog_)
                  {'\n'}5. Update app.json with your real API keys
                  {'\n'}6. Restart: npx expo start --clear
                </Text>
              </View>
            </ScrollView>

            <TouchableOpacity
              style={[styles.modalButton, styles.modalConfirmButton]}
              onPress={() => setShowDiagnosticModal(false)}
            >
              <Text style={styles.modalConfirmText}>Close</Text>
            </TouchableOpacity>
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
    infoContainer: {
      flexDirection: 'row',
      backgroundColor: isDark ? '#1a2a3a' : '#e3f2fd',
      borderRadius: 12,
      padding: 16,
      marginBottom: 24,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    infoTextContainer: {
      flex: 1,
      marginLeft: 12,
    },
    infoTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.primary,
      marginBottom: 4,
    },
    infoText: {
      fontSize: 14,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
      lineHeight: 20,
      marginBottom: 8,
    },
    diagnosticButton: {
      marginTop: 4,
    },
    diagnosticButtonText: {
      fontSize: 14,
      color: colors.primary,
      fontWeight: '600',
    },
    loadingContainer: {
      alignItems: 'center',
      padding: 40,
    },
    loadingText: {
      fontSize: 16,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
      marginTop: 16,
    },
    packagesContainer: {
      marginBottom: 24,
    },
    packageCard: {
      backgroundColor: isDark ? colors.cardBackground : colors.card,
      borderRadius: 16,
      padding: 20,
      marginBottom: 12,
      borderWidth: 2,
      borderColor: 'transparent',
    },
    packageCardSelected: {
      borderColor: colors.primary,
    },
    packageHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    packageTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: isDark ? colors.text : colors.textLight,
      flex: 1,
    },
    packagePrice: {
      fontSize: 32,
      fontWeight: 'bold',
      color: colors.primary,
      marginBottom: 4,
    },
    packagePeriod: {
      fontSize: 16,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
      marginBottom: 8,
    },
    packageDescription: {
      fontSize: 14,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
      lineHeight: 20,
    },
    noOffersContainer: {
      alignItems: 'center',
      padding: 40,
      backgroundColor: isDark ? colors.cardBackground : colors.card,
      borderRadius: 16,
      marginBottom: 24,
    },
    noOffersText: {
      fontSize: 18,
      fontWeight: '600',
      color: isDark ? colors.text : colors.textLight,
      textAlign: 'center',
      marginTop: 16,
      marginBottom: 8,
    },
    noOffersSubtext: {
      fontSize: 14,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
      textAlign: 'center',
      marginBottom: 4,
      lineHeight: 20,
    },
    setupButton: {
      marginTop: 16,
      paddingVertical: 12,
      paddingHorizontal: 24,
      backgroundColor: colors.primary,
      borderRadius: 8,
    },
    setupButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
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
    secondaryButton: {
      backgroundColor: 'transparent',
      borderWidth: 2,
      borderColor: colors.primary,
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    buttonText: {
      color: '#FFFFFF',
      fontSize: 18,
      fontWeight: '600',
    },
    secondaryButtonText: {
      color: colors.primary,
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
    diagnosticModalContent: {
      maxWidth: 500,
      maxHeight: '80%',
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
    diagnosticScroll: {
      width: '100%',
      marginBottom: 16,
    },
    diagnosticSection: {
      marginBottom: 20,
    },
    diagnosticSectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: isDark ? colors.text : colors.textLight,
      marginBottom: 8,
    },
    diagnosticText: {
      fontSize: 14,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
      marginBottom: 4,
      lineHeight: 20,
    },
    diagnosticInstructions: {
      fontSize: 14,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
      lineHeight: 22,
    },
  });
}

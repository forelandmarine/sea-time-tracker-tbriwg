
/**
 * RevenueCat Customer Center Screen
 * 
 * This screen provides subscription management features:
 * - View current subscription status
 * - Manage subscription (cancel, change plan)
 * - View billing history
 * - Restore purchases
 * - Contact support
 * 
 * This is a custom implementation. For native Customer Center UI,
 * see: https://www.revenuecat.com/docs/tools/customer-center
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  useColorScheme,
  Platform,
  Linking,
  Alert,
  Modal,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { useAuth } from '@/contexts/AuthContext';
import { useRevenueCat } from '@/contexts/RevenueCatContext';

const SUPPORT_EMAIL = 'info@forelandmarine.com';
const PRIVACY_POLICY_URL = 'https://forelandmarine.com/privacy';
const TERMS_OF_SERVICE_URL = 'https://forelandmarine.com/terms';

export default function CustomerCenterScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { user } = useAuth();
  const {
    customerInfo,
    subscriptionStatus,
    loading,
    restorePurchases,
    checkSubscription,
    isPro,
  } = useRevenueCat();

  const [restoring, setRestoring] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  useEffect(() => {
    console.log('[CustomerCenter] Screen mounted');
    console.log('[CustomerCenter] Subscription status:', subscriptionStatus);
    console.log('[CustomerCenter] Is Pro:', isPro);
  }, [subscriptionStatus, isPro]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await checkSubscription();
    } catch (error) {
      console.error('[CustomerCenter] Refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    try {
      console.log('[CustomerCenter] Restoring purchases');
      
      const success = await restorePurchases();
      
      if (success) {
        Alert.alert(
          'Success',
          'Your purchases have been restored successfully.'
        );
      } else {
        Alert.alert(
          'No Purchases Found',
          'We could not find any previous purchases to restore.'
        );
      }
    } catch (error: any) {
      console.error('[CustomerCenter] Restore error:', error);
      Alert.alert('Error', 'An error occurred while restoring purchases. Please try again.');
    } finally {
      setRestoring(false);
    }
  };

  const handleManageSubscription = () => {
    // Open platform-specific subscription management
    if (Platform.OS === 'ios') {
      Linking.openURL('https://apps.apple.com/account/subscriptions');
    } else if (Platform.OS === 'android') {
      Linking.openURL('https://play.google.com/store/account/subscriptions');
    } else {
      Alert.alert(
        'Manage Subscription',
        'Please visit your app store account to manage your subscription.'
      );
    }
  };

  const handleCancelSubscription = () => {
    setShowCancelModal(true);
  };

  const confirmCancel = () => {
    setShowCancelModal(false);
    handleManageSubscription();
  };

  const handleContactSupport = () => {
    const subject = 'SeaTime Tracker - Subscription Support';
    const body = `
User ID: ${user?.id || 'N/A'}
Email: ${user?.email || 'N/A'}
Subscription Status: ${subscriptionStatus.status}
Product ID: ${subscriptionStatus.productId || 'N/A'}

Please describe your issue:
    `.trim();

    const emailUrl = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    Linking.openURL(emailUrl).catch(() => {
      Alert.alert(
        'Contact Support',
        `Please email us at ${SUPPORT_EMAIL}`,
        [{ text: 'OK' }]
      );
    });
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

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return colors.success;
      case 'trial':
        return colors.primary;
      case 'expired':
      case 'inactive':
        return colors.error;
      default:
        return isDark ? colors.textSecondary : colors.textSecondaryLight;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active':
        return 'Active';
      case 'trial':
        return 'Trial';
      case 'expired':
        return 'Expired';
      case 'inactive':
        return 'Inactive';
      default:
        return 'Unknown';
    }
  };

  const styles = createStyles(isDark);

  const statusColor = getStatusColor(subscriptionStatus.status);
  const statusText = getStatusText(subscriptionStatus.status);

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Subscription',
          headerShown: true,
        }}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Subscription Status Card */}
        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <IconSymbol
              ios_icon_name={isPro ? 'checkmark.seal.fill' : 'exclamationmark.circle.fill'}
              android_material_icon_name={isPro ? 'verified' : 'error'}
              size={48}
              color={statusColor}
            />
            <View style={styles.statusTextContainer}>
              <Text style={[styles.statusTitle, { color: statusColor }]}>
                {statusText}
              </Text>
              <Text style={styles.statusSubtitle}>
                {isPro ? 'SeaTime Tracker Pro' : 'No active subscription'}
              </Text>
            </View>
          </View>

          {subscriptionStatus.expiresAt && (
            <View style={styles.statusDetail}>
              <Text style={styles.statusDetailLabel}>
                {subscriptionStatus.status === 'active' ? 'Renews on' : 'Expired on'}
              </Text>
              <Text style={styles.statusDetailValue}>
                {formatDate(subscriptionStatus.expiresAt)}
              </Text>
            </View>
          )}

          {subscriptionStatus.productId && (
            <View style={styles.statusDetail}>
              <Text style={styles.statusDetailLabel}>Plan</Text>
              <Text style={styles.statusDetailValue}>
                {subscriptionStatus.productId}
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.refreshButton}
            onPress={handleRefresh}
            disabled={refreshing}
          >
            {refreshing ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <>
                <IconSymbol
                  ios_icon_name="arrow.clockwise"
                  android_material_icon_name="refresh"
                  size={20}
                  color={colors.primary}
                />
                <Text style={styles.refreshButtonText}>Refresh Status</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Account Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Information</Text>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue}>{user?.email || 'N/A'}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>User ID</Text>
            <Text style={styles.infoValue} numberOfLines={1}>
              {user?.id || 'N/A'}
            </Text>
          </View>

          {customerInfo && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Customer ID</Text>
              <Text style={styles.infoValue} numberOfLines={1}>
                {customerInfo.originalAppUserId}
              </Text>
            </View>
          )}
        </View>

        {/* Subscription Management */}
        {isPro && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Manage Subscription</Text>
            
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleManageSubscription}
            >
              <IconSymbol
                ios_icon_name="gear"
                android_material_icon_name="settings"
                size={24}
                color={isDark ? colors.text : colors.textLight}
              />
              <Text style={styles.actionButtonText}>Manage in App Store</Text>
              <IconSymbol
                ios_icon_name="chevron.right"
                android_material_icon_name="chevron-right"
                size={20}
                color={isDark ? colors.textSecondary : colors.textSecondaryLight}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleCancelSubscription}
            >
              <IconSymbol
                ios_icon_name="xmark.circle"
                android_material_icon_name="cancel"
                size={24}
                color={colors.error}
              />
              <Text style={[styles.actionButtonText, { color: colors.error }]}>
                Cancel Subscription
              </Text>
              <IconSymbol
                ios_icon_name="chevron.right"
                android_material_icon_name="chevron-right"
                size={20}
                color={isDark ? colors.textSecondary : colors.textSecondaryLight}
              />
            </TouchableOpacity>
          </View>
        )}

        {/* Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Actions</Text>
          
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleRestore}
            disabled={restoring}
          >
            {restoring ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <IconSymbol
                ios_icon_name="arrow.clockwise.circle"
                android_material_icon_name="restore"
                size={24}
                color={isDark ? colors.text : colors.textLight}
              />
            )}
            <Text style={styles.actionButtonText}>Restore Purchases</Text>
            <IconSymbol
              ios_icon_name="chevron.right"
              android_material_icon_name="chevron-right"
              size={20}
              color={isDark ? colors.textSecondary : colors.textSecondaryLight}
            />
          </TouchableOpacity>

          {!isPro && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => router.push('/subscription-paywall')}
            >
              <IconSymbol
                ios_icon_name="star.circle"
                android_material_icon_name="star"
                size={24}
                color={colors.primary}
              />
              <Text style={[styles.actionButtonText, { color: colors.primary }]}>
                Subscribe Now
              </Text>
              <IconSymbol
                ios_icon_name="chevron.right"
                android_material_icon_name="chevron-right"
                size={20}
                color={isDark ? colors.textSecondary : colors.textSecondaryLight}
              />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleContactSupport}
          >
            <IconSymbol
              ios_icon_name="envelope"
              android_material_icon_name="email"
              size={24}
              color={isDark ? colors.text : colors.textLight}
            />
            <Text style={styles.actionButtonText}>Contact Support</Text>
            <IconSymbol
              ios_icon_name="chevron.right"
              android_material_icon_name="chevron-right"
              size={20}
              color={isDark ? colors.textSecondary : colors.textSecondaryLight}
            />
          </TouchableOpacity>
        </View>

        {/* Legal Links */}
        <View style={styles.linksContainer}>
          <TouchableOpacity onPress={() => handleOpenLink(PRIVACY_POLICY_URL, 'Privacy Policy')}>
            <Text style={styles.linkText}>Privacy Policy</Text>
          </TouchableOpacity>
          <Text style={styles.linkSeparator}>•</Text>
          <TouchableOpacity onPress={() => handleOpenLink(TERMS_OF_SERVICE_URL, 'Terms of Service')}>
            <Text style={styles.linkText}>Terms of Service</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Cancel Confirmation Modal */}
      <Modal
        visible={showCancelModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCancelModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <IconSymbol
              ios_icon_name="exclamationmark.triangle.fill"
              android_material_icon_name="warning"
              size={48}
              color={colors.error}
            />
            <Text style={styles.modalTitle}>Cancel Subscription?</Text>
            <Text style={styles.modalMessage}>
              You&apos;ll lose access to premium features when your current billing period ends. You can manage your subscription in the App Store.
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={() => setShowCancelModal(false)}
              >
                <Text style={styles.modalCancelText}>Keep Subscription</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalConfirmButton]}
                onPress={confirmCancel}
              >
                <Text style={styles.modalConfirmText}>Manage in App Store</Text>
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
      padding: 20,
      paddingBottom: 40,
    },
    statusCard: {
      backgroundColor: isDark ? colors.cardBackground : colors.card,
      borderRadius: 16,
      padding: 20,
      marginBottom: 20,
    },
    statusHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
    },
    statusTextContainer: {
      marginLeft: 16,
      flex: 1,
    },
    statusTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      marginBottom: 4,
    },
    statusSubtitle: {
      fontSize: 16,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
    },
    statusDetail: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12,
      borderTopWidth: 1,
      borderTopColor: isDark ? colors.border : colors.borderLight,
    },
    statusDetailLabel: {
      fontSize: 14,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
    },
    statusDetailValue: {
      fontSize: 14,
      fontWeight: '600',
      color: isDark ? colors.text : colors.textLight,
    },
    refreshButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 16,
      paddingVertical: 12,
      borderRadius: 8,
      backgroundColor: isDark ? '#1a1a1a' : '#f5f5f5',
    },
    refreshButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.primary,
      marginLeft: 8,
    },
    section: {
      backgroundColor: isDark ? colors.cardBackground : colors.card,
      borderRadius: 16,
      padding: 20,
      marginBottom: 20,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: isDark ? colors.text : colors.textLight,
      marginBottom: 16,
    },
    infoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? colors.border : colors.borderLight,
    },
    infoLabel: {
      fontSize: 14,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
    },
    infoValue: {
      fontSize: 14,
      fontWeight: '500',
      color: isDark ? colors.text : colors.textLight,
      flex: 1,
      textAlign: 'right',
      marginLeft: 16,
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? colors.border : colors.borderLight,
    },
    actionButtonText: {
      fontSize: 16,
      color: isDark ? colors.text : colors.textLight,
      marginLeft: 12,
      flex: 1,
    },
    linksContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 20,
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
      flexDirection: 'column',
      gap: 12,
      width: '100%',
    },
    modalButton: {
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

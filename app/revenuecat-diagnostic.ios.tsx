
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  useColorScheme,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import { REVENUECAT_CONFIG } from '@/config/revenuecat';
import { useRevenueCat } from '@/contexts/RevenueCatContext';
import Constants from 'expo-constants';

const createStyles = (isDark: boolean, topInset: number) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? colors.background : '#f5f5f5',
      paddingTop: topInset,
    },
    scrollContent: {
      padding: 20,
      paddingBottom: 40,
    },
    header: {
      alignItems: 'center',
      marginBottom: 30,
      marginTop: 20,
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      color: isDark ? colors.text : '#000',
      textAlign: 'center',
      marginBottom: 8,
      marginTop: 12,
    },
    subtitle: {
      fontSize: 14,
      color: isDark ? colors.textSecondary : '#666',
      textAlign: 'center',
    },
    section: {
      backgroundColor: isDark ? colors.card : '#fff',
      borderRadius: 12,
      padding: 20,
      marginBottom: 16,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: isDark ? colors.text : '#000',
      marginBottom: 16,
    },
    checkItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 12,
    },
    checkIcon: {
      marginRight: 12,
      marginTop: 2,
    },
    checkText: {
      flex: 1,
      fontSize: 14,
      color: isDark ? colors.text : '#000',
      lineHeight: 20,
    },
    infoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
    },
    infoRowLast: {
      borderBottomWidth: 0,
      marginBottom: 0,
      paddingBottom: 0,
    },
    infoLabel: {
      fontSize: 14,
      color: isDark ? colors.textSecondary : '#666',
      flex: 1,
    },
    infoValue: {
      fontSize: 14,
      fontWeight: '500',
      color: isDark ? colors.text : '#000',
      maxWidth: '60%',
      textAlign: 'right',
    },
    statusBadge: {
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 12,
    },
    statusBadgeSuccess: {
      backgroundColor: '#4CAF50',
    },
    statusBadgeError: {
      backgroundColor: '#f44336',
    },
    statusBadgeWarning: {
      backgroundColor: '#ff9800',
    },
    statusBadgeText: {
      color: '#fff',
      fontSize: 12,
      fontWeight: '600',
    },
    actionButton: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
      marginBottom: 12,
    },
    actionButtonDisabled: {
      backgroundColor: isDark ? '#333' : '#ccc',
    },
    actionButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
    },
    codeBlock: {
      backgroundColor: isDark ? '#000' : '#f5f5f5',
      borderRadius: 8,
      padding: 12,
      marginTop: 8,
    },
    codeText: {
      fontFamily: 'Courier',
      fontSize: 12,
      color: isDark ? '#4CAF50' : '#2e7d32',
    },
    warningBox: {
      backgroundColor: isDark ? 'rgba(255, 152, 0, 0.1)' : 'rgba(255, 152, 0, 0.1)',
      borderLeftWidth: 4,
      borderLeftColor: '#ff9800',
      borderRadius: 8,
      padding: 12,
      marginTop: 12,
    },
    warningText: {
      fontSize: 13,
      color: isDark ? colors.text : '#000',
      lineHeight: 20,
    },
    errorBox: {
      backgroundColor: isDark ? 'rgba(244, 67, 54, 0.1)' : 'rgba(244, 67, 54, 0.1)',
      borderLeftWidth: 4,
      borderLeftColor: '#f44336',
      borderRadius: 8,
      padding: 12,
      marginTop: 12,
    },
    errorText: {
      fontSize: 13,
      color: isDark ? colors.text : '#000',
      lineHeight: 20,
    },
    successBox: {
      backgroundColor: isDark ? 'rgba(76, 175, 80, 0.1)' : 'rgba(76, 175, 80, 0.1)',
      borderLeftWidth: 4,
      borderLeftColor: '#4CAF50',
      borderRadius: 8,
      padding: 12,
      marginTop: 12,
    },
    successText: {
      fontSize: 13,
      color: isDark ? colors.text : '#000',
      lineHeight: 20,
    },
  });

export default function RevenueCatDiagnosticScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();
  const styles = createStyles(isDark, insets.top);
  const router = useRouter();

  const {
    isInitialized,
    isLoading,
    isPro,
    customerInfo,
    offerings,
    refreshCustomerInfo,
  } = useRevenueCat();

  const [diagnostics, setDiagnostics] = useState<any>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    console.log('[Diagnostic] Loading diagnostics');
    const diag = REVENUECAT_CONFIG.getDiagnostics();
    setDiagnostics(diag);
    console.log('[Diagnostic] Diagnostics loaded:', JSON.stringify(diag, null, 2));
  }, []);

  const handleRefresh = async () => {
    console.log('[Diagnostic] User tapped Refresh button');
    setIsRefreshing(true);
    try {
      await refreshCustomerInfo();
      Alert.alert('Success', 'Customer info refreshed successfully');
    } catch (error: any) {
      console.error('[Diagnostic] Refresh error:', error);
      Alert.alert('Error', 'Failed to refresh customer info');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleViewPaywall = () => {
    console.log('[Diagnostic] User tapped View Paywall button');
    if (!isInitialized) {
      Alert.alert('Not Available', 'RevenueCat is not initialized. Please check your configuration.');
      return;
    }
    router.push('/revenuecat-paywall');
  };

  const handleViewCustomerCenter = () => {
    console.log('[Diagnostic] User tapped View Customer Center button');
    if (!isInitialized) {
      Alert.alert('Not Available', 'RevenueCat is not initialized. Please check your configuration.');
      return;
    }
    router.push('/revenuecat-customer-center');
  };

  const configValid = REVENUECAT_CONFIG.isValid();
  const iosKeyValid = diagnostics?.iosKey?.configured && diagnostics?.iosKey?.validFormat;
  const androidKeyValid = diagnostics?.androidKey?.configured && diagnostics?.androidKey?.validFormat;
  const currentPlatformKeyValid = Platform.OS === 'ios' ? iosKeyValid : androidKeyValid;

  const overallStatus = configValid && isInitialized && currentPlatformKeyValid;

  const statusIcon = overallStatus ? 'check-circle' : 'error';
  const statusColor = overallStatus ? '#4CAF50' : '#f44336';
  const statusText = overallStatus ? 'Configuration Complete' : 'Configuration Incomplete';

  return (
    <>
      <Stack.Screen
        options={{
          title: 'RevenueCat Diagnostic',
          headerShown: true,
          headerBackTitle: 'Back',
        }}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <IconSymbol
            ios_icon_name="wrench.and.screwdriver"
            android_material_icon_name={statusIcon}
            size={48}
            color={statusColor}
          />
          <Text style={styles.title}>{statusText}</Text>
          <Text style={styles.subtitle}>
            Detailed RevenueCat integration diagnostics
          </Text>
        </View>

        {/* Overall Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Overall Status</Text>

          {overallStatus ? (
            <View style={styles.successBox}>
              <Text style={styles.successText}>
                ✅ RevenueCat is properly configured and initialized for iOS
              </Text>
            </View>
          ) : (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>
                ❌ RevenueCat configuration is incomplete. Please review the issues below.
              </Text>
            </View>
          )}
        </View>

        {/* Platform Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Platform Information</Text>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Current Platform</Text>
            <Text style={styles.infoValue}>iOS</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>iOS Version</Text>
            <Text style={styles.infoValue}>{Platform.Version}</Text>
          </View>

          <View style={[styles.infoRow, styles.infoRowLast]}>
            <Text style={styles.infoLabel}>Expo SDK</Text>
            <Text style={styles.infoValue}>{Constants.expoConfig?.sdkVersion || 'Unknown'}</Text>
          </View>
        </View>

        {/* Configuration Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Configuration Checks</Text>

          <View style={styles.checkItem}>
            <IconSymbol
              ios_icon_name={configValid ? 'checkmark.circle.fill' : 'xmark.circle.fill'}
              android_material_icon_name={configValid ? 'check-circle' : 'error'}
              size={24}
              color={configValid ? '#4CAF50' : '#f44336'}
              style={styles.checkIcon}
            />
            <Text style={styles.checkText}>
              Configuration Valid: {configValid ? 'Yes' : 'No'}
            </Text>
          </View>

          <View style={styles.checkItem}>
            <IconSymbol
              ios_icon_name={iosKeyValid ? 'checkmark.circle.fill' : 'xmark.circle.fill'}
              android_material_icon_name={iosKeyValid ? 'check-circle' : 'error'}
              size={24}
              color={iosKeyValid ? '#4CAF50' : '#f44336'}
              style={styles.checkIcon}
            />
            <Text style={styles.checkText}>
              iOS API Key: {iosKeyValid ? 'Valid' : 'Missing or Invalid'}
              {diagnostics?.iosKey?.isPlaceholder && ' (Placeholder detected)'}
            </Text>
          </View>

          <View style={styles.checkItem}>
            <IconSymbol
              ios_icon_name={isInitialized ? 'checkmark.circle.fill' : 'xmark.circle.fill'}
              android_material_icon_name={isInitialized ? 'check-circle' : 'error'}
              size={24}
              color={isInitialized ? '#4CAF50' : '#f44336'}
              style={styles.checkIcon}
            />
            <Text style={styles.checkText}>
              SDK Initialized: {isInitialized ? 'Yes' : 'No'}
            </Text>
          </View>
        </View>

        {/* API Keys Details */}
        {diagnostics && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>iOS API Key Details</Text>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Key Prefix</Text>
              <Text style={styles.infoValue}>{diagnostics.iosKey.prefix}</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Key Length</Text>
              <Text style={styles.infoValue}>{diagnostics.iosKey.length} chars</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Key Format</Text>
              <View style={[
                styles.statusBadge,
                diagnostics.iosKey.validFormat ? styles.statusBadgeSuccess : styles.statusBadgeError
              ]}>
                <Text style={styles.statusBadgeText}>
                  {diagnostics.iosKey.validFormat ? 'Valid' : 'Invalid'}
                </Text>
              </View>
            </View>

            <View style={[styles.infoRow, styles.infoRowLast]}>
              <Text style={styles.infoLabel}>Entitlement ID</Text>
              <Text style={styles.infoValue}>{REVENUECAT_CONFIG.entitlementID}</Text>
            </View>

            {!iosKeyValid && (
              <View style={styles.warningBox}>
                <Text style={styles.warningText}>
                  ⚠️ iOS API keys should start with 'appl_' or 'test_' for testing.
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Subscription Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Subscription Status</Text>

          {isLoading ? (
            <View style={{ alignItems: 'center', paddingVertical: 20 }}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.subtitle, { marginTop: 12 }]}>Loading...</Text>
            </View>
          ) : (
            <>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Subscription Status</Text>
                <View style={[styles.statusBadge, isPro ? styles.statusBadgeSuccess : styles.statusBadgeError]}>
                  <Text style={styles.statusBadgeText}>{isPro ? 'Pro' : 'Free'}</Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Customer Info</Text>
                <Text style={styles.infoValue}>{customerInfo ? 'Loaded' : 'Not Available'}</Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Offerings</Text>
                <Text style={styles.infoValue}>{offerings ? 'Available' : 'Not Available'}</Text>
              </View>

              {offerings && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Available Packages</Text>
                  <Text style={styles.infoValue}>
                    {offerings.availablePackages?.length || 0}
                  </Text>
                </View>
              )}

              {customerInfo && (
                <View style={[styles.infoRow, styles.infoRowLast]}>
                  <Text style={styles.infoLabel}>Active Entitlements</Text>
                  <Text style={styles.infoValue}>
                    {Object.keys(customerInfo.entitlements.active).length}
                  </Text>
                </View>
              )}

              {!isInitialized && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>
                    ❌ SDK not initialized. Cannot fetch subscription status.
                  </Text>
                </View>
              )}
            </>
          )}
        </View>

        {/* Actions */}
        <TouchableOpacity
          style={[styles.actionButton, (!isInitialized || isRefreshing) && styles.actionButtonDisabled]}
          onPress={handleRefresh}
          disabled={!isInitialized || isRefreshing}
        >
          <Text style={styles.actionButtonText}>
            {isRefreshing ? 'Refreshing...' : 'Refresh Customer Info'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, !isInitialized && styles.actionButtonDisabled]}
          onPress={handleViewPaywall}
          disabled={!isInitialized}
        >
          <Text style={styles.actionButtonText}>View Paywall</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, !isInitialized && styles.actionButtonDisabled]}
          onPress={handleViewCustomerCenter}
          disabled={!isInitialized}
        >
          <Text style={styles.actionButtonText}>View Customer Center</Text>
        </TouchableOpacity>

        {/* Setup Instructions */}
        {!configValid && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Setup Instructions</Text>
            <Text style={styles.checkText}>
              To configure RevenueCat for iOS, add your API key to app.json:
            </Text>
            <View style={styles.codeBlock}>
              <Text style={styles.codeText}>
{`"extra": {
  "revenueCat": {
    "iosApiKey": "appl_YOUR_IOS_KEY"
  }
}`}
              </Text>
            </View>
            <View style={styles.warningBox}>
              <Text style={styles.warningText}>
                📝 Steps to fix:{'\n'}
                1. Get your iOS API key from RevenueCat dashboard{'\n'}
                2. Update app.json with your actual key{'\n'}
                3. Run: npx expo prebuild --clean{'\n'}
                4. Run: cd ios && pod install && cd ..{'\n'}
                5. Rebuild your app
              </Text>
            </View>
          </View>
        )}

        {/* Next Steps */}
        {configValid && !isInitialized && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Next Steps</Text>
            <View style={styles.warningBox}>
              <Text style={styles.warningText}>
                SDK is not initialized despite valid configuration. This could mean:{'\n\n'}
                • Native modules need to be rebuilt{'\n'}
                • There's an initialization error (check logs){'\n'}
                • StoreKit configuration is missing{'\n\n'}
                Try rebuilding the app with:{'\n'}
                npx expo prebuild --clean{'\n'}
                cd ios && pod install && cd ..
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </>
  );
}

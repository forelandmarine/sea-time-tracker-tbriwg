
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
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import { REVENUECAT_CONFIG } from '@/config/revenuecat';
import { useRevenueCat } from '@/contexts/RevenueCatContext';

const createStyles = (isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? colors.background : '#f5f5f5',
    },
    scrollContent: {
      padding: 20,
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
      alignItems: 'center',
      marginBottom: 12,
    },
    checkIcon: {
      marginRight: 12,
    },
    checkText: {
      flex: 1,
      fontSize: 14,
      color: isDark ? colors.text : '#000',
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
      fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
      fontSize: 12,
      color: isDark ? '#4CAF50' : '#2e7d32',
    },
  });

export default function RevenueCatDiagnosticScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const styles = createStyles(isDark);
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

  useEffect(() => {
    console.log('[Diagnostic] Loading diagnostics');
    const diag = REVENUECAT_CONFIG.getDiagnostics();
    setDiagnostics(diag);
    console.log('[Diagnostic] Diagnostics loaded:', diag);
  }, []);

  const handleRefresh = () => {
    console.log('[Diagnostic] User tapped Refresh button');
    refreshCustomerInfo();
  };

  const handleViewPaywall = () => {
    console.log('[Diagnostic] User tapped View Paywall button');
    router.push('/revenuecat-paywall');
  };

  const handleViewCustomerCenter = () => {
    console.log('[Diagnostic] User tapped View Customer Center button');
    router.push('/revenuecat-customer-center');
  };

  const configValid = REVENUECAT_CONFIG.isValid();
  const iosKeyValid = diagnostics?.iosKey?.configured && diagnostics?.iosKey?.validFormat;
  const androidKeyValid = diagnostics?.androidKey?.configured && diagnostics?.androidKey?.validFormat;

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
            android_material_icon_name="settings"
            size={48}
            color={colors.primary}
          />
          <Text style={styles.title}>RevenueCat Diagnostic</Text>
          <Text style={styles.subtitle}>
            Verify your RevenueCat integration configuration
          </Text>
        </View>

        {/* Configuration Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Configuration Status</Text>

          <View style={styles.checkItem}>
            <IconSymbol
              ios_icon_name={configValid ? 'checkmark.circle.fill' : 'xmark.circle.fill'}
              android_material_icon_name={configValid ? 'check-circle' : 'error'}
              size={24}
              color={configValid ? '#4CAF50' : '#f44336'}
              style={styles.checkIcon}
            />
            <Text style={styles.checkText}>
              Configuration {configValid ? 'Valid' : 'Invalid'}
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
              iOS API Key {iosKeyValid ? 'Configured' : 'Missing or Invalid'}
            </Text>
          </View>

          <View style={styles.checkItem}>
            <IconSymbol
              ios_icon_name={androidKeyValid ? 'checkmark.circle.fill' : 'xmark.circle.fill'}
              android_material_icon_name={androidKeyValid ? 'check-circle' : 'error'}
              size={24}
              color={androidKeyValid ? '#4CAF50' : '#f44336'}
              style={styles.checkIcon}
            />
            <Text style={styles.checkText}>
              Android API Key {androidKeyValid ? 'Configured' : 'Missing or Invalid'}
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
              SDK {isInitialized ? 'Initialized' : 'Not Initialized'}
            </Text>
          </View>
        </View>

        {/* API Keys */}
        {diagnostics && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>API Keys</Text>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Platform</Text>
              <Text style={styles.infoValue}>{diagnostics.platform}</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>iOS Key Prefix</Text>
              <Text style={styles.infoValue}>{diagnostics.iosKey.prefix}</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>iOS Key Length</Text>
              <Text style={styles.infoValue}>{diagnostics.iosKey.length}</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Android Key Prefix</Text>
              <Text style={styles.infoValue}>{diagnostics.androidKey.prefix}</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Android Key Length</Text>
              <Text style={styles.infoValue}>{diagnostics.androidKey.length}</Text>
            </View>

            <View style={[styles.infoRow, styles.infoRowLast]}>
              <Text style={styles.infoLabel}>Entitlement ID</Text>
              <Text style={styles.infoValue}>{REVENUECAT_CONFIG.entitlementID}</Text>
            </View>
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
                <Text style={styles.infoLabel}>Status</Text>
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
                <View style={[styles.infoRow, styles.infoRowLast]}>
                  <Text style={styles.infoLabel}>Packages</Text>
                  <Text style={styles.infoValue}>
                    {offerings.availablePackages?.length || 0}
                  </Text>
                </View>
              )}
            </>
          )}
        </View>

        {/* Actions */}
        <TouchableOpacity style={styles.actionButton} onPress={handleRefresh}>
          <Text style={styles.actionButtonText}>Refresh Customer Info</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={handleViewPaywall}>
          <Text style={styles.actionButtonText}>View Paywall</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={handleViewCustomerCenter}>
          <Text style={styles.actionButtonText}>View Customer Center</Text>
        </TouchableOpacity>

        {/* Setup Instructions */}
        {!configValid && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Setup Instructions</Text>
            <Text style={styles.checkText}>
              To configure RevenueCat, add the following to your app.json:
            </Text>
            <View style={styles.codeBlock}>
              <Text style={styles.codeText}>
                {`"extra": {
  "revenueCat": {
    "iosApiKey": "appl_YOUR_IOS_KEY",
    "androidApiKey": "goog_YOUR_ANDROID_KEY"
  }
}`}
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </>
  );
}

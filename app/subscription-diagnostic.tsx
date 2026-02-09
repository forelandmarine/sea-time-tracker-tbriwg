
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
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { useAuth } from '@/contexts/AuthContext';
import { useRevenueCat } from '@/contexts/RevenueCatContext';
import { authenticatedGet } from '@/utils/api';
import { REVENUECAT_CONFIG } from '@/config/revenuecat';
import Purchases from 'react-native-purchases';

interface DiagnosticResult {
  category: string;
  checks: {
    name: string;
    status: 'pass' | 'fail' | 'warning' | 'info';
    message: string;
    details?: string;
  }[];
}

export default function SubscriptionDiagnosticScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const styles = createStyles(isDark);
  const router = useRouter();
  const { user } = useAuth();
  const {
    subscriptionStatus,
    customerInfo,
    offerings,
    hasActiveSubscription,
  } = useRevenueCat();

  const [loading, setLoading] = useState(true);
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult[]>([]);
  const [backendStatus, setBackendStatus] = useState<any>(null);

  useEffect(() => {
    runDiagnostics();
  }, []);

  const runDiagnostics = async () => {
    console.log('[Diagnostic] Starting subscription diagnostics');
    setLoading(true);

    const results: DiagnosticResult[] = [];

    // 1. Configuration Checks
    const configChecks: DiagnosticResult = {
      category: 'Configuration',
      checks: [],
    };

    // Check iOS API Key
    const iosApiKey = REVENUECAT_CONFIG.iosApiKey;
    const iosApiKeyText = iosApiKey;
    configChecks.checks.push({
      name: 'iOS API Key',
      status: iosApiKey && !iosApiKey.includes('YOUR_') ? 'pass' : 'fail',
      message: iosApiKey && !iosApiKey.includes('YOUR_')
        ? 'Configured'
        : 'Not configured',
      details: iosApiKeyText,
    });

    // Check Android API Key
    const androidApiKey = REVENUECAT_CONFIG.androidApiKey;
    const androidApiKeyText = androidApiKey;
    configChecks.checks.push({
      name: 'Android API Key',
      status: androidApiKey && !androidApiKey.includes('YOUR_') ? 'pass' : 'fail',
      message: androidApiKey && !androidApiKey.includes('YOUR_')
        ? 'Configured'
        : 'Not configured',
      details: androidApiKeyText,
    });

    // Check Product IDs
    const monthlyProduct = REVENUECAT_CONFIG.products.monthly;
    const monthlyProductText = monthlyProduct;
    configChecks.checks.push({
      name: 'Monthly Product ID',
      status: monthlyProduct === 'com.forelandmarine.seatime.monthly' ? 'pass' : 'warning',
      message: monthlyProduct === 'com.forelandmarine.seatime.monthly'
        ? 'Matches expected ID'
        : 'Does not match expected ID',
      details: monthlyProductText,
    });

    results.push(configChecks);

    // 2. RevenueCat SDK Checks
    const sdkChecks: DiagnosticResult = {
      category: 'RevenueCat SDK',
      checks: [],
    };

    try {
      const isConfigured = await Purchases.isConfigured();
      const isConfiguredText = isConfigured ? 'Yes' : 'No';
      sdkChecks.checks.push({
        name: 'SDK Initialized',
        status: isConfigured ? 'pass' : 'fail',
        message: isConfigured ? 'SDK is configured' : 'SDK not configured',
        details: isConfiguredText,
      });

      if (isConfigured) {
        const appUserId = await Purchases.getAppUserID();
        const appUserIdText = appUserId;
        sdkChecks.checks.push({
          name: 'App User ID',
          status: appUserId ? 'pass' : 'warning',
          message: appUserId ? 'User ID set' : 'No user ID',
          details: appUserIdText,
        });
      }
    } catch (error: any) {
      const errorMessage = error?.message || 'Unknown error';
      sdkChecks.checks.push({
        name: 'SDK Status',
        status: 'fail',
        message: 'Error checking SDK',
        details: errorMessage,
      });
    }

    results.push(sdkChecks);

    // 3. Customer Info Checks
    const customerChecks: DiagnosticResult = {
      category: 'Customer Info',
      checks: [],
    };

    if (customerInfo) {
      const hasEntitlements = Object.keys(customerInfo.entitlements.active).length > 0;
      const hasEntitlementsText = hasEntitlements ? 'Yes' : 'No';
      customerChecks.checks.push({
        name: 'Active Entitlements',
        status: hasEntitlements ? 'pass' : 'info',
        message: hasEntitlements
          ? `${Object.keys(customerInfo.entitlements.active).length} active`
          : 'No active entitlements',
        details: hasEntitlementsText,
      });

      if (hasEntitlements) {
        const entitlementKey = Object.keys(customerInfo.entitlements.active)[0];
        const entitlement = customerInfo.entitlements.active[entitlementKey];
        const productId = entitlement.productIdentifier;
        const productIdText = productId;

        customerChecks.checks.push({
          name: 'Product ID',
          status: productId === 'com.forelandmarine.seatime.monthly' ? 'pass' : 'warning',
          message: productId === 'com.forelandmarine.seatime.monthly'
            ? 'Correct product ID'
            : 'Unexpected product ID',
          details: productIdText,
        });

        const expirationDate = entitlement.expirationDate;
        const expirationDateText = expirationDate || 'None';
        customerChecks.checks.push({
          name: 'Expiration Date',
          status: expirationDate ? 'info' : 'warning',
          message: expirationDate ? 'Set' : 'Not set',
          details: expirationDateText,
        });
      }
    } else {
      customerChecks.checks.push({
        name: 'Customer Info',
        status: 'warning',
        message: 'No customer info available',
        details: 'RevenueCat customer info not loaded',
      });
    }

    results.push(customerChecks);

    // 4. Offerings Checks
    const offeringsChecks: DiagnosticResult = {
      category: 'Offerings',
      checks: [],
    };

    if (offerings) {
      const packageCount = offerings.availablePackages.length;
      const packageCountText = packageCount.toString();
      offeringsChecks.checks.push({
        name: 'Available Packages',
        status: packageCount > 0 ? 'pass' : 'warning',
        message: packageCount > 0
          ? `${packageCount} packages available`
          : 'No packages available',
        details: packageCountText,
      });

      offerings.availablePackages.forEach((pkg, index) => {
        const productId = pkg.product.identifier;
        const productIdText = productId;
        const indexText = (index + 1).toString();
        offeringsChecks.checks.push({
          name: `Package ${indexText}`,
          status: 'info',
          message: pkg.product.title,
          details: productIdText,
        });
      });
    } else {
      offeringsChecks.checks.push({
        name: 'Offerings',
        status: 'warning',
        message: 'No offerings available',
        details: 'RevenueCat offerings not loaded',
      });
    }

    results.push(offeringsChecks);

    // 5. Backend Sync Checks
    const backendChecks: DiagnosticResult = {
      category: 'Backend Sync',
      checks: [],
    };

    try {
      const backendSubStatus = await authenticatedGet<any>('/api/subscription/status');
      setBackendStatus(backendSubStatus);

      const backendStatusText = backendSubStatus.status;
      backendChecks.checks.push({
        name: 'Backend Status',
        status: backendSubStatus.status === 'active' ? 'pass' : 'info',
        message: `Status: ${backendSubStatus.status}`,
        details: backendStatusText,
      });

      const backendProductId = backendSubStatus.productId;
      const backendProductIdText = backendProductId || 'None';
      backendChecks.checks.push({
        name: 'Backend Product ID',
        status: backendProductId === 'com.forelandmarine.seatime.monthly' ? 'pass' : 'warning',
        message: backendProductId === 'com.forelandmarine.seatime.monthly'
          ? 'Correct product ID'
          : backendProductId
          ? 'Unexpected product ID'
          : 'Not set',
        details: backendProductIdText,
      });

      const backendExpiresAt = backendSubStatus.expiresAt;
      const backendExpiresAtText = backendExpiresAt || 'None';
      backendChecks.checks.push({
        name: 'Backend Expiration',
        status: backendExpiresAt ? 'info' : 'warning',
        message: backendExpiresAt ? 'Set' : 'Not set',
        details: backendExpiresAtText,
      });
    } catch (error: any) {
      const errorMessage = error?.message || 'Unknown error';
      backendChecks.checks.push({
        name: 'Backend Sync',
        status: 'fail',
        message: 'Error fetching backend status',
        details: errorMessage,
      });
    }

    results.push(backendChecks);

    // 6. Overall Status
    const statusChecks: DiagnosticResult = {
      category: 'Overall Status',
      checks: [],
    };

    const frontendStatusText = subscriptionStatus.status;
    statusChecks.checks.push({
      name: 'Frontend Status',
      status: hasActiveSubscription ? 'pass' : 'info',
      message: `Status: ${subscriptionStatus.status}`,
      details: frontendStatusText,
    });

    const hasActiveText = hasActiveSubscription ? 'Yes' : 'No';
    statusChecks.checks.push({
      name: 'Has Active Subscription',
      status: hasActiveSubscription ? 'pass' : 'info',
      message: hasActiveSubscription ? 'Active' : 'Inactive',
      details: hasActiveText,
    });

    results.push(statusChecks);

    setDiagnostics(results);
    setLoading(false);
    console.log('[Diagnostic] Diagnostics complete');
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pass':
        return { name: 'check-circle', color: colors.success };
      case 'fail':
        return { name: 'error', color: colors.error };
      case 'warning':
        return { name: 'warning', color: '#FFA500' };
      case 'info':
        return { name: 'info', color: colors.primary };
      default:
        return { name: 'help', color: colors.textSecondary };
    }
  };

  const statusText = 'Subscription Diagnostics';

  return (
    <>
      <Stack.Screen
        options={{
          title: statusText,
          headerShown: true,
          headerStyle: {
            backgroundColor: isDark ? colors.backgroundDark : colors.backgroundLight,
          },
          headerTintColor: isDark ? colors.textDark : colors.textLight,
        }}
      />

      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <IconSymbol
            ios_icon_name="checkmark.seal.fill"
            android_material_icon_name="verified"
            size={48}
            color={colors.primary}
          />
          <Text style={styles.title}>{statusText}</Text>
          <Text style={styles.subtitle}>
            Verify subscription configuration and App Store integration
          </Text>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Running diagnostics...</Text>
          </View>
        ) : (
          <>
            {diagnostics.map((result, index) => {
              const categoryText = result.category;
              return (
                <View key={index} style={styles.categoryContainer}>
                  <Text style={styles.categoryTitle}>{categoryText}</Text>
                  {result.checks.map((check, checkIndex) => {
                    const icon = getStatusIcon(check.status);
                    const checkNameText = check.name;
                    const checkMessageText = check.message;
                    const checkDetailsText = check.details || '';
                    return (
                      <View key={checkIndex} style={styles.checkContainer}>
                        <View style={styles.checkHeader}>
                          <IconSymbol
                            ios_icon_name={icon.name}
                            android_material_icon_name={icon.name}
                            size={24}
                            color={icon.color}
                          />
                          <View style={styles.checkInfo}>
                            <Text style={styles.checkName}>{checkNameText}</Text>
                            <Text style={styles.checkMessage}>{checkMessageText}</Text>
                            {check.details && (
                              <Text style={styles.checkDetails}>{checkDetailsText}</Text>
                            )}
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              );
            })}

            <View style={styles.actionsContainer}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={runDiagnostics}
              >
                <IconSymbol
                  ios_icon_name="arrow.clockwise"
                  android_material_icon_name="refresh"
                  size={20}
                  color="#fff"
                />
                <Text style={styles.actionButtonText}>Re-run Diagnostics</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.secondaryButton]}
                onPress={() => router.push('/subscription-paywall')}
              >
                <IconSymbol
                  ios_icon_name="creditcard.fill"
                  android_material_icon_name="payment"
                  size={20}
                  color={colors.primary}
                />
                <Text style={styles.secondaryButtonText}>View Paywall</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.infoContainer}>
              <Text style={styles.infoTitle}>Expected Configuration</Text>
              <Text style={styles.infoText}>
                • Product ID: com.forelandmarine.seatime.monthly{'\n'}
                • Bundle ID: com.forelandmarine.seatimetracker{'\n'}
                • Platform: iOS (App Store){'\n'}
                • Provider: RevenueCat
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </>
  );
}

function createStyles(isDark: boolean) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? colors.backgroundDark : colors.backgroundLight,
    },
    header: {
      alignItems: 'center',
      padding: 24,
      paddingTop: Platform.OS === 'android' ? 48 : 24,
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      color: isDark ? colors.textDark : colors.textLight,
      marginTop: 16,
      marginBottom: 8,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 14,
      color: isDark ? colors.textSecondaryDark : colors.textSecondaryLight,
      textAlign: 'center',
      lineHeight: 20,
    },
    loadingContainer: {
      alignItems: 'center',
      padding: 40,
    },
    loadingText: {
      fontSize: 16,
      color: isDark ? colors.textSecondaryDark : colors.textSecondaryLight,
      marginTop: 16,
    },
    categoryContainer: {
      marginHorizontal: 16,
      marginBottom: 24,
      backgroundColor: isDark ? colors.cardDark : colors.cardLight,
      borderRadius: 12,
      padding: 16,
    },
    categoryTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: isDark ? colors.textDark : colors.textLight,
      marginBottom: 16,
    },
    checkContainer: {
      marginBottom: 12,
    },
    checkHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
    },
    checkInfo: {
      flex: 1,
    },
    checkName: {
      fontSize: 16,
      fontWeight: '600',
      color: isDark ? colors.textDark : colors.textLight,
      marginBottom: 4,
    },
    checkMessage: {
      fontSize: 14,
      color: isDark ? colors.textSecondaryDark : colors.textSecondaryLight,
      marginBottom: 4,
    },
    checkDetails: {
      fontSize: 12,
      color: isDark ? colors.textSecondaryDark : colors.textSecondaryLight,
      fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    },
    actionsContainer: {
      marginHorizontal: 16,
      marginBottom: 24,
      gap: 12,
    },
    actionButton: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      padding: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    actionButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
    },
    secondaryButton: {
      backgroundColor: 'transparent',
      borderWidth: 2,
      borderColor: colors.primary,
    },
    secondaryButtonText: {
      color: colors.primary,
      fontSize: 16,
      fontWeight: '600',
    },
    infoContainer: {
      marginHorizontal: 16,
      marginBottom: 40,
      backgroundColor: isDark ? colors.cardDark : colors.cardLight,
      borderRadius: 12,
      padding: 16,
    },
    infoTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: isDark ? colors.textDark : colors.textLight,
      marginBottom: 12,
    },
    infoText: {
      fontSize: 14,
      color: isDark ? colors.textSecondaryDark : colors.textSecondaryLight,
      lineHeight: 22,
    },
  });
}


/**
 * RevenueCat Diagnostic Screen
 * 
 * This screen helps diagnose RevenueCat configuration issues by showing:
 * - Current API key configuration status
 * - Plugin configuration status
 * - Step-by-step setup instructions
 * - Real-time validation
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  useColorScheme,
  Platform,
  Linking,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { 
  getRevenueCatDiagnostics, 
  getRevenueCatValidationStatus,
  REVENUECAT_CONFIG,
  validateRevenueCatConfig 
} from '@/config/revenuecat';
import Constants from 'expo-constants';

export default function RevenueCatDiagnosticScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [showRawConfig, setShowRawConfig] = useState(false);
  const [validating, setValidating] = useState(true);
  const [validationStatus, setValidationStatus] = useState<any>(null);

  useEffect(() => {
    // Run validation
    const runValidation = async () => {
      setValidating(true);
      
      // Give it a moment to ensure config is loaded
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const isValid = validateRevenueCatConfig();
      const status = getRevenueCatValidationStatus();
      
      console.log('[Diagnostic] Validation complete:', isValid);
      console.log('[Diagnostic] Status:', status);
      
      setValidationStatus(status);
      setValidating(false);
    };

    runValidation();
  }, []);

  const diagnostics = getRevenueCatDiagnostics();
  const appConfig = Constants.expoConfig;

  const configStatus = validationStatus || {
    pluginInAppJson: false,
    extraConfigInAppJson: false,
    iosApiKeyConfigured: false,
    androidApiKeyConfigured: false,
    iosKeyValidFormat: false,
    androidKeyValidFormat: false,
  };

  const allConfigured = 
    configStatus.pluginInAppJson &&
    configStatus.extraConfigInAppJson &&
    configStatus.iosApiKeyConfigured &&
    configStatus.androidApiKeyConfigured &&
    configStatus.iosKeyValidFormat &&
    configStatus.androidKeyValidFormat;

  const handleOpenRevenueCatDashboard = () => {
    Linking.openURL('https://app.revenuecat.com/');
  };

  const handleCopyAppJsonConfig = () => {
    const configText = `
Add this to your app.json:

1. In the "plugins" array, add:
[
  "./plugins/with-revenuecat",
  {
    "iosApiKey": "test_gKMHKEpYSkTiLUtgKWHRbAXGcGd",
    "androidApiKey": "test_gKMHKEpYSkTiLUtgKWHRbAXGcGd"
  }
]

2. In the "extra" section, add:
"revenueCat": {
  "iosApiKey": "test_gKMHKEpYSkTiLUtgKWHRbAXGcGd",
  "androidApiKey": "test_gKMHKEpYSkTiLUtgKWHRbAXGcGd"
}

3. Restart the app:
npx expo start --clear

4. For native builds, run:
npx expo prebuild --clean
    `.trim();

    if (Platform.OS === 'web') {
      navigator.clipboard.writeText(configText);
      Alert.alert('Copied!', 'Configuration copied to clipboard');
    } else {
      Alert.alert('Configuration', configText);
    }
  };

  const handleRevalidate = () => {
    setValidating(true);
    setTimeout(() => {
      const isValid = validateRevenueCatConfig();
      const status = getRevenueCatValidationStatus();
      setValidationStatus(status);
      setValidating(false);
      
      Alert.alert(
        isValid ? 'Configuration Valid' : 'Configuration Invalid',
        isValid 
          ? 'RevenueCat is properly configured!' 
          : 'Please check the configuration issues below.'
      );
    }, 500);
  };

  const styles = createStyles(isDark);

  const statusIcon = allConfigured ? 'check-circle' : 'error';
  const statusColor = allConfigured ? colors.success : colors.error;
  const statusText = allConfigured ? 'Configuration Complete ✅' : 'Configuration Incomplete ⚠️';

  if (validating) {
    return (
      <>
        <Stack.Screen
          options={{
            title: 'RevenueCat Diagnostic',
            headerShown: true,
          }}
        />
        <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.title, { marginTop: 16 }]}>Validating Configuration...</Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'RevenueCat Diagnostic',
          headerShown: true,
        }}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <IconSymbol
            ios_icon_name={allConfigured ? 'checkmark.circle.fill' : 'exclamationmark.triangle.fill'}
            android_material_icon_name={statusIcon}
            size={64}
            color={statusColor}
          />
          <Text style={[styles.title, { color: statusColor }]}>{statusText}</Text>
          
          <TouchableOpacity
            style={styles.revalidateButton}
            onPress={handleRevalidate}
          >
            <IconSymbol
              ios_icon_name="arrow.clockwise"
              android_material_icon_name="refresh"
              size={20}
              color={colors.primary}
            />
            <Text style={styles.revalidateText}>Revalidate</Text>
          </TouchableOpacity>
        </View>

        {/* Configuration Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Configuration Checklist</Text>
          
          <View style={styles.statusItem}>
            <IconSymbol
              ios_icon_name={configStatus.pluginInAppJson ? 'checkmark.circle.fill' : 'xmark.circle.fill'}
              android_material_icon_name={configStatus.pluginInAppJson ? 'check-circle' : 'cancel'}
              size={24}
              color={configStatus.pluginInAppJson ? colors.success : colors.error}
            />
            <View style={styles.statusTextContainer}>
              <Text style={styles.statusText}>RevenueCat Plugin in app.json</Text>
              {!configStatus.pluginInAppJson && (
                <Text style={styles.statusSubtext}>
                  Add ["./plugins/with-revenuecat", {'{'}...{'}'}] to plugins array
                </Text>
              )}
            </View>
          </View>

          <View style={styles.statusItem}>
            <IconSymbol
              ios_icon_name={configStatus.extraConfigInAppJson ? 'checkmark.circle.fill' : 'xmark.circle.fill'}
              android_material_icon_name={configStatus.extraConfigInAppJson ? 'check-circle' : 'cancel'}
              size={24}
              color={configStatus.extraConfigInAppJson ? colors.success : colors.error}
            />
            <View style={styles.statusTextContainer}>
              <Text style={styles.statusText}>RevenueCat Extra Config in app.json</Text>
              {!configStatus.extraConfigInAppJson && (
                <Text style={styles.statusSubtext}>
                  Add revenueCat object to extra section
                </Text>
              )}
            </View>
          </View>

          <View style={styles.statusItem}>
            <IconSymbol
              ios_icon_name={configStatus.iosApiKeyConfigured ? 'checkmark.circle.fill' : 'xmark.circle.fill'}
              android_material_icon_name={configStatus.iosApiKeyConfigured ? 'check-circle' : 'cancel'}
              size={24}
              color={configStatus.iosApiKeyConfigured ? colors.success : colors.error}
            />
            <View style={styles.statusTextContainer}>
              <Text style={styles.statusText}>iOS API Key Configured</Text>
              {configStatus.iosApiKeyConfigured && (
                <Text style={styles.statusSubtext}>
                  {configStatus.iosKeyPrefix}... ({configStatus.iosKeyLength} chars)
                </Text>
              )}
            </View>
          </View>

          <View style={styles.statusItem}>
            <IconSymbol
              ios_icon_name={configStatus.androidApiKeyConfigured ? 'checkmark.circle.fill' : 'xmark.circle.fill'}
              android_material_icon_name={configStatus.androidApiKeyConfigured ? 'check-circle' : 'cancel'}
              size={24}
              color={configStatus.androidApiKeyConfigured ? colors.success : colors.error}
            />
            <View style={styles.statusTextContainer}>
              <Text style={styles.statusText}>Android API Key Configured</Text>
              {configStatus.androidApiKeyConfigured && (
                <Text style={styles.statusSubtext}>
                  {configStatus.androidKeyPrefix}... ({configStatus.androidKeyLength} chars)
                </Text>
              )}
            </View>
          </View>

          <View style={styles.statusItem}>
            <IconSymbol
              ios_icon_name={configStatus.iosKeyValidFormat ? 'checkmark.circle.fill' : 'xmark.circle.fill'}
              android_material_icon_name={configStatus.iosKeyValidFormat ? 'check-circle' : 'cancel'}
              size={24}
              color={configStatus.iosKeyValidFormat ? colors.success : colors.error}
            />
            <View style={styles.statusTextContainer}>
              <Text style={styles.statusText}>iOS Key Format Valid</Text>
              {!configStatus.iosKeyValidFormat && (
                <Text style={styles.statusSubtext}>
                  Should start with: appl_, test_, sk_, or pk_
                </Text>
              )}
            </View>
          </View>

          <View style={styles.statusItem}>
            <IconSymbol
              ios_icon_name={configStatus.androidKeyValidFormat ? 'checkmark.circle.fill' : 'xmark.circle.fill'}
              android_material_icon_name={configStatus.androidKeyValidFormat ? 'check-circle' : 'cancel'}
              size={24}
              color={configStatus.androidKeyValidFormat ? colors.success : colors.error}
            />
            <View style={styles.statusTextContainer}>
              <Text style={styles.statusText}>Android Key Format Valid</Text>
              {!configStatus.androidKeyValidFormat && (
                <Text style={styles.statusSubtext}>
                  Should start with: goog_, test_, sk_, or pk_
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* Current Configuration */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Current Configuration</Text>
          
          <View style={styles.configItem}>
            <Text style={styles.configLabel}>Platform:</Text>
            <Text style={styles.configValue}>{Platform.OS}</Text>
          </View>

          <View style={styles.configItem}>
            <Text style={styles.configLabel}>Key Type:</Text>
            <Text style={styles.configValue}>
              {configStatus.isTestKey ? 'Test Key' : configStatus.isProductionKey ? 'Production Key' : 'Unknown'}
            </Text>
          </View>

          <View style={styles.configItem}>
            <Text style={styles.configLabel}>iOS API Key:</Text>
            <Text style={styles.configValue}>
              {diagnostics.iosKey.configured ? diagnostics.iosKey.prefix + '...' : 'NOT SET'}
            </Text>
          </View>

          <View style={styles.configItem}>
            <Text style={styles.configLabel}>Android API Key:</Text>
            <Text style={styles.configValue}>
              {diagnostics.androidKey.configured ? diagnostics.androidKey.prefix + '...' : 'NOT SET'}
            </Text>
          </View>

          <View style={styles.configItem}>
            <Text style={styles.configLabel}>Entitlement ID:</Text>
            <Text style={styles.configValue}>{REVENUECAT_CONFIG.entitlementID}</Text>
          </View>
        </View>

        {/* Setup Instructions */}
        {!allConfigured && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🔧 Setup Instructions</Text>
            
            <View style={styles.instructionStep}>
              <Text style={styles.stepNumber}>1</Text>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Get Your API Key</Text>
                <Text style={styles.stepText}>
                  Go to RevenueCat Dashboard → Project Settings → API Keys
                </Text>
                <TouchableOpacity
                  style={styles.linkButton}
                  onPress={handleOpenRevenueCatDashboard}
                >
                  <Text style={styles.linkButtonText}>Open RevenueCat Dashboard</Text>
                  <IconSymbol
                    ios_icon_name="arrow.up.right"
                    android_material_icon_name="open-in-new"
                    size={16}
                    color={colors.primary}
                  />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.instructionStep}>
              <Text style={styles.stepNumber}>2</Text>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Update app.json</Text>
                <Text style={styles.stepText}>
                  Add RevenueCat plugin and extra configuration
                </Text>
                <TouchableOpacity
                  style={styles.linkButton}
                  onPress={handleCopyAppJsonConfig}
                >
                  <Text style={styles.linkButtonText}>Copy Configuration</Text>
                  <IconSymbol
                    ios_icon_name="doc.on.doc"
                    android_material_icon_name="content-copy"
                    size={16}
                    color={colors.primary}
                  />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.instructionStep}>
              <Text style={styles.stepNumber}>3</Text>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Restart the App</Text>
                <Text style={styles.stepText}>
                  Clear cache and restart Expo
                </Text>
                <Text style={styles.codeText}>npx expo start --clear</Text>
              </View>
            </View>

            <View style={styles.instructionStep}>
              <Text style={styles.stepNumber}>4</Text>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>For Native Builds</Text>
                <Text style={styles.stepText}>
                  Rebuild native projects (iOS/Android only)
                </Text>
                <Text style={styles.codeText}>npx expo prebuild --clean</Text>
              </View>
            </View>
          </View>
        )}

        {/* Success Message */}
        {allConfigured && (
          <View style={[styles.section, { backgroundColor: colors.success + '20' }]}>
            <Text style={[styles.sectionTitle, { color: colors.success }]}>
              ✅ Configuration Complete!
            </Text>
            <Text style={styles.successText}>
              RevenueCat is properly configured. You can now:
            </Text>
            <Text style={styles.successBullet}>• View and purchase subscriptions</Text>
            <Text style={styles.successBullet}>• Restore previous purchases</Text>
            <Text style={styles.successBullet}>• Manage subscriptions in Customer Center</Text>
          </View>
        )}

        {/* Raw Configuration (Debug) */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.toggleButton}
            onPress={() => setShowRawConfig(!showRawConfig)}
          >
            <Text style={styles.toggleButtonText}>
              {showRawConfig ? 'Hide' : 'Show'} Raw Configuration (Debug)
            </Text>
            <IconSymbol
              ios_icon_name={showRawConfig ? 'chevron.up' : 'chevron.down'}
              android_material_icon_name={showRawConfig ? 'expand-less' : 'expand-more'}
              size={20}
              color={colors.primary}
            />
          </TouchableOpacity>

          {showRawConfig && (
            <View style={styles.rawConfig}>
              <Text style={styles.rawConfigText}>
                {JSON.stringify(
                  {
                    validationStatus: configStatus,
                    diagnostics,
                    config: REVENUECAT_CONFIG,
                  },
                  null,
                  2
                )}
              </Text>
            </View>
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={() => router.back()}
          >
            <Text style={styles.buttonText}>Back</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
            onPress={handleOpenRevenueCatDashboard}
          >
            <Text style={styles.secondaryButtonText}>Open RevenueCat Dashboard</Text>
          </TouchableOpacity>
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
      padding: 20,
      paddingBottom: 40,
    },
    header: {
      alignItems: 'center',
      marginBottom: 32,
      paddingTop: 20,
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      marginTop: 16,
      textAlign: 'center',
    },
    revalidateButton: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 12,
      paddingHorizontal: 16,
      paddingVertical: 8,
      backgroundColor: colors.primary + '20',
      borderRadius: 8,
    },
    revalidateText: {
      fontSize: 14,
      color: colors.primary,
      fontWeight: '600',
      marginLeft: 8,
    },
    section: {
      backgroundColor: isDark ? colors.cardBackground : colors.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: isDark ? colors.text : colors.textLight,
      marginBottom: 16,
    },
    statusItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 16,
    },
    statusTextContainer: {
      flex: 1,
      marginLeft: 12,
    },
    statusText: {
      fontSize: 16,
      color: isDark ? colors.text : colors.textLight,
      fontWeight: '500',
    },
    statusSubtext: {
      fontSize: 13,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
      marginTop: 4,
      fontStyle: 'italic',
    },
    configItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? colors.border : colors.borderLight,
    },
    configLabel: {
      fontSize: 14,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
      fontWeight: '500',
    },
    configValue: {
      fontSize: 14,
      color: isDark ? colors.text : colors.textLight,
      fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
      maxWidth: '60%',
      textAlign: 'right',
    },
    instructionStep: {
      flexDirection: 'row',
      marginBottom: 20,
    },
    stepNumber: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.primary,
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: 'bold',
      textAlign: 'center',
      lineHeight: 32,
      marginRight: 12,
    },
    stepContent: {
      flex: 1,
    },
    stepTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: isDark ? colors.text : colors.textLight,
      marginBottom: 4,
    },
    stepText: {
      fontSize: 14,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
      lineHeight: 20,
      marginBottom: 8,
    },
    codeText: {
      fontSize: 12,
      fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
      color: colors.primary,
      backgroundColor: isDark ? '#1a1a1a' : '#f5f5f5',
      padding: 8,
      borderRadius: 4,
      marginTop: 4,
    },
    linkButton: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 8,
    },
    linkButtonText: {
      fontSize: 14,
      color: colors.primary,
      fontWeight: '600',
      marginRight: 4,
    },
    successText: {
      fontSize: 14,
      color: isDark ? colors.text : colors.textLight,
      marginBottom: 12,
    },
    successBullet: {
      fontSize: 14,
      color: isDark ? colors.text : colors.textLight,
      marginLeft: 8,
      marginBottom: 4,
    },
    toggleButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 8,
    },
    toggleButtonText: {
      fontSize: 16,
      color: colors.primary,
      fontWeight: '600',
    },
    rawConfig: {
      marginTop: 12,
      backgroundColor: isDark ? '#1a1a1a' : '#f5f5f5',
      borderRadius: 8,
      padding: 12,
    },
    rawConfigText: {
      fontSize: 12,
      fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
      lineHeight: 18,
    },
    buttonContainer: {
      marginTop: 24,
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
    buttonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },
    secondaryButtonText: {
      color: colors.primary,
      fontSize: 16,
      fontWeight: '600',
    },
  });
}

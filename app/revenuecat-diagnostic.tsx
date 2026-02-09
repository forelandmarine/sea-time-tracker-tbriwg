
/**
 * RevenueCat Diagnostic Screen
 * 
 * This screen helps diagnose RevenueCat configuration issues by showing:
 * - Current API key configuration status
 * - Environment variable status
 * - Plugin configuration status
 * - Step-by-step setup instructions
 */

import React, { useState } from 'react';
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
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { getRevenueCatDiagnostics, REVENUECAT_CONFIG } from '@/config/revenuecat';
import Constants from 'expo-constants';

export default function RevenueCatDiagnosticScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [showRawConfig, setShowRawConfig] = useState(false);

  const diagnostics = getRevenueCatDiagnostics();
  const appConfig = Constants.expoConfig;

  const hasRevenueCatPlugin = appConfig?.plugins?.some((plugin: any) => {
    if (typeof plugin === 'string') {
      return plugin.includes('revenuecat');
    }
    if (Array.isArray(plugin)) {
      return plugin[0]?.includes('revenuecat');
    }
    return false;
  });

  const hasRevenueCatExtra = !!appConfig?.extra?.revenueCat;

  const configStatus = {
    pluginConfigured: hasRevenueCatPlugin,
    extraConfigured: hasRevenueCatExtra,
    iosKeySet: diagnostics.iosKey.configured,
    androidKeySet: diagnostics.androidKey.configured,
    iosKeyValid: diagnostics.iosKey.validFormat,
    androidKeyValid: diagnostics.androidKey.validFormat,
  };

  const allConfigured = Object.values(configStatus).every(Boolean);

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
    "iosApiKey": "$(REVENUECAT_TEST_API_KEY)",
    "androidApiKey": "$(REVENUECAT_TEST_API_KEY)"
  }
]

2. In the "extra" section, add:
"revenueCat": {
  "iosApiKey": "$(REVENUECAT_TEST_API_KEY)",
  "androidApiKey": "$(REVENUECAT_TEST_API_KEY)"
}

3. Set your environment variable:
export REVENUECAT_TEST_API_KEY="your_api_key_here"

4. Restart the app:
npx expo start --clear
    `.trim();

    if (Platform.OS === 'web') {
      navigator.clipboard.writeText(configText);
      Alert.alert('Copied!', 'Configuration copied to clipboard');
    } else {
      Alert.alert('Configuration', configText);
    }
  };

  const styles = createStyles(isDark);

  const statusIcon = allConfigured ? 'check-circle' : 'error';
  const statusColor = allConfigured ? colors.success : colors.error;
  const statusText = allConfigured ? 'Configuration Complete' : 'Configuration Incomplete';

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
        </View>

        {/* Configuration Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Configuration Status</Text>
          
          <View style={styles.statusItem}>
            <IconSymbol
              ios_icon_name={configStatus.pluginConfigured ? 'checkmark.circle.fill' : 'xmark.circle.fill'}
              android_material_icon_name={configStatus.pluginConfigured ? 'check-circle' : 'cancel'}
              size={24}
              color={configStatus.pluginConfigured ? colors.success : colors.error}
            />
            <Text style={styles.statusText}>
              RevenueCat Plugin in app.json
            </Text>
          </View>

          <View style={styles.statusItem}>
            <IconSymbol
              ios_icon_name={configStatus.extraConfigured ? 'checkmark.circle.fill' : 'xmark.circle.fill'}
              android_material_icon_name={configStatus.extraConfigured ? 'check-circle' : 'cancel'}
              size={24}
              color={configStatus.extraConfigured ? colors.success : colors.error}
            />
            <Text style={styles.statusText}>
              RevenueCat Extra Config in app.json
            </Text>
          </View>

          <View style={styles.statusItem}>
            <IconSymbol
              ios_icon_name={configStatus.iosKeySet ? 'checkmark.circle.fill' : 'xmark.circle.fill'}
              android_material_icon_name={configStatus.iosKeySet ? 'check-circle' : 'cancel'}
              size={24}
              color={configStatus.iosKeySet ? colors.success : colors.error}
            />
            <Text style={styles.statusText}>
              iOS API Key Configured
            </Text>
          </View>

          <View style={styles.statusItem}>
            <IconSymbol
              ios_icon_name={configStatus.androidKeySet ? 'checkmark.circle.fill' : 'xmark.circle.fill'}
              android_material_icon_name={configStatus.androidKeySet ? 'check-circle' : 'cancel'}
              size={24}
              color={configStatus.androidKeySet ? colors.success : colors.error}
            />
            <Text style={styles.statusText}>
              Android API Key Configured
            </Text>
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
            <Text style={styles.configLabel}>iOS API Key:</Text>
            <Text style={styles.configValue}>
              {diagnostics.iosKey.configured ? diagnostics.iosKey.prefix : 'NOT SET'}
            </Text>
          </View>

          <View style={styles.configItem}>
            <Text style={styles.configLabel}>iOS Key Length:</Text>
            <Text style={styles.configValue}>
              {diagnostics.iosKey.length} characters
            </Text>
          </View>

          <View style={styles.configItem}>
            <Text style={styles.configLabel}>iOS Key Valid Format:</Text>
            <Text style={[styles.configValue, { color: diagnostics.iosKey.validFormat ? colors.success : colors.error }]}>
              {diagnostics.iosKey.validFormat ? 'Yes' : 'No'}
            </Text>
          </View>

          <View style={styles.configItem}>
            <Text style={styles.configLabel}>Android API Key:</Text>
            <Text style={styles.configValue}>
              {diagnostics.androidKey.configured ? diagnostics.androidKey.prefix : 'NOT SET'}
            </Text>
          </View>

          <View style={styles.configItem}>
            <Text style={styles.configLabel}>Android Key Length:</Text>
            <Text style={styles.configValue}>
              {diagnostics.androidKey.length} characters
            </Text>
          </View>

          <View style={styles.configItem}>
            <Text style={styles.configLabel}>Android Key Valid Format:</Text>
            <Text style={[styles.configValue, { color: diagnostics.androidKey.validFormat ? colors.success : colors.error }]}>
              {diagnostics.androidKey.validFormat ? 'Yes' : 'No'}
            </Text>
          </View>
        </View>

        {/* Setup Instructions */}
        {!allConfigured && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Setup Instructions</Text>
            
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
                <Text style={styles.stepTitle}>Create the Plugin File</Text>
                <Text style={styles.stepText}>
                  Create plugins/with-revenuecat.js with the RevenueCat plugin code
                </Text>
              </View>
            </View>

            <View style={styles.instructionStep}>
              <Text style={styles.stepNumber}>3</Text>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Update app.json</Text>
                <Text style={styles.stepText}>
                  Add RevenueCat plugin and extra configuration to app.json
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
              <Text style={styles.stepNumber}>4</Text>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Set Environment Variable</Text>
                <Text style={styles.stepText}>
                  Set REVENUECAT_TEST_API_KEY in your environment
                </Text>
                <Text style={styles.codeText}>
                  export REVENUECAT_TEST_API_KEY="your_key_here"
                </Text>
              </View>
            </View>

            <View style={styles.instructionStep}>
              <Text style={styles.stepNumber}>5</Text>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Restart the App</Text>
                <Text style={styles.stepText}>
                  Clear cache and restart Expo
                </Text>
                <Text style={styles.codeText}>
                  npx expo start --clear
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Raw Configuration (Debug) */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.toggleButton}
            onPress={() => setShowRawConfig(!showRawConfig)}
          >
            <Text style={styles.toggleButtonText}>
              {showRawConfig ? 'Hide' : 'Show'} Raw Configuration
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
                    plugin: hasRevenueCatPlugin,
                    extra: hasRevenueCatExtra,
                    config: REVENUECAT_CONFIG,
                    diagnostics,
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
            <Text style={styles.buttonText}>Back to Paywall</Text>
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
      alignItems: 'center',
      marginBottom: 12,
    },
    statusText: {
      fontSize: 16,
      color: isDark ? colors.text : colors.textLight,
      marginLeft: 12,
      flex: 1,
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

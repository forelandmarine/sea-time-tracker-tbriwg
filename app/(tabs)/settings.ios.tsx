
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  useColorScheme,
  ActivityIndicator,
} from 'react-native';
import { Stack } from 'expo-router';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { getApiSettingsStatus, getApiConfiguration, type ApiSettingsStatus } from '@/utils/seaTimeApi';

export default function SettingsScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [isLoading, setIsLoading] = useState(true);
  const [isTesting, setIsTesting] = useState(false);
  const [apiStatus, setApiStatus] = useState<ApiSettingsStatus | null>(null);
  const [apiConfig, setApiConfig] = useState<{ apiKey: string; apiUrl: string } | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      // Get hardcoded API configuration
      const config = getApiConfiguration();
      setApiConfig(config);

      // Load API status from backend
      try {
        const status = await getApiSettingsStatus();
        setApiStatus(status);
      } catch (error) {
        console.log('Could not fetch API status:', error);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const testConnection = async () => {
    setIsTesting(true);
    try {
      // Try to fetch API status to test connection
      const status = await getApiSettingsStatus();
      setApiStatus(status);

      if (status.apiKeyConfigured) {
        // Show success message (you could use a toast or alert here)
        console.log('Connection successful');
      }
    } catch (error) {
      console.error('Connection test failed:', error);
    } finally {
      setIsTesting(false);
    }
  };

  const bgColor = isDark ? colors.backgroundDark : colors.background;
  const cardColor = isDark ? colors.cardDark : colors.card;
  const textColor = isDark ? colors.textDark : colors.text;
  const secondaryTextColor = isDark ? colors.textSecondaryDark : colors.textSecondary;
  const borderColor = isDark ? colors.borderDark : colors.border;

  // Mask API key for display (show first 8 and last 4 characters)
  const maskedApiKey = apiConfig?.apiKey 
    ? `${apiConfig.apiKey.substring(0, 8)}${'*'.repeat(20)}${apiConfig.apiKey.substring(apiConfig.apiKey.length - 4)}`
    : '';

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'API Settings',
          headerStyle: {
            backgroundColor: bgColor,
          },
          headerTintColor: textColor,
        }}
      />
      <ScrollView
        style={[styles.container, { backgroundColor: bgColor }]}
        contentContainerStyle={styles.contentContainer}
      >
        <View style={[styles.card, { backgroundColor: cardColor, borderColor }]}>
          <View style={styles.iconHeader}>
            <IconSymbol
              ios_icon_name="checkmark.shield.fill"
              android_material_icon_name="verified-user"
              size={32}
              color={colors.success}
            />
            <Text style={[styles.cardTitle, { color: textColor }]}>
              API Configuration
            </Text>
          </View>

          <Text style={[styles.description, { color: secondaryTextColor }]}>
            Your MyShipTracking API credentials are pre-configured by the app developers. No additional setup required.
          </Text>

          <View style={[styles.infoCard, { 
            backgroundColor: isDark ? '#0F1A27' : '#F5F9FC',
            borderColor: colors.success,
          }]}>
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: secondaryTextColor }]}>
                API Key:
              </Text>
              <Text style={[styles.infoValue, { color: textColor }]}>
                {maskedApiKey}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: secondaryTextColor }]}>
                API URL:
              </Text>
              <Text style={[styles.infoValue, { color: textColor }]}>
                {apiConfig?.apiUrl || 'Loading...'}
              </Text>
            </View>
          </View>

          {apiStatus && (
            <View style={[styles.statusCard, { 
              backgroundColor: isDark ? '#0F1A27' : '#F5F9FC',
              borderColor: apiStatus.apiKeyConfigured ? colors.success : colors.warning,
            }]}>
              <View style={styles.statusRow}>
                <IconSymbol
                  ios_icon_name={apiStatus.apiKeyConfigured ? 'checkmark.circle.fill' : 'exclamationmark.circle.fill'}
                  android_material_icon_name={apiStatus.apiKeyConfigured ? 'check-circle' : 'warning'}
                  size={20}
                  color={apiStatus.apiKeyConfigured ? colors.success : colors.warning}
                />
                <Text style={[styles.statusText, { 
                  color: apiStatus.apiKeyConfigured ? colors.success : colors.warning 
                }]}>
                  {apiStatus.apiKeyConfigured ? 'API Connected' : 'API Not Connected'}
                </Text>
              </View>
              {apiStatus.lastUpdated && (
                <Text style={[styles.statusSubtext, { color: secondaryTextColor }]}>
                  Last checked: {new Date(apiStatus.lastUpdated).toLocaleString()}
                </Text>
              )}
            </View>
          )}

          <TouchableOpacity
            style={[
              styles.button,
              styles.testButton,
              isTesting && styles.buttonDisabled,
            ]}
            onPress={testConnection}
            disabled={isTesting}
          >
            {isTesting ? (
              <ActivityIndicator color={colors.accent} size="small" />
            ) : (
              <IconSymbol
                ios_icon_name="network"
                android_material_icon_name="wifi"
                size={20}
                color={colors.accent}
              />
            )}
            <Text style={[styles.buttonTextSecondary, { color: colors.accent }]}>
              {isTesting ? 'Testing Connection...' : 'Test Connection'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.card, { backgroundColor: cardColor, borderColor }]}>
          <View style={styles.iconHeader}>
            <IconSymbol
              ios_icon_name="info.circle.fill"
              android_material_icon_name="info"
              size={28}
              color={colors.accent}
            />
            <Text style={[styles.cardTitle, { color: textColor }]}>
              About API Configuration
            </Text>
          </View>

          <Text style={[styles.noteText, { color: secondaryTextColor }]}>
            • The MyShipTracking API key is securely embedded in the app
          </Text>
          <Text style={[styles.noteText, { color: secondaryTextColor }]}>
            • No manual configuration is required from users
          </Text>
          <Text style={[styles.noteText, { color: secondaryTextColor }]}>
            • All vessel tracking features are ready to use immediately
          </Text>
          <Text style={[styles.noteText, { color: secondaryTextColor }]}>
            • The API key is managed by the app developers
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: cardColor, borderColor }]}>
          <View style={styles.iconHeader}>
            <IconSymbol
              ios_icon_name="antenna.radiowaves.left.and.right"
              android_material_icon_name="settings-input-antenna"
              size={28}
              color={colors.primary}
            />
            <Text style={[styles.cardTitle, { color: textColor }]}>
              How It Works
            </Text>
          </View>

          <View style={styles.stepContainer}>
            <View style={styles.step}>
              <View style={[styles.stepNumber, { backgroundColor: colors.primary }]}>
                <Text style={styles.stepNumberText}>1</Text>
              </View>
              <Text style={[styles.stepText, { color: textColor }]}>
                Add vessels by entering their MMSI numbers
              </Text>
            </View>

            <View style={styles.step}>
              <View style={[styles.stepNumber, { backgroundColor: colors.primary }]}>
                <Text style={styles.stepNumberText}>2</Text>
              </View>
              <Text style={[styles.stepText, { color: textColor }]}>
                The app automatically tracks vessel movements via AIS data
              </Text>
            </View>

            <View style={styles.step}>
              <View style={[styles.stepNumber, { backgroundColor: colors.primary }]}>
                <Text style={styles.stepNumberText}>3</Text>
              </View>
              <Text style={[styles.stepText, { color: textColor }]}>
                Receive notifications when sea time is detected (4+ hours)
              </Text>
            </View>

            <View style={styles.step}>
              <View style={[styles.stepNumber, { backgroundColor: colors.primary }]}>
                <Text style={styles.stepNumberText}>4</Text>
              </View>
              <Text style={[styles.stepText, { color: textColor }]}>
                Confirm or reject sea time entries and generate reports
              </Text>
            </View>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: cardColor, borderColor }]}>
          <View style={styles.iconHeader}>
            <IconSymbol
              ios_icon_name="questionmark.circle.fill"
              android_material_icon_name="help"
              size={28}
              color={colors.warning}
            />
            <Text style={[styles.cardTitle, { color: textColor }]}>
              Need Help?
            </Text>
          </View>

          <Text style={[styles.description, { color: secondaryTextColor }]}>
            If you experience any issues with vessel tracking or API connectivity, please contact support or check the app documentation.
          </Text>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 100,
  },
  card: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  iconHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    flex: 1,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 16,
  },
  infoCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 2,
  },
  infoRow: {
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 14,
    fontFamily: 'Courier',
  },
  statusCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  statusText: {
    fontSize: 15,
    fontWeight: '600',
  },
  statusSubtext: {
    fontSize: 13,
    marginLeft: 28,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  testButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: colors.accent,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonTextSecondary: {
    fontSize: 16,
    fontWeight: '600',
  },
  stepContainer: {
    gap: 16,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  stepText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    paddingTop: 4,
  },
  noteText: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 8,
  },
});

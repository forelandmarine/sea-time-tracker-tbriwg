
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  useColorScheme,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';

const STORAGE_KEY_API_KEY = '@myshiptracking_api_key';
const STORAGE_KEY_API_URL = '@myshiptracking_api_url';
const DEFAULT_API_URL = 'https://api.myshiptracking.com/v1';

export default function SettingsScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [apiKey, setApiKey] = useState('');
  const [apiUrl, setApiUrl] = useState(DEFAULT_API_URL);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const savedApiKey = await AsyncStorage.getItem(STORAGE_KEY_API_KEY);
      const savedApiUrl = await AsyncStorage.getItem(STORAGE_KEY_API_URL);

      if (savedApiKey) setApiKey(savedApiKey);
      if (savedApiUrl) setApiUrl(savedApiUrl);
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveSettings = async () => {
    if (!apiKey.trim()) {
      Alert.alert('Error', 'Please enter a valid API key');
      return;
    }

    setIsSaving(true);
    try {
      await AsyncStorage.setItem(STORAGE_KEY_API_KEY, apiKey.trim());
      await AsyncStorage.setItem(STORAGE_KEY_API_URL, apiUrl.trim() || DEFAULT_API_URL);

      Alert.alert('Success', 'API settings saved successfully');
    } catch (error) {
      console.error('Failed to save settings:', error);
      Alert.alert('Error', 'Failed to save settings. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const resetToDefaults = () => {
    Alert.alert(
      'Reset to Defaults',
      'Are you sure you want to reset API settings to defaults?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            setApiUrl(DEFAULT_API_URL);
            setApiKey('');
            try {
              await AsyncStorage.removeItem(STORAGE_KEY_API_KEY);
              await AsyncStorage.setItem(STORAGE_KEY_API_URL, DEFAULT_API_URL);
              Alert.alert('Success', 'Settings reset to defaults');
            } catch (error) {
              console.error('Failed to reset settings:', error);
            }
          },
        },
      ]
    );
  };

  const bgColor = isDark ? colors.backgroundDark : colors.background;
  const cardColor = isDark ? colors.cardDark : colors.card;
  const textColor = isDark ? colors.textDark : colors.text;
  const secondaryTextColor = isDark ? colors.textSecondaryDark : colors.textSecondary;
  const borderColor = isDark ? colors.borderDark : colors.border;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: bgColor }]}
      contentContainerStyle={styles.contentContainer}
    >
      <Text style={[styles.screenTitle, { color: textColor }]}>API Settings</Text>

      <View style={[styles.card, { backgroundColor: cardColor, borderColor }]}>
        <View style={styles.iconHeader}>
          <IconSymbol
            ios_icon_name="key.fill"
            android_material_icon_name="vpn-key"
            size={32}
            color={colors.primary}
          />
          <Text style={[styles.cardTitle, { color: textColor }]}>
            MyShipTracking API Configuration
          </Text>
        </View>

        <Text style={[styles.description, { color: secondaryTextColor }]}>
          Configure your MyShipTracking API credentials to enable vessel tracking and AIS data integration.
        </Text>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: textColor }]}>API Key *</Text>
          <View style={styles.passwordContainer}>
            <TextInput
              style={[
                styles.input,
                styles.passwordInput,
                {
                  backgroundColor: isDark ? '#0F1A27' : '#F5F9FC',
                  color: textColor,
                  borderColor,
                },
              ]}
              value={apiKey}
              onChangeText={setApiKey}
              placeholder="Enter your MyShipTracking API key"
              placeholderTextColor={secondaryTextColor}
              secureTextEntry={!showApiKey}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={styles.eyeButton}
              onPress={() => setShowApiKey(!showApiKey)}
            >
              <IconSymbol
                ios_icon_name={showApiKey ? 'eye.slash.fill' : 'eye.fill'}
                android_material_icon_name={showApiKey ? 'visibility-off' : 'visibility'}
                size={20}
                color={secondaryTextColor}
              />
            </TouchableOpacity>
          </View>
          <Text style={[styles.hint, { color: secondaryTextColor }]}>
            Required for authenticating with MyShipTracking API
          </Text>
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: textColor }]}>API Base URL</Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: isDark ? '#0F1A27' : '#F5F9FC',
                color: textColor,
                borderColor,
              },
            ]}
            value={apiUrl}
            onChangeText={setApiUrl}
            placeholder={DEFAULT_API_URL}
            placeholderTextColor={secondaryTextColor}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
          <Text style={[styles.hint, { color: secondaryTextColor }]}>
            Default: {DEFAULT_API_URL}
          </Text>
        </View>

        <View style={styles.buttonGroup}>
          <TouchableOpacity
            style={[
              styles.button,
              styles.primaryButton,
              isSaving && styles.buttonDisabled,
            ]}
            onPress={saveSettings}
            disabled={isSaving}
          >
            <IconSymbol
              ios_icon_name="checkmark.circle.fill"
              android_material_icon_name="check-circle"
              size={20}
              color="#FFFFFF"
            />
            <Text style={styles.buttonText}>
              {isSaving ? 'Saving...' : 'Save Settings'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
            onPress={resetToDefaults}
            disabled={isSaving}
          >
            <IconSymbol
              ios_icon_name="arrow.counterclockwise"
              android_material_icon_name="refresh"
              size={20}
              color={colors.primary}
            />
            <Text style={[styles.buttonTextSecondary, { color: colors.primary }]}>
              Reset to Defaults
            </Text>
          </TouchableOpacity>
        </View>
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
            How to Get Your API Key
          </Text>
        </View>

        <View style={styles.stepContainer}>
          <View style={styles.step}>
            <View style={[styles.stepNumber, { backgroundColor: colors.primary }]}>
              <Text style={styles.stepNumberText}>1</Text>
            </View>
            <Text style={[styles.stepText, { color: textColor }]}>
              Visit myshiptracking.com and create an account
            </Text>
          </View>

          <View style={styles.step}>
            <View style={[styles.stepNumber, { backgroundColor: colors.primary }]}>
              <Text style={styles.stepNumberText}>2</Text>
            </View>
            <Text style={[styles.stepText, { color: textColor }]}>
              Navigate to API Settings in your account dashboard
            </Text>
          </View>

          <View style={styles.step}>
            <View style={[styles.stepNumber, { backgroundColor: colors.primary }]}>
              <Text style={styles.stepNumberText}>3</Text>
            </View>
            <Text style={[styles.stepText, { color: textColor }]}>
              Generate a new API key and copy it
            </Text>
          </View>

          <View style={styles.step}>
            <View style={[styles.stepNumber, { backgroundColor: colors.primary }]}>
              <Text style={styles.stepNumberText}>4</Text>
            </View>
            <Text style={[styles.stepText, { color: textColor }]}>
              Paste the API key in the field above and save
            </Text>
          </View>
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: cardColor, borderColor }]}>
        <View style={styles.iconHeader}>
          <IconSymbol
            ios_icon_name="exclamationmark.triangle.fill"
            android_material_icon_name="warning"
            size={28}
            color={colors.warning}
          />
          <Text style={[styles.cardTitle, { color: textColor }]}>
            Important Notes
          </Text>
        </View>

        <Text style={[styles.noteText, { color: secondaryTextColor }]}>
          • Keep your API key secure and do not share it with others
        </Text>
        <Text style={[styles.noteText, { color: secondaryTextColor }]}>
          • The API key is stored locally on your device
        </Text>
        <Text style={[styles.noteText, { color: secondaryTextColor }]}>
          • Vessel tracking requires a valid API key to function
        </Text>
        <Text style={[styles.noteText, { color: secondaryTextColor }]}>
          • Check MyShipTracking API documentation for rate limits
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingTop: 60,
    paddingBottom: 100,
  },
  screenTitle: {
    fontSize: 34,
    fontWeight: '700',
    marginBottom: 20,
    paddingHorizontal: 4,
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
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    borderWidth: 1,
  },
  passwordContainer: {
    position: 'relative',
  },
  passwordInput: {
    paddingRight: 50,
  },
  eyeButton: {
    position: 'absolute',
    right: 16,
    top: 16,
    padding: 4,
  },
  hint: {
    fontSize: 13,
    marginTop: 6,
    fontStyle: 'italic',
  },
  buttonGroup: {
    gap: 12,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
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
    fontSize: 16,
    fontWeight: '600',
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

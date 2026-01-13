
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  useColorScheme,
  Platform,
  Linking,
} from 'react-native';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import * as seaTimeApi from '@/utils/seaTimeApi';

export default function SettingsScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const [apiKey, setApiKey] = useState('');
  const [apiKeyConfigured, setApiKeyConfigured] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      console.log('[Settings] Loading API settings...');
      
      const settings = await seaTimeApi.getApiSettings();
      console.log('[Settings] Loaded settings:', settings);
      
      setApiKeyConfigured(settings.apiKeyConfigured);
      setLastUpdated(settings.lastUpdated || null);
    } catch (error) {
      console.error('[Settings] Error loading settings:', error);
      Alert.alert('Error', 'Failed to load settings. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveApiKey = async () => {
    if (!apiKey.trim()) {
      Alert.alert('Error', 'Please enter an API key');
      return;
    }

    setSaving(true);
    try {
      console.log('[Settings] Saving API key...');
      
      const result = await seaTimeApi.updateApiKey(apiKey.trim());
      console.log('[Settings] API key saved:', result);
      
      setApiKeyConfigured(true);
      setLastUpdated(result.lastUpdated);
      setApiKey('');
      
      Alert.alert('Success', 'API key saved successfully. You can now track vessels using AIS data.');
    } catch (error) {
      console.error('[Settings] Error saving API key:', error);
      Alert.alert('Error', 'Failed to save API key. Please check the key and try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenMyShipTracking = () => {
    Linking.openURL('https://www.myshiptracking.com/');
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const styles = createStyles(isDark);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
        <Text style={styles.headerSubtitle}>Configure MyShipTracking API</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {/* API Status Card */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>API Status</Text>
          
          <View style={[styles.card, apiKeyConfigured ? styles.successCard : styles.warningCard]}>
            <View style={styles.statusRow}>
              <IconSymbol
                ios_icon_name={apiKeyConfigured ? 'checkmark.circle.fill' : 'exclamationmark.triangle.fill'}
                android_material_icon_name={apiKeyConfigured ? 'check-circle' : 'warning'}
                size={32}
                color={apiKeyConfigured ? colors.success : colors.warning}
              />
              <View style={styles.statusContent}>
                <Text style={styles.statusTitle}>
                  {apiKeyConfigured ? 'API Key Configured' : 'API Key Not Configured'}
                </Text>
                <Text style={styles.statusText}>
                  {apiKeyConfigured
                    ? 'Your API key is active and ready to use'
                    : 'Configure your API key to enable vessel tracking'}
                </Text>
                {lastUpdated && (
                  <Text style={styles.statusDate}>
                    Last updated: {formatDate(lastUpdated)}
                  </Text>
                )}
              </View>
            </View>
          </View>
        </View>

        {/* API Key Configuration */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>MyShipTracking API Key</Text>
          
          <View style={styles.card}>
            <Text style={styles.cardText}>
              To track vessels using AIS data, you need a MyShipTracking API key.
            </Text>
            
            <TouchableOpacity
              style={[styles.button, styles.linkButton]}
              onPress={handleOpenMyShipTracking}
            >
              <IconSymbol
                ios_icon_name="link"
                android_material_icon_name="link"
                size={18}
                color={colors.card}
              />
              <Text style={styles.buttonText}>Get API Key from MyShipTracking</Text>
            </TouchableOpacity>
            
            <Text style={styles.inputLabel}>API Key</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your MyShipTracking API key"
              placeholderTextColor={isDark ? colors.textSecondaryDark : colors.textSecondary}
              value={apiKey}
              onChangeText={setApiKey}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
            
            <TouchableOpacity
              style={[styles.button, styles.primaryButton, saving && styles.disabledButton]}
              onPress={handleSaveApiKey}
              disabled={saving}
            >
              <IconSymbol
                ios_icon_name="checkmark"
                android_material_icon_name="check"
                size={18}
                color={colors.card}
              />
              <Text style={styles.buttonText}>
                {saving ? 'Saving...' : 'Save API Key'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          
          <View style={styles.infoCard}>
            <IconSymbol
              ios_icon_name="info.circle"
              android_material_icon_name="info"
              size={24}
              color={colors.primary}
            />
            <View style={styles.infoContent}>
              <Text style={styles.infoTitle}>What is MyShipTracking?</Text>
              <Text style={styles.infoText}>
                MyShipTracking provides real-time AIS (Automatic Identification System) data for vessels worldwide. 
                This app uses their API to track vessel movements and automatically record sea time for MCA testimonials.
              </Text>
            </View>
          </View>
          
          <View style={styles.infoCard}>
            <IconSymbol
              ios_icon_name="lock.shield"
              android_material_icon_name="security"
              size={24}
              color={colors.primary}
            />
            <View style={styles.infoContent}>
              <Text style={styles.infoTitle}>Privacy & Security</Text>
              <Text style={styles.infoText}>
                Your API key is stored securely on the backend server and is never exposed to other users. 
                It is only used to fetch vessel data from MyShipTracking on your behalf.
              </Text>
            </View>
          </View>
        </View>

        {/* App Info */}
        <View style={styles.section}>
          <View style={styles.appInfo}>
            <Text style={styles.appInfoText}>SeaTime Tracker v1.0.0</Text>
            <Text style={styles.appInfoText}>MCA Sea Service Testimonials</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = (isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? colors.backgroundDark : colors.background,
      paddingTop: Platform.OS === 'android' ? 48 : 0,
    },
    header: {
      padding: 20,
      paddingTop: Platform.OS === 'ios' ? 60 : 20,
      backgroundColor: isDark ? colors.cardDark : colors.card,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? colors.borderDark : colors.border,
      boxShadow: '0px 2px 8px rgba(0, 119, 190, 0.1)',
      elevation: 3,
    },
    headerTitle: {
      fontSize: 28,
      fontWeight: '700',
      color: isDark ? colors.textDark : colors.text,
    },
    headerSubtitle: {
      fontSize: 14,
      color: isDark ? colors.textSecondaryDark : colors.textSecondary,
      marginTop: 4,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: 16,
      paddingBottom: 100,
    },
    section: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: isDark ? colors.textDark : colors.text,
      marginBottom: 12,
    },
    card: {
      backgroundColor: isDark ? colors.cardDark : colors.card,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: isDark ? colors.borderDark : colors.border,
      boxShadow: '0px 2px 8px rgba(0, 119, 190, 0.1)',
      elevation: 2,
    },
    successCard: {
      borderColor: colors.success,
      borderWidth: 2,
    },
    warningCard: {
      borderColor: colors.warning,
      borderWidth: 2,
    },
    statusRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
    },
    statusContent: {
      flex: 1,
    },
    statusTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: isDark ? colors.textDark : colors.text,
      marginBottom: 4,
    },
    statusText: {
      fontSize: 14,
      color: isDark ? colors.textDark : colors.text,
      lineHeight: 20,
    },
    statusDate: {
      fontSize: 12,
      color: isDark ? colors.textSecondaryDark : colors.textSecondary,
      marginTop: 8,
    },
    cardText: {
      fontSize: 14,
      color: isDark ? colors.textDark : colors.text,
      lineHeight: 20,
      marginBottom: 16,
    },
    inputLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: isDark ? colors.textDark : colors.text,
      marginBottom: 8,
      marginTop: 12,
    },
    input: {
      backgroundColor: isDark ? colors.backgroundDark : colors.background,
      borderWidth: 1,
      borderColor: isDark ? colors.borderDark : colors.border,
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      color: isDark ? colors.textDark : colors.text,
      marginBottom: 16,
    },
    button: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 8,
      gap: 8,
      marginBottom: 12,
    },
    primaryButton: {
      backgroundColor: colors.primary,
    },
    linkButton: {
      backgroundColor: colors.accent,
    },
    disabledButton: {
      opacity: 0.5,
    },
    buttonText: {
      color: colors.card,
      fontSize: 14,
      fontWeight: '600',
    },
    infoCard: {
      flexDirection: 'row',
      backgroundColor: isDark ? colors.cardDark : colors.card,
      borderRadius: 12,
      padding: 16,
      gap: 12,
      borderWidth: 1,
      borderColor: isDark ? colors.borderDark : colors.border,
      marginBottom: 12,
    },
    infoContent: {
      flex: 1,
    },
    infoTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: isDark ? colors.textDark : colors.text,
      marginBottom: 8,
    },
    infoText: {
      fontSize: 14,
      color: isDark ? colors.textSecondaryDark : colors.textSecondary,
      lineHeight: 20,
    },
    appInfo: {
      alignItems: 'center',
      padding: 16,
    },
    appInfoText: {
      fontSize: 12,
      color: isDark ? colors.textSecondaryDark : colors.textSecondary,
      textAlign: 'center',
    },
  });

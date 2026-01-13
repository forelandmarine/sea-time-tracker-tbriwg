
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
  ActivityIndicator,
} from 'react-native';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import * as seaTimeApi from '@/utils/seaTimeApi';

export default function SettingsScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const [apiKey, setApiKey] = useState('');
  const [apiSettings, setApiSettings] = useState<seaTimeApi.ApiSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      console.log('[Settings] Loading API settings from backend...');
      
      const settings = await seaTimeApi.getApiSettings();
      console.log('[Settings] Loaded settings:', settings);
      
      setApiSettings(settings);
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

    try {
      setSaving(true);
      console.log('[Settings] Saving API key...');
      
      const result = await seaTimeApi.updateApiKey(apiKey.trim());
      console.log('[Settings] API key saved:', result);
      
      setApiKey('');
      await loadSettings();
      
      Alert.alert('Success', result.message || 'API key updated successfully');
    } catch (error) {
      console.error('[Settings] Error saving API key:', error);
      Alert.alert('Error', 'Failed to save API key. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const styles = createStyles(isDark);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <IconSymbol
            ios_icon_name="gear"
            android_material_icon_name="settings"
            size={32}
            color={colors.primary}
          />
          <Text style={styles.headerTitle}>Settings</Text>
        </View>
        <Text style={styles.headerSubtitle}>Configure MyShipTracking API</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading settings...</Text>
          </View>
        ) : (
          <>
            {/* API Status */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>🔑 API Configuration</Text>
              
              <View style={[styles.card, apiSettings?.apiKeyConfigured ? styles.successCard : styles.warningCard]}>
                <View style={styles.statusRow}>
                  <IconSymbol
                    ios_icon_name={apiSettings?.apiKeyConfigured ? 'checkmark.circle.fill' : 'exclamationmark.triangle.fill'}
                    android_material_icon_name={apiSettings?.apiKeyConfigured ? 'check-circle' : 'warning'}
                    size={24}
                    color={apiSettings?.apiKeyConfigured ? colors.success : colors.warning}
                  />
                  <View style={styles.statusInfo}>
                    <Text style={styles.statusTitle}>
                      {apiSettings?.apiKeyConfigured ? 'API Key Configured' : 'API Key Not Configured'}
                    </Text>
                    {apiSettings?.apiKeyConfigured && apiSettings.lastUpdated && (
                      <Text style={styles.statusSubtext}>
                        Last updated: {new Date(apiSettings.lastUpdated).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                    )}
                  </View>
                </View>
                
                {apiSettings?.apiUrl && (
                  <Text style={styles.apiUrl}>
                    API URL: {apiSettings.apiUrl}
                  </Text>
                )}
              </View>
            </View>

            {/* Update API Key */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>🔧 Update API Key</Text>
              
              <View style={styles.card}>
                <Text style={styles.inputLabel}>MyShipTracking API Key</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter your API key"
                  placeholderTextColor={isDark ? colors.textSecondaryDark : colors.textSecondary}
                  value={apiKey}
                  onChangeText={setApiKey}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                
                <TouchableOpacity
                  style={[styles.button, styles.primaryButton, saving && styles.buttonDisabled]}
                  onPress={handleSaveApiKey}
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <ActivityIndicator size="small" color={colors.card} />
                      <Text style={styles.buttonText}>Saving...</Text>
                    </>
                  ) : (
                    <>
                      <IconSymbol
                        ios_icon_name="checkmark"
                        android_material_icon_name="check"
                        size={20}
                        color={colors.card}
                      />
                      <Text style={styles.buttonText}>Save API Key</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Info */}
            <View style={styles.infoCard}>
              <IconSymbol
                ios_icon_name="info.circle"
                android_material_icon_name="info"
                size={24}
                color={colors.primary}
              />
              <View style={styles.infoContent}>
                <Text style={styles.infoTitle}>About MyShipTracking API</Text>
                <Text style={styles.infoText}>
                  This app uses the MyShipTracking API to fetch real-time AIS data for vessel tracking. 
                  You need a valid API key to use the vessel tracking features.
                </Text>
                <Text style={styles.infoText}>
                  Get your API key from: https://www.myshiptracking.com/
                </Text>
              </View>
            </View>

            {/* App Info */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>ℹ️ App Information</Text>
              
              <View style={styles.card}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Version</Text>
                  <Text style={styles.infoValue}>1.0.0</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Platform</Text>
                  <Text style={styles.infoValue}>{Platform.OS}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Backend URL</Text>
                  <Text style={[styles.infoValue, styles.urlText]} numberOfLines={1}>
                    {apiSettings?.apiUrl || 'Not configured'}
                  </Text>
                </View>
              </View>
            </View>
          </>
        )}
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
    headerContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
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
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 60,
    },
    loadingText: {
      marginTop: 16,
      fontSize: 16,
      color: isDark ? colors.textSecondaryDark : colors.textSecondary,
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
      marginBottom: 12,
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
      alignItems: 'center',
      gap: 12,
    },
    statusInfo: {
      flex: 1,
    },
    statusTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: isDark ? colors.textDark : colors.text,
    },
    statusSubtext: {
      fontSize: 13,
      color: isDark ? colors.textSecondaryDark : colors.textSecondary,
      marginTop: 2,
    },
    apiUrl: {
      fontSize: 12,
      color: isDark ? colors.textSecondaryDark : colors.textSecondary,
      marginTop: 8,
      fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    },
    inputLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: isDark ? colors.textDark : colors.text,
      marginBottom: 8,
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
      paddingVertical: 14,
      paddingHorizontal: 20,
      borderRadius: 10,
      gap: 8,
    },
    primaryButton: {
      backgroundColor: colors.primary,
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    buttonText: {
      color: colors.card,
      fontSize: 16,
      fontWeight: '600',
    },
    infoCard: {
      flexDirection: 'row',
      backgroundColor: isDark ? colors.cardDark : colors.card,
      borderRadius: 12,
      padding: 16,
      gap: 12,
      borderWidth: 1,
      borderColor: colors.primary,
      marginBottom: 24,
    },
    infoContent: {
      flex: 1,
    },
    infoTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: isDark ? colors.textDark : colors.text,
      marginBottom: 8,
    },
    infoText: {
      fontSize: 14,
      color: isDark ? colors.textSecondaryDark : colors.textSecondary,
      lineHeight: 20,
      marginBottom: 8,
    },
    infoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? colors.borderDark : colors.border,
    },
    infoLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: isDark ? colors.textDark : colors.text,
    },
    infoValue: {
      fontSize: 14,
      color: isDark ? colors.textSecondaryDark : colors.textSecondary,
    },
    urlText: {
      fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
      fontSize: 12,
      maxWidth: '60%',
    },
  });


import { IconSymbol } from '@/components/IconSymbol';
import React, { useState } from 'react';
import { colors } from '@/styles/commonStyles';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  useColorScheme,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import Constants from 'expo-constants';

const API_BASE_URL = Constants.expoConfig?.extra?.backendUrl || 'https://uukpkcag4nsq8q632k643ztvus28frfe.app.specular.dev';

interface GeneratedEntry {
  id: string;
  start_time: string;
  end_time: string | null;
  duration_hours: number | null;
  sea_days: number | null;
  status: string;
  notes: string;
}

interface GenerateResponse {
  success: boolean;
  message: string;
  vessel: {
    id: string;
    vessel_name: string;
    mmsi: string;
  };
  entries: GeneratedEntry[];
}

const createStyles = (isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? colors.backgroundDark : colors.backgroundLight,
    },
    scrollContent: {
      padding: 20,
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      color: isDark ? colors.textDark : colors.textLight,
      marginBottom: 10,
    },
    subtitle: {
      fontSize: 14,
      color: isDark ? colors.textSecondaryDark : colors.textSecondaryLight,
      marginBottom: 30,
    },
    inputGroup: {
      marginBottom: 20,
    },
    label: {
      fontSize: 16,
      fontWeight: '600',
      color: isDark ? colors.textDark : colors.textLight,
      marginBottom: 8,
    },
    input: {
      backgroundColor: isDark ? colors.cardDark : colors.cardLight,
      borderRadius: 12,
      padding: 16,
      fontSize: 16,
      color: isDark ? colors.textDark : colors.textLight,
      borderWidth: 1,
      borderColor: isDark ? colors.borderDark : colors.borderLight,
    },
    generateButton: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
      marginTop: 10,
      marginBottom: 30,
    },
    generateButtonDisabled: {
      opacity: 0.5,
    },
    generateButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },
    resultCard: {
      backgroundColor: isDark ? colors.cardDark : colors.cardLight,
      borderRadius: 12,
      padding: 16,
      marginBottom: 20,
    },
    resultTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: isDark ? colors.textDark : colors.textLight,
      marginBottom: 10,
    },
    resultText: {
      fontSize: 14,
      color: isDark ? colors.textDark : colors.textLight,
      marginBottom: 6,
    },
    entryCard: {
      backgroundColor: isDark ? colors.backgroundDark : colors.backgroundLight,
      borderRadius: 8,
      padding: 12,
      marginTop: 10,
      borderWidth: 1,
      borderColor: isDark ? colors.borderDark : colors.borderLight,
    },
    entryText: {
      fontSize: 12,
      color: isDark ? colors.textSecondaryDark : colors.textSecondaryLight,
      marginBottom: 4,
    },
    statusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
      alignSelf: 'flex-start',
      marginTop: 4,
    },
    statusText: {
      fontSize: 12,
      fontWeight: '600',
      color: '#FFFFFF',
    },
  });

export default function AdminGenerateSamplesScreen() {
  console.log('AdminGenerateSamplesScreen: Screen loaded');
  
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const styles = createStyles(isDark);

  const [email, setEmail] = useState('test@seatime.com');
  const [vesselName, setVesselName] = useState('Lionheart');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GenerateResponse | null>(null);

  const handleGenerate = async () => {
    console.log('User tapped Generate Samples button', { email, vesselName });
    
    if (!email || !vesselName) {
      Alert.alert('Error', 'Please enter both email and vessel name');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      console.log('Calling POST /api/sea-time/generate-sample-entries');
      const response = await fetch(`${API_BASE_URL}/api/sea-time/generate-sample-entries`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          vesselName,
        }),
      });

      const data = await response.json();
      console.log('Generate samples response:', response.status, data);

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate samples');
      }

      setResult(data);
      const entriesCount = data.entries?.length || data.entriesCreated || 0;
      const totalSeaDays = data.entries?.reduce((sum: number, entry: any) => sum + (entry.sea_days || 0), 0) || 0;
      
      Alert.alert(
        'Success',
        `Generated ${entriesCount} sample entries for ${data.vessel.vessel_name}\n\nTotal Sea Days: ${totalSeaDays}`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error generating samples:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to generate samples');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return colors.success;
      case 'pending':
        return colors.warning;
      case 'rejected':
        return colors.error;
      default:
        return colors.textSecondaryDark;
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen
        options={{
          title: 'Generate Sample Data',
          headerStyle: {
            backgroundColor: isDark ? colors.backgroundDark : colors.backgroundLight,
          },
          headerTintColor: isDark ? colors.textDark : colors.textLight,
          headerShadowVisible: false,
        }}
      />
      
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Generate Sample Sea Time Entries</Text>
        <Text style={styles.subtitle}>
          Create 4 sample sea day entries for testing purposes. This will create a vessel if it doesn&apos;t exist.
        </Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>User Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="test@seatime.com"
            placeholderTextColor={isDark ? colors.textSecondaryDark : colors.textSecondaryLight}
            keyboardType="email-address"
            autoCapitalize="none"
            editable={!loading}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Vessel Name</Text>
          <TextInput
            style={styles.input}
            value={vesselName}
            onChangeText={setVesselName}
            placeholder="Lionheart"
            placeholderTextColor={isDark ? colors.textSecondaryDark : colors.textSecondaryLight}
            editable={!loading}
          />
        </View>

        <TouchableOpacity
          style={[styles.generateButton, loading && styles.generateButtonDisabled]}
          onPress={handleGenerate}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.generateButtonText}>Generate 4 Sample Entries</Text>
          )}
        </TouchableOpacity>

        {result && (
          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>✅ {result.message}</Text>
            <Text style={styles.resultText}>
              <Text style={{ fontWeight: '600' }}>Vessel:</Text> {result.vessel.vessel_name}
            </Text>
            <Text style={styles.resultText}>
              <Text style={{ fontWeight: '600' }}>MMSI:</Text> {result.vessel.mmsi}
            </Text>
            <Text style={styles.resultText}>
              <Text style={{ fontWeight: '600' }}>Entries Created:</Text> {result.entries?.length || result.entriesCreated || 0}
            </Text>
            {result.entries && result.entries.length > 0 && (
              <Text style={styles.resultText}>
                <Text style={{ fontWeight: '600' }}>Total Sea Days:</Text> {result.entries.reduce((sum: number, entry: any) => sum + (entry.sea_days || 0), 0)}
              </Text>
            )}

            {result.entries && result.entries.map((entry, index) => {
              const durationHours = typeof entry.duration_hours === 'number' 
                ? entry.duration_hours 
                : parseFloat(entry.duration_hours || '0');
              
              return (
                <View key={entry.id} style={styles.entryCard}>
                  <Text style={[styles.entryText, { fontWeight: '600' }]}>
                    Entry {index + 1}
                  </Text>
                  <Text style={styles.entryText}>
                    {formatDate(entry.start_time)} {formatTime(entry.start_time)}
                    {entry.end_time && ` → ${formatTime(entry.end_time)}`}
                  </Text>
                  <Text style={styles.entryText}>
                    Duration: {durationHours.toFixed(1)} hours | Sea Days: {entry.sea_days || 0}
                  </Text>
                  <Text style={styles.entryText} numberOfLines={2}>
                    Notes: {entry.notes}
                  </Text>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(entry.status) }]}>
                    <Text style={styles.statusText}>{entry.status.toUpperCase()}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

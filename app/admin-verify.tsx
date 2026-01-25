
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  useColorScheme,
  Alert,
} from 'react-native';
import { Stack } from 'expo-router';
import { colors } from '@/styles/commonStyles';
import Constants from 'expo-constants';

const API_BASE_URL = Constants.expoConfig?.extra?.backendUrl || 'http://localhost:8082';

interface User {
  id: string;
  email: string;
  name: string;
}

interface Vessel {
  id: string;
  mmsi: string;
  vessel_name: string;
  is_active: boolean;
}

interface SeaTimeEntry {
  id: string;
  start_time: string;
  end_time: string | null;
  duration_hours: number | null;
  status: 'pending' | 'confirmed' | 'rejected';
  notes: string | null;
  created_at: string;
  start_latitude: number | null;
  start_longitude: number | null;
  end_latitude: number | null;
  end_longitude: number | null;
}

interface Summary {
  totalEntries: number;
  pendingEntries: number;
  confirmedEntries: number;
  rejectedEntries: number;
  totalConfirmedHours: number;
  totalConfirmedDays: number;
}

interface VerificationResult {
  user: User;
  vessel: Vessel | null;
  seaTimeEntries: SeaTimeEntry[];
  summary: Summary;
}

const createStyles = (isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? colors.background : '#f5f5f5',
    },
    content: {
      padding: 20,
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 20,
    },
    inputGroup: {
      marginBottom: 15,
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 5,
    },
    input: {
      backgroundColor: isDark ? '#2a2a2a' : '#ffffff',
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      color: colors.text,
      borderWidth: 1,
      borderColor: isDark ? '#444' : '#ddd',
    },
    button: {
      backgroundColor: colors.primary,
      borderRadius: 8,
      padding: 15,
      alignItems: 'center',
      marginTop: 10,
    },
    buttonText: {
      color: '#ffffff',
      fontSize: 16,
      fontWeight: '600',
    },
    resultContainer: {
      marginTop: 30,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 10,
      marginTop: 20,
    },
    card: {
      backgroundColor: isDark ? '#2a2a2a' : '#ffffff',
      borderRadius: 12,
      padding: 15,
      marginBottom: 15,
      borderWidth: 1,
      borderColor: isDark ? '#444' : '#e0e0e0',
    },
    row: {
      flexDirection: 'row',
      marginBottom: 8,
    },
    rowLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
      width: 120,
    },
    rowValue: {
      fontSize: 14,
      color: colors.text,
      flex: 1,
    },
    statusBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
      alignSelf: 'flex-start',
    },
    statusText: {
      fontSize: 12,
      fontWeight: '600',
      color: '#ffffff',
    },
    summaryGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    summaryCard: {
      backgroundColor: isDark ? '#2a2a2a' : '#ffffff',
      borderRadius: 12,
      padding: 15,
      flex: 1,
      minWidth: '45%',
      borderWidth: 1,
      borderColor: isDark ? '#444' : '#e0e0e0',
    },
    summaryValue: {
      fontSize: 24,
      fontWeight: 'bold',
      color: colors.primary,
      marginBottom: 5,
    },
    summaryLabel: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    noDataText: {
      fontSize: 14,
      color: colors.textSecondary,
      fontStyle: 'italic',
      textAlign: 'center',
      marginTop: 20,
    },
    errorText: {
      fontSize: 14,
      color: '#ff4444',
      textAlign: 'center',
      marginTop: 20,
    },
  });

export default function AdminVerifyScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const styles = createStyles(isDark);

  const [email, setEmail] = useState('dan@forelandmarine.com');
  const [mmsi, setMmsi] = useState('319031700');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verifyTasksLoading, setVerifyTasksLoading] = useState(false);
  const [verifyTasksResult, setVerifyTasksResult] = useState<any>(null);

  console.log('AdminVerifyScreen rendered');

  const handleVerify = async () => {
    console.log('User tapped Verify button', { email, mmsi });
    
    if (!email || !mmsi) {
      Alert.alert('Error', 'Please enter both email and MMSI');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      console.log('Calling admin verification endpoint:', `${API_BASE_URL}/api/admin/verify-sea-time?email=${email}&mmsi=${mmsi}`);
      
      const response = await fetch(
        `${API_BASE_URL}/api/admin/verify-sea-time?email=${encodeURIComponent(email)}&mmsi=${encodeURIComponent(mmsi)}`
      );

      console.log('Admin verification response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to verify');
      }

      const data = await response.json();
      console.log('Admin verification data received:', data);
      setResult(data);
    } catch (err: any) {
      console.error('Admin verification error:', err);
      setError(err.message || 'Failed to verify sea time data');
      Alert.alert('Error', err.message || 'Failed to verify sea time data');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyVesselTasks = async () => {
    console.log('User tapped Verify Vessel Tasks button');
    
    setVerifyTasksLoading(true);
    setVerifyTasksResult(null);

    try {
      console.log('Calling verify vessel tasks endpoint:', `${API_BASE_URL}/api/admin/verify-vessel-tasks`);
      
      const response = await fetch(
        `${API_BASE_URL}/api/admin/verify-vessel-tasks`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        }
      );

      console.log('Verify vessel tasks response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to verify vessel tasks');
      }

      const data = await response.json();
      console.log('Verify vessel tasks data received:', data);
      setVerifyTasksResult(data);
      
      const message = `Verification complete!\n\nActive vessels: ${data.activeVessels}\nTasks created: ${data.tasksCreated}\nAlready had tasks: ${data.alreadyHadTasks}`;
      Alert.alert('Success', message);
    } catch (err: any) {
      console.error('Verify vessel tasks error:', err);
      Alert.alert('Error', err.message || 'Failed to verify vessel tasks');
    } finally {
      setVerifyTasksLoading(false);
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

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return '#4CAF50';
      case 'pending':
        return '#FF9800';
      case 'rejected':
        return '#F44336';
      default:
        return '#9E9E9E';
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Admin Verification',
          headerStyle: {
            backgroundColor: isDark ? colors.background : '#ffffff',
          },
          headerTintColor: colors.text,
        }}
      />

      <ScrollView style={styles.content}>
        <Text style={styles.title}>Admin Tools</Text>

        {/* Verify Vessel Tasks Section */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Verify Vessel Tasks</Text>
          <Text style={[styles.rowValue, { marginBottom: 15 }]}>
            Check all active vessels have scheduled tracking tasks and create missing tasks.
          </Text>
          
          <TouchableOpacity
            style={styles.button}
            onPress={handleVerifyVesselTasks}
            disabled={verifyTasksLoading}
          >
            {verifyTasksLoading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.buttonText}>Verify Vessel Tasks</Text>
            )}
          </TouchableOpacity>

          {verifyTasksResult && (
            <View style={{ marginTop: 15 }}>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Active Vessels:</Text>
                <Text style={styles.rowValue}>{verifyTasksResult.activeVessels}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Tasks Created:</Text>
                <Text style={styles.rowValue}>{verifyTasksResult.tasksCreated}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Already Had Tasks:</Text>
                <Text style={styles.rowValue}>{verifyTasksResult.alreadyHadTasks}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Verify Sea Time Data Section */}
        <Text style={styles.title}>Verify Sea Time Data</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>User Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="Enter user email"
            placeholderTextColor={colors.textSecondary}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Vessel MMSI</Text>
          <TextInput
            style={styles.input}
            value={mmsi}
            onChangeText={setMmsi}
            placeholder="Enter vessel MMSI"
            placeholderTextColor={colors.textSecondary}
            keyboardType="numeric"
          />
        </View>

        <TouchableOpacity
          style={styles.button}
          onPress={handleVerify}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.buttonText}>Verify Sea Time</Text>
          )}
        </TouchableOpacity>

        {error && <Text style={styles.errorText}>{error}</Text>}

        {result && (
          <View style={styles.resultContainer}>
            {/* User Info */}
            <Text style={styles.sectionTitle}>User Information</Text>
            <View style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Name:</Text>
                <Text style={styles.rowValue}>{result.user.name}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Email:</Text>
                <Text style={styles.rowValue}>{result.user.email}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>User ID:</Text>
                <Text style={styles.rowValue}>{result.user.id}</Text>
              </View>
            </View>

            {/* Vessel Info */}
            <Text style={styles.sectionTitle}>Vessel Information</Text>
            {result.vessel ? (
              <View style={styles.card}>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Vessel Name:</Text>
                  <Text style={styles.rowValue}>{result.vessel.vessel_name}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>MMSI:</Text>
                  <Text style={styles.rowValue}>{result.vessel.mmsi}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Status:</Text>
                  <Text style={styles.rowValue}>
                    {result.vessel.is_active ? 'Active' : 'Inactive'}
                  </Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Vessel ID:</Text>
                  <Text style={styles.rowValue}>{result.vessel.id}</Text>
                </View>
              </View>
            ) : (
              <Text style={styles.noDataText}>
                User is not tracking this MMSI
              </Text>
            )}

            {/* Summary */}
            <Text style={styles.sectionTitle}>Summary</Text>
            <View style={styles.summaryGrid}>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>{result.summary.totalEntries}</Text>
                <Text style={styles.summaryLabel}>Total Entries</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>{result.summary.confirmedEntries}</Text>
                <Text style={styles.summaryLabel}>Confirmed</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>{result.summary.pendingEntries}</Text>
                <Text style={styles.summaryLabel}>Pending</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>{result.summary.rejectedEntries}</Text>
                <Text style={styles.summaryLabel}>Rejected</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>
                  {result.summary.totalConfirmedDays.toFixed(1)}
                </Text>
                <Text style={styles.summaryLabel}>Confirmed Days</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>
                  {result.summary.totalConfirmedHours.toFixed(1)}
                </Text>
                <Text style={styles.summaryLabel}>Confirmed Hours</Text>
              </View>
            </View>

            {/* Sea Time Entries */}
            <Text style={styles.sectionTitle}>
              Sea Time Entries ({result.seaTimeEntries.length})
            </Text>
            {result.seaTimeEntries.length > 0 ? (
              result.seaTimeEntries.map((entry) => (
                <View key={entry.id} style={styles.card}>
                  <View style={styles.row}>
                    <Text style={styles.rowLabel}>Status:</Text>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: getStatusColor(entry.status) },
                      ]}
                    >
                      <Text style={styles.statusText}>
                        {entry.status.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.row}>
                    <Text style={styles.rowLabel}>Start:</Text>
                    <Text style={styles.rowValue}>
                      {formatDateTime(entry.start_time)}
                    </Text>
                  </View>
                  {entry.end_time && (
                    <View style={styles.row}>
                      <Text style={styles.rowLabel}>End:</Text>
                      <Text style={styles.rowValue}>
                        {formatDateTime(entry.end_time)}
                      </Text>
                    </View>
                  )}
                  {entry.duration_hours !== null && (
                    <View style={styles.row}>
                      <Text style={styles.rowLabel}>Duration:</Text>
                      <Text style={styles.rowValue}>
                        {entry.duration_hours.toFixed(1)} hours (
                        {(entry.duration_hours / 24).toFixed(1)} days)
                      </Text>
                    </View>
                  )}
                  {entry.notes && (
                    <View style={styles.row}>
                      <Text style={styles.rowLabel}>Notes:</Text>
                      <Text style={styles.rowValue}>{entry.notes}</Text>
                    </View>
                  )}
                  <View style={styles.row}>
                    <Text style={styles.rowLabel}>Created:</Text>
                    <Text style={styles.rowValue}>
                      {formatDate(entry.created_at)}
                    </Text>
                  </View>
                </View>
              ))
            ) : (
              <Text style={styles.noDataText}>No sea time entries found</Text>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

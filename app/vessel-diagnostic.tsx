
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  useColorScheme,
  Alert,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import * as seaTimeApi from '@/utils/seaTimeApi';
import { BACKEND_URL } from '@/utils/api';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';

interface VesselDiagnostic {
  vessel: {
    id: string;
    mmsi: string;
    vessel_name: string;
    is_active: boolean;
    user_id: string;
  } | null;
  scheduled_task: {
    id: string;
    is_active: boolean;
    last_run: string | null;
    next_run: string;
    interval_hours: string;
  } | null;
  ais_checks_last_24h: Array<{
    check_time: string;
    is_moving: boolean;
    speed_knots: number | null;
    latitude: number | null;
    longitude: number | null;
    time_since_previous_hours: number | null;
    position_change_degrees: number | null;
  }>;
  movement_analysis: {
    total_checks: number;
    movement_windows: Array<{
      start_time: string;
      end_time: string;
      duration_hours: number;
      position_change: number;
      movement_detected: boolean;
    }>;
    total_underway_hours: number;
    meets_mca_threshold: boolean;
  };
  sea_time_entries: Array<{
    id: string;
    start_time: string;
    end_time: string | null;
    duration_hours: number | null;
    status: string;
    mca_compliant: boolean | null;
  }>;
  entry_creation_status: {
    should_create_entry: boolean;
    reason: string;
    calendar_day_check: {
      today: string;
      has_existing_entry: boolean;
    };
  };
}

function createStyles(isDark: boolean) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? colors.backgroundDark : colors.backgroundLight,
    },
    scrollContent: {
      padding: 20,
    },
    searchSection: {
      marginBottom: 20,
    },
    label: {
      fontSize: 14,
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
      marginBottom: 12,
    },
    button: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'center',
    },
    buttonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
      marginLeft: 8,
    },
    section: {
      backgroundColor: isDark ? colors.cardDark : colors.cardLight,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: isDark ? colors.textDark : colors.textLight,
      marginBottom: 12,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    rowLabel: {
      fontSize: 14,
      color: isDark ? colors.textSecondaryDark : colors.textSecondaryLight,
      flex: 1,
    },
    rowValue: {
      fontSize: 14,
      fontWeight: '600',
      color: isDark ? colors.textDark : colors.textLight,
      flex: 1,
      textAlign: 'right',
    },
    statusBadge: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      alignSelf: 'flex-start',
      marginBottom: 8,
    },
    statusText: {
      fontSize: 12,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    checkItem: {
      backgroundColor: isDark ? colors.backgroundDark : colors.backgroundLight,
      borderRadius: 8,
      padding: 12,
      marginBottom: 8,
    },
    checkTime: {
      fontSize: 14,
      fontWeight: '600',
      color: isDark ? colors.textDark : colors.textLight,
      marginBottom: 4,
    },
    checkDetail: {
      fontSize: 12,
      color: isDark ? colors.textSecondaryDark : colors.textSecondaryLight,
      marginBottom: 2,
    },
    warningBox: {
      backgroundColor: '#FFF3CD',
      borderRadius: 8,
      padding: 12,
      marginTop: 12,
    },
    warningText: {
      fontSize: 14,
      color: '#856404',
    },
    successBox: {
      backgroundColor: '#D4EDDA',
      borderRadius: 8,
      padding: 12,
      marginTop: 12,
    },
    successText: {
      fontSize: 14,
      color: '#155724',
    },
    errorBox: {
      backgroundColor: '#F8D7DA',
      borderRadius: 8,
      padding: 12,
      marginTop: 12,
    },
    errorText: {
      fontSize: 14,
      color: '#721C24',
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    emptyText: {
      fontSize: 14,
      color: isDark ? colors.textSecondaryDark : colors.textSecondaryLight,
      fontStyle: 'italic',
    },
  });
}

export default function VesselDiagnosticScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const styles = createStyles(isDark);
  const router = useRouter();

  const [mmsi, setMmsi] = useState('247432300');
  const [loading, setLoading] = useState(false);
  const [diagnostic, setDiagnostic] = useState<VesselDiagnostic | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!mmsi.trim()) {
      Alert.alert('Error', 'Please enter a vessel MMSI');
      return;
    }

    console.log('Searching for vessel diagnostic:', mmsi);
    console.log('Using backend URL:', BACKEND_URL);
    setLoading(true);
    setError(null);
    setDiagnostic(null);

    try {
      const data = await seaTimeApi.getVesselDiagnosticStatus(mmsi);
      console.log('Diagnostic data received:', data);
      setDiagnostic(data);
    } catch (err: any) {
      console.error('Error fetching diagnostic:', err);
      setError(err.message || 'Failed to fetch diagnostic data');
      Alert.alert('Error', err.message || 'Failed to fetch diagnostic data');
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const formatDuration = (hours: number | null) => {
    if (hours === null) return 'N/A';
    const roundedHours = Math.round(hours * 100) / 100;
    return `${roundedHours}h`;
  };

  const formatCoordinate = (value: number | null) => {
    if (value === null) return 'N/A';
    return value.toFixed(4);
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Vessel Diagnostic',
          headerShown: true,
        }}
      />
      <View style={styles.container}>
        <ScrollView style={styles.scrollContent}>
          <View style={styles.searchSection}>
            <Text style={styles.label}>Vessel MMSI</Text>
            <TextInput
              style={styles.input}
              value={mmsi}
              onChangeText={setMmsi}
              placeholder="Enter MMSI (e.g., 247432300)"
              placeholderTextColor={isDark ? colors.textSecondaryDark : colors.textSecondaryLight}
              keyboardType="numeric"
            />
            <TouchableOpacity
              style={styles.button}
              onPress={handleSearch}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <IconSymbol
                    ios_icon_name="magnifyingglass"
                    android_material_icon_name="search"
                    size={20}
                    color="#FFFFFF"
                  />
                  <Text style={styles.buttonText}>Search</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {diagnostic && (
            <>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Vessel Information</Text>
                {diagnostic.vessel ? (
                  <>
                    <View style={styles.row}>
                      <Text style={styles.rowLabel}>Name:</Text>
                      <Text style={styles.rowValue}>{diagnostic.vessel.vessel_name}</Text>
                    </View>
                    <View style={styles.row}>
                      <Text style={styles.rowLabel}>MMSI:</Text>
                      <Text style={styles.rowValue}>{diagnostic.vessel.mmsi}</Text>
                    </View>
                    <View style={styles.row}>
                      <Text style={styles.rowLabel}>Active:</Text>
                      <Text style={styles.rowValue}>{diagnostic.vessel.is_active ? 'Yes' : 'No'}</Text>
                    </View>
                    <View style={styles.row}>
                      <Text style={styles.rowLabel}>Vessel ID:</Text>
                      <Text style={styles.rowValue}>{diagnostic.vessel.id}</Text>
                    </View>
                  </>
                ) : (
                  <Text style={styles.emptyText}>Vessel not found</Text>
                )}
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Scheduled Task</Text>
                {diagnostic.scheduled_task ? (
                  <>
                    <View style={styles.row}>
                      <Text style={styles.rowLabel}>Status:</Text>
                      <Text style={styles.rowValue}>{diagnostic.scheduled_task.is_active ? 'Active' : 'Inactive'}</Text>
                    </View>
                    <View style={styles.row}>
                      <Text style={styles.rowLabel}>Interval:</Text>
                      <Text style={styles.rowValue}>{diagnostic.scheduled_task.interval_hours}h</Text>
                    </View>
                    <View style={styles.row}>
                      <Text style={styles.rowLabel}>Last Run:</Text>
                      <Text style={styles.rowValue}>{formatDateTime(diagnostic.scheduled_task.last_run)}</Text>
                    </View>
                    <View style={styles.row}>
                      <Text style={styles.rowLabel}>Next Run:</Text>
                      <Text style={styles.rowValue}>{formatDateTime(diagnostic.scheduled_task.next_run)}</Text>
                    </View>
                  </>
                ) : (
                  <Text style={styles.emptyText}>No scheduled task found</Text>
                )}
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Movement Analysis (24h)</Text>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Total Checks:</Text>
                  <Text style={styles.rowValue}>{diagnostic.movement_analysis.total_checks}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Movement Windows:</Text>
                  <Text style={styles.rowValue}>{diagnostic.movement_analysis.movement_windows.length}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Total Underway:</Text>
                  <Text style={styles.rowValue}>{formatDuration(diagnostic.movement_analysis.total_underway_hours)}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>MCA Compliant:</Text>
                  <Text style={styles.rowValue}>{diagnostic.movement_analysis.meets_mca_threshold ? 'Yes (≥4h)' : 'No (<4h)'}</Text>
                </View>

                {diagnostic.movement_analysis.meets_mca_threshold ? (
                  <View style={styles.successBox}>
                    <Text style={styles.successText}>
                      ✓ Vessel meets MCA 4-hour threshold for sea day creation
                    </Text>
                  </View>
                ) : (
                  <View style={styles.warningBox}>
                    <Text style={styles.warningText}>
                      ⚠ Vessel does not meet MCA 4-hour threshold. Need {formatDuration(4 - diagnostic.movement_analysis.total_underway_hours)} more underway time.
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Entry Creation Status</Text>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Should Create:</Text>
                  <Text style={styles.rowValue}>{diagnostic.entry_creation_status.should_create_entry ? 'Yes' : 'No'}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Calendar Day:</Text>
                  <Text style={styles.rowValue}>{diagnostic.entry_creation_status.calendar_day_check.today}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Existing Entry:</Text>
                  <Text style={styles.rowValue}>{diagnostic.entry_creation_status.calendar_day_check.has_existing_entry ? 'Yes' : 'No'}</Text>
                </View>

                <View style={diagnostic.entry_creation_status.should_create_entry ? styles.successBox : styles.warningBox}>
                  <Text style={diagnostic.entry_creation_status.should_create_entry ? styles.successText : styles.warningText}>
                    {diagnostic.entry_creation_status.reason}
                  </Text>
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>AIS Checks (Last 24h)</Text>
                {diagnostic.ais_checks_last_24h.length > 0 ? (
                  diagnostic.ais_checks_last_24h.map((check, index) => {
                    const checkTimeText = formatDateTime(check.check_time);
                    const isMovingText = check.is_moving ? 'Moving' : 'Stationary';
                    const speedText = check.speed_knots !== null ? `${check.speed_knots} kts` : 'N/A';
                    const positionText = `${formatCoordinate(check.latitude)}, ${formatCoordinate(check.longitude)}`;
                    const timeSinceText = check.time_since_previous_hours !== null ? formatDuration(check.time_since_previous_hours) : 'N/A';
                    const posChangeText = check.position_change_degrees !== null ? `${check.position_change_degrees.toFixed(4)}°` : 'N/A';

                    return (
                      <View key={index} style={styles.checkItem}>
                        <Text style={styles.checkTime}>{checkTimeText}</Text>
                        <Text style={styles.checkDetail}>Status: {isMovingText}</Text>
                        <Text style={styles.checkDetail}>Speed: {speedText}</Text>
                        <Text style={styles.checkDetail}>Position: {positionText}</Text>
                        <Text style={styles.checkDetail}>Time Since Previous: {timeSinceText}</Text>
                        <Text style={styles.checkDetail}>Position Change: {posChangeText}</Text>
                      </View>
                    );
                  })
                ) : (
                  <Text style={styles.emptyText}>No AIS checks in last 24 hours</Text>
                )}
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Sea Time Entries</Text>
                {diagnostic.sea_time_entries.length > 0 ? (
                  diagnostic.sea_time_entries.map((entry, index) => {
                    const startText = formatDateTime(entry.start_time);
                    const endText = formatDateTime(entry.end_time);
                    const durationText = formatDuration(entry.duration_hours);
                    const statusText = entry.status;
                    const mcaText = entry.mca_compliant ? 'MCA Compliant' : 'Not MCA Compliant';

                    return (
                      <View key={index} style={styles.checkItem}>
                        <Text style={styles.checkTime}>Entry {index + 1}</Text>
                        <Text style={styles.checkDetail}>Start: {startText}</Text>
                        <Text style={styles.checkDetail}>End: {endText}</Text>
                        <Text style={styles.checkDetail}>Duration: {durationText}</Text>
                        <Text style={styles.checkDetail}>Status: {statusText}</Text>
                        <Text style={styles.checkDetail}>{mcaText}</Text>
                      </View>
                    );
                  })
                ) : (
                  <Text style={styles.emptyText}>No sea time entries found</Text>
                )}
              </View>
            </>
          )}
        </ScrollView>
      </View>
    </>
  );
}

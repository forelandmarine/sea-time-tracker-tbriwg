
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  useColorScheme,
  ActivityIndicator,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import * as seaTimeApi from '@/utils/seaTimeApi';

interface DiagnosticResult {
  vesselId: string;
  vesselName: string;
  mmsi: string;
  rawResponse: any;
  parsedData: {
    name: string | null;
    latitude: number | null;
    longitude: number | null;
    speed: number | null;
    course: number | null;
    heading: number | null;
    status: string | null;
    timestamp: string | null;
    destination: string | null;
    eta: string | null;
  };
  debugLogs: any[];
}

export default function AISDiagnosticScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const styles = createStyles(isDark);
  const router = useRouter();

  const [vessels, setVessels] = useState<seaTimeApi.Vessel[]>([]);
  const [selectedVessel, setSelectedVessel] = useState<seaTimeApi.Vessel | null>(null);
  const [loading, setLoading] = useState(false);
  const [diagnosticResult, setDiagnosticResult] = useState<DiagnosticResult | null>(null);

  React.useEffect(() => {
    loadVessels();
  }, []);

  const loadVessels = async () => {
    try {
      console.log('Loading vessels for diagnostic...');
      const data = await seaTimeApi.getVessels();
      setVessels(data);
      console.log('Vessels loaded:', data.length);
    } catch (error: any) {
      console.error('Failed to load vessels:', error);
      Alert.alert('Error', 'Failed to load vessels: ' + error.message);
    }
  };

  const runDiagnostic = async () => {
    if (!selectedVessel) {
      Alert.alert('Error', 'Please select a vessel first');
      return;
    }

    setLoading(true);
    setDiagnosticResult(null);

    try {
      console.log('Running AIS diagnostic for vessel:', selectedVessel.vessel_name);

      // Fetch AIS location data (extended response)
      const locationData = await seaTimeApi.getVesselAISLocation(selectedVessel.id, true);
      console.log('AIS location data received:', locationData);

      // Fetch debug logs to see raw API response
      const debugLogs = await seaTimeApi.getAISDebugLogs(selectedVessel.id);
      console.log('Debug logs received:', debugLogs.length);

      const result: DiagnosticResult = {
        vesselId: selectedVessel.id,
        vesselName: selectedVessel.vessel_name,
        mmsi: selectedVessel.mmsi,
        rawResponse: debugLogs.length > 0 ? debugLogs[0].response_body : null,
        parsedData: {
          name: locationData.name,
          latitude: locationData.latitude,
          longitude: locationData.longitude,
          speed: locationData.speed,
          course: locationData.course,
          heading: locationData.heading,
          status: locationData.status,
          timestamp: locationData.timestamp,
          destination: locationData.destination,
          eta: locationData.eta,
        },
        debugLogs: debugLogs.slice(0, 3), // Last 3 API calls
      };

      setDiagnosticResult(result);
      console.log('Diagnostic complete:', result);
    } catch (error: any) {
      console.error('Diagnostic failed:', error);
      Alert.alert(
        'Diagnostic Failed',
        error.message || 'Failed to run diagnostic. Check console for details.'
      );
    } finally {
      setLoading(false);
    }
  };

  const formatJSON = (obj: any): string => {
    if (!obj) return 'null';
    if (typeof obj === 'string') {
      try {
        return JSON.stringify(JSON.parse(obj), null, 2);
      } catch {
        return obj;
      }
    }
    return JSON.stringify(obj, null, 2);
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'AIS Data Diagnostic',
          headerStyle: { backgroundColor: isDark ? colors.cardBackground : colors.background },
          headerTintColor: colors.text,
          headerBackTitle: 'Back',
        }}
      />
      <ScrollView style={styles.container}>
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <IconSymbol
              ios_icon_name="stethoscope"
              android_material_icon_name="medical-services"
              size={32}
              color={colors.primary}
            />
            <Text style={styles.title}>AIS Data Diagnostic Tool</Text>
            <Text style={styles.subtitle}>
              This tool shows exactly what data is being returned from the MyShipTracking API
              and how it's being interpreted by the app.
            </Text>
          </View>

          {/* Vessel Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>1. Select Vessel</Text>
            {vessels.map((vessel) => (
              <TouchableOpacity
                key={vessel.id}
                style={[
                  styles.vesselCard,
                  selectedVessel?.id === vessel.id && styles.vesselCardSelected,
                ]}
                onPress={() => setSelectedVessel(vessel)}
              >
                <View style={styles.vesselInfo}>
                  <Text style={styles.vesselName}>{vessel.vessel_name}</Text>
                  <Text style={styles.vesselMmsi}>MMSI: {vessel.mmsi}</Text>
                </View>
                {selectedVessel?.id === vessel.id && (
                  <IconSymbol
                    ios_icon_name="checkmark.circle.fill"
                    android_material_icon_name="check-circle"
                    size={24}
                    color={colors.primary}
                  />
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* Run Diagnostic Button */}
          <TouchableOpacity
            style={[styles.runButton, loading && styles.runButtonDisabled]}
            onPress={runDiagnostic}
            disabled={loading || !selectedVessel}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <IconSymbol
                  ios_icon_name="play.circle.fill"
                  android_material_icon_name="play-circle-filled"
                  size={24}
                  color="#fff"
                />
                <Text style={styles.runButtonText}>Run Diagnostic</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Results */}
          {diagnosticResult && (
            <View style={styles.results}>
              <Text style={styles.resultsTitle}>Diagnostic Results</Text>

              {/* Vessel Info */}
              <View style={styles.resultSection}>
                <Text style={styles.resultSectionTitle}>Vessel Information</Text>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Name:</Text>
                  <Text style={styles.infoValue}>{diagnosticResult.vesselName}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>MMSI:</Text>
                  <Text style={styles.infoValue}>{diagnosticResult.mmsi}</Text>
                </View>
              </View>

              {/* Parsed Data */}
              <View style={styles.resultSection}>
                <Text style={styles.resultSectionTitle}>Parsed AIS Data</Text>
                <View style={styles.dataGrid}>
                  <DataField
                    label="Vessel Name"
                    value={diagnosticResult.parsedData.name}
                    isDark={isDark}
                  />
                  <DataField
                    label="Latitude"
                    value={diagnosticResult.parsedData.latitude}
                    isDark={isDark}
                  />
                  <DataField
                    label="Longitude"
                    value={diagnosticResult.parsedData.longitude}
                    isDark={isDark}
                  />
                  <DataField
                    label="Speed (knots)"
                    value={diagnosticResult.parsedData.speed}
                    isDark={isDark}
                  />
                  <DataField
                    label="Course (°)"
                    value={diagnosticResult.parsedData.course}
                    isDark={isDark}
                  />
                  <DataField
                    label="Heading (°)"
                    value={diagnosticResult.parsedData.heading}
                    isDark={isDark}
                  />
                  <DataField
                    label="Status"
                    value={diagnosticResult.parsedData.status}
                    isDark={isDark}
                  />
                  <DataField
                    label="Timestamp"
                    value={diagnosticResult.parsedData.timestamp}
                    isDark={isDark}
                  />
                  <DataField
                    label="Destination"
                    value={diagnosticResult.parsedData.destination}
                    isDark={isDark}
                  />
                  <DataField
                    label="ETA"
                    value={diagnosticResult.parsedData.eta}
                    isDark={isDark}
                  />
                </View>
              </View>

              {/* Raw API Response */}
              <View style={styles.resultSection}>
                <Text style={styles.resultSectionTitle}>Raw API Response</Text>
                <Text style={styles.jsonText}>
                  {formatJSON(diagnosticResult.rawResponse)}
                </Text>
              </View>

              {/* Debug Logs */}
              <View style={styles.resultSection}>
                <Text style={styles.resultSectionTitle}>Recent API Calls</Text>
                {diagnosticResult.debugLogs.map((log, index) => (
                  <View key={index} style={styles.logEntry}>
                    <View style={styles.logHeader}>
                      <Text style={styles.logTime}>
                        {new Date(log.request_time).toLocaleString()}
                      </Text>
                      <View
                        style={[
                          styles.statusBadge,
                          log.response_status === '200'
                            ? styles.statusSuccess
                            : styles.statusError,
                        ]}
                      >
                        <Text style={styles.statusText}>{log.response_status}</Text>
                      </View>
                    </View>
                    <Text style={styles.logUrl}>{log.api_url}</Text>
                    {log.error_message && (
                      <Text style={styles.logError}>Error: {log.error_message}</Text>
                    )}
                  </View>
                ))}
              </View>

              {/* Interpretation Guide */}
              <View style={styles.resultSection}>
                <Text style={styles.resultSectionTitle}>Data Interpretation</Text>
                <Text style={styles.guideText}>
                  ✅ <Text style={styles.guideBold}>Green values</Text>: Data is present and
                  valid
                </Text>
                <Text style={styles.guideText}>
                  ⚠️ <Text style={styles.guideBold}>null values</Text>: Data is missing from
                  the API response
                </Text>
                <Text style={styles.guideText}>
                  • If latitude/longitude are null, the vessel position is unknown
                </Text>
                <Text style={styles.guideText}>
                  • If speed is null, the vessel speed cannot be determined
                </Text>
                <Text style={styles.guideText}>
                  • Check the Raw API Response to see exactly what MyShipTracking returned
                </Text>
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </>
  );
}

function DataField({
  label,
  value,
  isDark,
}: {
  label: string;
  value: any;
  isDark: boolean;
}) {
  const isNull = value === null || value === undefined;
  const displayValue = isNull ? 'null' : String(value);

  return (
    <View style={dataFieldStyles.container}>
      <Text style={[dataFieldStyles.label, { color: colors.textSecondary }]}>{label}</Text>
      <Text
        style={[
          dataFieldStyles.value,
          {
            color: isNull ? colors.error : colors.success,
            fontWeight: isNull ? 'normal' : 'bold',
          },
        ]}
      >
        {displayValue}
      </Text>
    </View>
  );
}

const dataFieldStyles = StyleSheet.create({
  container: {
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    marginBottom: 4,
  },
  value: {
    fontSize: 16,
  },
});

function createStyles(isDark: boolean) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? colors.background : '#f5f5f5',
    },
    content: {
      padding: 16,
    },
    header: {
      alignItems: 'center',
      marginBottom: 24,
      padding: 20,
      backgroundColor: isDark ? colors.cardBackground : '#fff',
      borderRadius: 12,
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      color: colors.text,
      marginTop: 12,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
    },
    section: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 12,
    },
    vesselCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
      backgroundColor: isDark ? colors.cardBackground : '#fff',
      borderRadius: 12,
      marginBottom: 8,
      borderWidth: 2,
      borderColor: 'transparent',
    },
    vesselCardSelected: {
      borderColor: colors.primary,
    },
    vesselInfo: {
      flex: 1,
    },
    vesselName: {
      fontSize: 16,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 4,
    },
    vesselMmsi: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    runButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      padding: 16,
      borderRadius: 12,
      marginBottom: 24,
      gap: 8,
    },
    runButtonDisabled: {
      opacity: 0.5,
    },
    runButtonText: {
      fontSize: 18,
      fontWeight: 'bold',
      color: '#fff',
    },
    results: {
      marginTop: 8,
    },
    resultsTitle: {
      fontSize: 22,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 16,
    },
    resultSection: {
      backgroundColor: isDark ? colors.cardBackground : '#fff',
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
    },
    resultSectionTitle: {
      fontSize: 16,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 12,
    },
    infoRow: {
      flexDirection: 'row',
      marginBottom: 8,
    },
    infoLabel: {
      fontSize: 14,
      color: colors.textSecondary,
      width: 80,
    },
    infoValue: {
      fontSize: 14,
      color: colors.text,
      flex: 1,
      fontWeight: '600',
    },
    dataGrid: {
      gap: 4,
    },
    jsonText: {
      fontFamily: 'monospace',
      fontSize: 12,
      color: colors.text,
      backgroundColor: isDark ? '#1a1a1a' : '#f5f5f5',
      padding: 12,
      borderRadius: 8,
      lineHeight: 18,
    },
    logEntry: {
      backgroundColor: isDark ? '#1a1a1a' : '#f5f5f5',
      padding: 12,
      borderRadius: 8,
      marginBottom: 8,
    },
    logHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    logTime: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    statusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 4,
    },
    statusSuccess: {
      backgroundColor: colors.success + '20',
    },
    statusError: {
      backgroundColor: colors.error + '20',
    },
    statusText: {
      fontSize: 12,
      fontWeight: 'bold',
      color: colors.text,
    },
    logUrl: {
      fontSize: 11,
      color: colors.textSecondary,
      fontFamily: 'monospace',
      marginBottom: 4,
    },
    logError: {
      fontSize: 12,
      color: colors.error,
      marginTop: 4,
    },
    guideText: {
      fontSize: 14,
      color: colors.text,
      marginBottom: 8,
      lineHeight: 20,
    },
    guideBold: {
      fontWeight: 'bold',
    },
  });
}

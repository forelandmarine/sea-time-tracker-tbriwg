
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  useColorScheme,
  Platform,
} from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import * as seaTimeApi from '@/utils/seaTimeApi';

interface DiagnosticEntry {
  id: string;
  vessel_id: string;
  timestamp: string;
  ais_data: any;
  is_moving: boolean;
  speed_knots: number | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
}

interface Vessel {
  id: string;
  mmsi: string;
  vessel_name: string;
  is_active: boolean;
  created_at: string;
}

function createStyles(isDark: boolean) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? colors.background : colors.backgroundLight,
    },
    scrollContent: {
      padding: 16,
      paddingBottom: 100,
    },
    card: {
      backgroundColor: isDark ? colors.cardBackground : colors.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
    },
    cardTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: isDark ? colors.text : colors.textLight,
      marginBottom: 12,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? colors.border : colors.borderLight,
    },
    rowLast: {
      borderBottomWidth: 0,
    },
    label: {
      fontSize: 14,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
    },
    value: {
      fontSize: 14,
      fontWeight: '500',
      color: isDark ? colors.text : colors.textLight,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    emptyText: {
      fontSize: 16,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
      textAlign: 'center',
      fontStyle: 'italic',
      marginTop: 40,
    },
    refreshButton: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
      marginBottom: 16,
    },
    refreshButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },
  });
}

export default function VesselDiagnosticScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const params = useLocalSearchParams();
  const vesselId = params.vesselId as string;

  const [loading, setLoading] = useState(true);
  const [vessel, setVessel] = useState<Vessel | null>(null);
  const [diagnostics, setDiagnostics] = useState<DiagnosticEntry[]>([]);

  const router = useRouter();

  const loadDiagnostics = useCallback(async () => {
    try {
      console.log('[VesselDiagnostic] Loading diagnostics for vessel:', vesselId);
      setLoading(true);

      // Load vessel info
      const vessels = await seaTimeApi.getVessels();
      const foundVessel = vessels.find(v => v.id === vesselId);
      if (foundVessel) {
        setVessel(foundVessel);
      }

      // Load diagnostic data
      // TODO: Backend Integration - GET /api/vessels/:id/diagnostics
      // This endpoint should return diagnostic entries for the vessel
      console.log('[VesselDiagnostic] Diagnostic data loading not yet implemented');
      setDiagnostics([]);
    } catch (error: any) {
      console.error('[VesselDiagnostic] Error loading diagnostics:', error);
    } finally {
      setLoading(false);
    }
  }, [vesselId]);

  useEffect(() => {
    console.log('[VesselDiagnostic] Component mounted');
    loadDiagnostics();
  }, [loadDiagnostics]);

  const handleRefresh = () => {
    console.log('[VesselDiagnostic] User tapped Refresh button');
    loadDiagnostics();
  };

  const formatDateTime = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const styles = createStyles(isDark);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const vesselNameText = vessel?.vessel_name || 'Unknown Vessel';
  const mmsiText = vessel?.mmsi || 'N/A';

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Vessel Diagnostics',
          headerShown: true,
        }}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Vessel Information</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Name</Text>
            <Text style={styles.value}>{vesselNameText}</Text>
          </View>
          <View style={[styles.row, styles.rowLast]}>
            <Text style={styles.label}>MMSI</Text>
            <Text style={styles.value}>{mmsiText}</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.refreshButton} onPress={handleRefresh}>
          <Text style={styles.refreshButtonText}>Refresh Diagnostics</Text>
        </TouchableOpacity>

        {diagnostics.length === 0 ? (
          <Text style={styles.emptyText}>No diagnostic data available</Text>
        ) : (
          diagnostics.map((entry, index) => {
            const timestampText = formatDateTime(entry.timestamp);
            const speedText = entry.speed_knots !== null ? `${entry.speed_knots.toFixed(1)} kts` : 'N/A';
            const latText = entry.latitude !== null ? entry.latitude.toFixed(6) : 'N/A';
            const lonText = entry.longitude !== null ? entry.longitude.toFixed(6) : 'N/A';
            const movingText = entry.is_moving ? 'Yes' : 'No';

            return (
              <View key={entry.id} style={styles.card}>
                <Text style={styles.cardTitle}>Entry {index + 1}</Text>
                <View style={styles.row}>
                  <Text style={styles.label}>Timestamp</Text>
                  <Text style={styles.value}>{timestampText}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.label}>Speed</Text>
                  <Text style={styles.value}>{speedText}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.label}>Latitude</Text>
                  <Text style={styles.value}>{latText}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.label}>Longitude</Text>
                  <Text style={styles.value}>{lonText}</Text>
                </View>
                <View style={[styles.row, styles.rowLast]}>
                  <Text style={styles.label}>Moving</Text>
                  <Text style={styles.value}>{movingText}</Text>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </>
  );
}

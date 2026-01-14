
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  useColorScheme,
  RefreshControl,
  Platform,
} from 'react-native';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import * as seaTimeApi from '@/utils/seaTimeApi';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState, useEffect, useCallback } from 'react';

interface Vessel {
  id: string;
  mmsi: string;
  vessel_name: string;
  is_active: boolean;
  created_at: string;
}

interface SeaTimeEntry {
  id: string;
  vessel: Vessel;
  start_time: string;
  end_time: string | null;
  duration_hours: number | null;
  status: 'pending' | 'confirmed' | 'rejected';
  notes: string | null;
  created_at: string;
  start_latitude?: number | null;
  start_longitude?: number | null;
  end_latitude?: number | null;
  end_longitude?: number | null;
}

function createStyles(isDark: boolean) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? colors.background : colors.backgroundLight,
    },
    scrollContent: {
      padding: 20,
      paddingBottom: 100,
    },
    header: {
      fontSize: 28,
      fontWeight: 'bold',
      color: isDark ? colors.text : colors.textLight,
      marginBottom: 8,
    },
    mmsi: {
      fontSize: 16,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
      marginBottom: 24,
    },
    statsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 24,
    },
    statCard: {
      flex: 1,
      backgroundColor: isDark ? colors.cardBackground : colors.card,
      borderRadius: 16,
      padding: 16,
      marginHorizontal: 4,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
      borderWidth: 1,
      borderColor: isDark ? colors.border : colors.borderLight,
    },
    statValue: {
      fontSize: 24,
      fontWeight: 'bold',
      color: colors.primary,
      marginBottom: 4,
    },
    statLabel: {
      fontSize: 12,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
      textAlign: 'center',
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: isDark ? colors.text : colors.textLight,
      marginBottom: 12,
      marginTop: 8,
    },
    entryCard: {
      backgroundColor: isDark ? colors.cardBackground : colors.card,
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
      borderWidth: 1,
      borderColor: isDark ? colors.border : colors.borderLight,
    },
    entryHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    entryDate: {
      fontSize: 16,
      fontWeight: '600',
      color: isDark ? colors.text : colors.textLight,
    },
    statusBadge: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 12,
    },
    statusText: {
      fontSize: 12,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    entryDetails: {
      marginTop: 8,
    },
    entryDetailText: {
      fontSize: 14,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
      marginBottom: 4,
    },
    coordinatesSection: {
      backgroundColor: isDark ? 'rgba(0, 122, 255, 0.1)' : 'rgba(0, 122, 255, 0.05)',
      borderRadius: 8,
      padding: 10,
      marginTop: 8,
      borderLeftWidth: 3,
      borderLeftColor: colors.primary,
    },
    coordinatesHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 6,
    },
    coordinatesHeaderText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.primary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    coordinateRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 3,
    },
    coordinateLabel: {
      fontSize: 12,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
      fontWeight: '500',
    },
    coordinateValue: {
      fontSize: 12,
      fontWeight: '600',
      color: isDark ? colors.text : colors.textLight,
      fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    },
    emptyState: {
      alignItems: 'center',
      padding: 32,
    },
    emptyText: {
      fontSize: 16,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
      textAlign: 'center',
      marginTop: 12,
    },
    dateHeader: {
      fontSize: 18,
      fontWeight: '600',
      color: isDark ? colors.text : colors.textLight,
      marginTop: 16,
      marginBottom: 8,
    },
    debugButton: {
      backgroundColor: isDark ? colors.secondary : colors.accent,
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
      marginBottom: 24,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    debugButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },
  });
}

export default function VesselDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [vessel, setVessel] = useState<Vessel | null>(null);
  const [entries, setEntries] = useState<SeaTimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const styles = createStyles(isDark);
  const router = useRouter();

  const loadData = useCallback(async () => {
    console.log('[VesselDetailScreen] Loading data for vessel:', id);
    try {
      const vessels = await seaTimeApi.getVessels();
      const currentVessel = vessels.find((v) => v.id === id);
      
      if (!currentVessel) {
        console.error('[VesselDetailScreen] Vessel not found:', id);
        Alert.alert('Error', 'Vessel not found');
        router.back();
        return;
      }

      setVessel(currentVessel);
      console.log('[VesselDetailScreen] Vessel loaded:', currentVessel.vessel_name);

      const seaTimeEntries = await seaTimeApi.getVesselSeaTime(id);
      console.log('[VesselDetailScreen] Sea time entries loaded:', seaTimeEntries.length);
      setEntries(seaTimeEntries);
    } catch (error) {
      console.error('[VesselDetailScreen] Error loading data:', error);
      Alert.alert('Error', 'Failed to load vessel data. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id, router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    console.log('[VesselDetailScreen] User initiated refresh');
    setRefreshing(true);
    loadData();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
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
        return colors.primary;
    }
  };

  const calculateTotalHours = (): number => {
    const total = entries
      .filter((e) => e.status === 'confirmed' && e.duration_hours !== null && e.duration_hours !== undefined)
      .reduce((sum, e) => sum + (Number(e.duration_hours) || 0), 0);
    
    console.log('[VesselDetailScreen] calculateTotalHours result:', total);
    return total || 0;
  };

  const calculateTotalDays = (): number => {
    const hours = calculateTotalHours();
    return Math.floor(hours / 24);
  };

  const groupEntriesByDate = () => {
    const grouped: { [key: string]: SeaTimeEntry[] } = {};
    entries.forEach((entry) => {
      const date = formatDate(entry.start_time);
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(entry);
    });
    return grouped;
  };

  const handleViewDebugLogs = () => {
    console.log('[VesselDetailScreen] User tapped View Debug Logs button');
    router.push(`/debug/${id}` as any);
  };

  if (loading || !vessel) {
    return (
      <View style={styles.container}>
        <Stack.Screen
          options={{
            headerShown: true,
            title: 'Loading...',
            headerBackTitle: 'Back',
          }}
        />
        <View style={styles.scrollContent}>
          <Text style={styles.emptyText}>Loading vessel data...</Text>
        </View>
      </View>
    );
  }

  const groupedEntries = groupEntriesByDate();
  const totalHours = calculateTotalHours();
  const totalDays = calculateTotalDays();

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: vessel.vessel_name,
          headerBackTitle: 'Back',
        }}
      />
      
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <Text style={styles.header}>{vessel.vessel_name}</Text>
        <Text style={styles.mmsi}>MMSI: {vessel.mmsi}</Text>

        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{totalDays}</Text>
            <Text style={styles.statLabel}>Total Days</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{totalHours.toFixed(1)}</Text>
            <Text style={styles.statLabel}>Total Hours</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{entries.length}</Text>
            <Text style={styles.statLabel}>Total Entries</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.debugButton} onPress={handleViewDebugLogs}>
          <Text style={styles.debugButtonText}>View AIS Debug Logs</Text>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Sea Time History</Text>

        {entries.length === 0 ? (
          <View style={styles.emptyState}>
            <IconSymbol
              ios_icon_name="clock"
              android_material_icon_name="schedule"
              size={48}
              color={isDark ? colors.textSecondary : colors.textSecondaryLight}
            />
            <Text style={styles.emptyText}>
              No sea time entries yet.
              {'\n\n'}
              Activate this vessel and check AIS data to start tracking.
            </Text>
          </View>
        ) : (
          Object.keys(groupedEntries)
            .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
            .map((date) => (
              <React.Fragment key={date}>
                <Text style={styles.dateHeader}>{date}</Text>
                {groupedEntries[date].map((entry) => (
                  <View key={entry.id} style={styles.entryCard}>
                    <View style={styles.entryHeader}>
                      <Text style={styles.entryDate}>
                        {formatDateTime(entry.start_time)}
                      </Text>
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
                    <View style={styles.entryDetails}>
                      {entry.end_time && (
                        <Text style={styles.entryDetailText}>
                          End: {formatDateTime(entry.end_time)}
                        </Text>
                      )}
                      {entry.duration_hours !== null && entry.duration_hours !== undefined && (
                        <Text style={styles.entryDetailText}>
                          Duration: {Number(entry.duration_hours).toFixed(1)} hours (
                          {(Number(entry.duration_hours) / 24).toFixed(2)} days)
                        </Text>
                      )}
                      {entry.notes && (
                        <Text style={styles.entryDetailText}>
                          Notes: {entry.notes}
                        </Text>
                      )}
                    </View>

                    {/* GPS Coordinates Section */}
                    {((entry.start_latitude !== null && entry.start_latitude !== undefined && 
                       entry.start_longitude !== null && entry.start_longitude !== undefined) ||
                      (entry.end_latitude !== null && entry.end_latitude !== undefined && 
                       entry.end_longitude !== null && entry.end_longitude !== undefined)) && (
                      <View style={styles.coordinatesSection}>
                        <View style={styles.coordinatesHeader}>
                          <IconSymbol
                            ios_icon_name="location.fill"
                            android_material_icon_name="location-on"
                            size={14}
                            color={colors.primary}
                          />
                          <Text style={styles.coordinatesHeaderText}>GPS Coordinates</Text>
                        </View>
                        
                        {entry.start_latitude !== null && entry.start_latitude !== undefined && 
                         entry.start_longitude !== null && entry.start_longitude !== undefined && (
                          <View style={styles.coordinateRow}>
                            <Text style={styles.coordinateLabel}>Start:</Text>
                            <Text style={styles.coordinateValue}>
                              {Number(entry.start_latitude).toFixed(6)}°, {Number(entry.start_longitude).toFixed(6)}°
                            </Text>
                          </View>
                        )}
                        
                        {entry.end_latitude !== null && entry.end_latitude !== undefined && 
                         entry.end_longitude !== null && entry.end_longitude !== undefined && (
                          <View style={styles.coordinateRow}>
                            <Text style={styles.coordinateLabel}>End:</Text>
                            <Text style={styles.coordinateValue}>
                              {Number(entry.end_latitude).toFixed(6)}°, {Number(entry.end_longitude).toFixed(6)}°
                            </Text>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                ))}
              </React.Fragment>
            ))
        )}
      </ScrollView>
    </View>
  );
}

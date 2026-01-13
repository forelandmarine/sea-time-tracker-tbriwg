
import React, { useState, useEffect } from 'react';
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
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import * as seaTimeApi from '@/utils/seaTimeApi';

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
}

export default function VesselDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const [vessel, setVessel] = useState<Vessel | null>(null);
  const [seaTimeEntries, setSeaTimeEntries] = useState<SeaTimeEntry[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    if (!id || typeof id !== 'string') {
      console.error('[VesselDetail] Invalid vessel ID');
      return;
    }

    try {
      console.log('[VesselDetail] Loading data for vessel:', id);
      
      // Load vessel sea time entries
      const entries = await seaTimeApi.getVesselSeaTime(id);
      console.log('[VesselDetail] Loaded sea time entries:', entries.length);
      setSeaTimeEntries(entries);
      
      // Get vessel info from the first entry
      if (entries.length > 0) {
        setVessel(entries[0].vessel);
      } else {
        // If no entries, fetch all vessels to get this vessel's info
        const vessels = await seaTimeApi.getVessels();
        const foundVessel = vessels.find(v => v.id === id);
        if (foundVessel) {
          setVessel(foundVessel);
        }
      }
      
      setLoading(false);
    } catch (error) {
      console.error('[VesselDetail] Error loading data:', error);
      Alert.alert('Error', 'Failed to load vessel data. Please try again.');
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
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
    return date.toLocaleDateString('en-GB', {
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
        return colors.success;
      case 'pending':
        return colors.warning;
      case 'rejected':
        return colors.danger;
      default:
        return colors.textSecondary;
    }
  };

  const calculateTotalHours = () => {
    return seaTimeEntries
      .filter(entry => entry.status === 'confirmed' && entry.duration_hours)
      .reduce((total, entry) => total + (entry.duration_hours || 0), 0);
  };

  const calculateTotalDays = () => {
    const totalHours = calculateTotalHours();
    return Math.floor(totalHours / 24);
  };

  const groupEntriesByDate = () => {
    const grouped: { [key: string]: SeaTimeEntry[] } = {};
    
    seaTimeEntries.forEach(entry => {
      const date = formatDate(entry.start_time);
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(entry);
    });
    
    return grouped;
  };

  const styles = createStyles(isDark);
  const groupedEntries = groupEntriesByDate();
  const totalHours = calculateTotalHours();
  const totalDays = calculateTotalDays();

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: vessel?.vessel_name || 'Vessel Details',
          headerBackTitle: 'Back',
          headerStyle: {
            backgroundColor: isDark ? colors.cardDark : colors.card,
          },
          headerTintColor: isDark ? colors.textDark : colors.text,
        }}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        ) : (
          <>
            {/* Vessel Info Card */}
            {vessel && (
              <View style={styles.infoCard}>
                <View style={styles.infoRow}>
                  <IconSymbol
                    ios_icon_name="sailboat"
                    android_material_icon_name="directions-boat"
                    size={24}
                    color={colors.primary}
                  />
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Vessel Name</Text>
                    <Text style={styles.infoValue}>{vessel.vessel_name}</Text>
                  </View>
                </View>
                
                <View style={styles.infoRow}>
                  <IconSymbol
                    ios_icon_name="number"
                    android_material_icon_name="tag"
                    size={24}
                    color={colors.primary}
                  />
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>MMSI</Text>
                    <Text style={styles.infoValue}>{vessel.mmsi}</Text>
                  </View>
                </View>
                
                <View style={styles.infoRow}>
                  <IconSymbol
                    ios_icon_name="checkmark.circle"
                    android_material_icon_name="check-circle"
                    size={24}
                    color={vessel.is_active ? colors.success : colors.textSecondary}
                  />
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Status</Text>
                    <Text style={[styles.infoValue, { color: vessel.is_active ? colors.success : colors.textSecondary }]}>
                      {vessel.is_active ? 'Active' : 'Historic'}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Summary Card */}
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Sea Time Summary</Text>
              <View style={styles.summaryRow}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{totalDays}</Text>
                  <Text style={styles.summaryLabel}>Days</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{totalHours.toFixed(1)}</Text>
                  <Text style={styles.summaryLabel}>Hours</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{seaTimeEntries.length}</Text>
                  <Text style={styles.summaryLabel}>Entries</Text>
                </View>
              </View>
            </View>

            {/* Sea Time Entries */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Sea Time History</Text>
              
              {seaTimeEntries.length === 0 ? (
                <View style={styles.emptyState}>
                  <IconSymbol
                    ios_icon_name="calendar"
                    android_material_icon_name="calendar-today"
                    size={64}
                    color={colors.textSecondary}
                  />
                  <Text style={styles.emptyText}>No sea time recorded</Text>
                  <Text style={styles.emptySubtext}>
                    Sea time entries will appear here once recorded
                  </Text>
                </View>
              ) : (
                Object.keys(groupedEntries).map((date, dateIndex) => (
                  <View key={dateIndex} style={styles.dateGroup}>
                    <Text style={styles.dateHeader}>{date}</Text>
                    {groupedEntries[date].map((entry, entryIndex) => (
                      <View key={entry.id || entryIndex} style={styles.entryCard}>
                        <View style={styles.entryHeader}>
                          <View style={styles.entryTimeContainer}>
                            <IconSymbol
                              ios_icon_name="clock"
                              android_material_icon_name="schedule"
                              size={16}
                              color={isDark ? colors.textSecondaryDark : colors.textSecondary}
                            />
                            <Text style={styles.entryTime}>
                              {new Date(entry.start_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                              {entry.end_time && ` - ${new Date(entry.end_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`}
                            </Text>
                          </View>
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
                        
                        {entry.duration_hours && (
                          <View style={styles.entryDetail}>
                            <IconSymbol
                              ios_icon_name="timer"
                              android_material_icon_name="access-time"
                              size={16}
                              color={colors.primary}
                            />
                            <Text style={styles.entryDetailText}>
                              Duration: {entry.duration_hours.toFixed(1)} hours
                            </Text>
                          </View>
                        )}
                        
                        {entry.notes && (
                          <View style={styles.entryDetail}>
                            <IconSymbol
                              ios_icon_name="note"
                              android_material_icon_name="description"
                              size={16}
                              color={colors.primary}
                            />
                            <Text style={styles.entryDetailText}>{entry.notes}</Text>
                          </View>
                        )}
                      </View>
                    ))}
                  </View>
                ))
              )}
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
      padding: 32,
    },
    loadingText: {
      fontSize: 16,
      color: isDark ? colors.textSecondaryDark : colors.textSecondary,
    },
    infoCard: {
      backgroundColor: isDark ? colors.cardDark : colors.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: isDark ? colors.borderDark : colors.border,
      boxShadow: '0px 2px 8px rgba(0, 119, 190, 0.1)',
      elevation: 2,
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      gap: 12,
    },
    infoContent: {
      flex: 1,
    },
    infoLabel: {
      fontSize: 12,
      color: isDark ? colors.textSecondaryDark : colors.textSecondary,
      marginBottom: 4,
    },
    infoValue: {
      fontSize: 16,
      fontWeight: '600',
      color: isDark ? colors.textDark : colors.text,
    },
    summaryCard: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      padding: 20,
      marginBottom: 16,
      boxShadow: '0px 4px 12px rgba(0, 119, 190, 0.2)',
      elevation: 3,
    },
    summaryTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.card,
      marginBottom: 16,
      textAlign: 'center',
    },
    summaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      alignItems: 'center',
    },
    summaryItem: {
      alignItems: 'center',
      flex: 1,
    },
    summaryValue: {
      fontSize: 32,
      fontWeight: '700',
      color: colors.card,
      marginBottom: 4,
    },
    summaryLabel: {
      fontSize: 14,
      color: colors.card,
      opacity: 0.9,
    },
    summaryDivider: {
      width: 1,
      height: 40,
      backgroundColor: colors.card,
      opacity: 0.3,
    },
    section: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: isDark ? colors.textDark : colors.text,
      marginBottom: 16,
    },
    emptyState: {
      alignItems: 'center',
      padding: 32,
      backgroundColor: isDark ? colors.cardDark : colors.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: isDark ? colors.borderDark : colors.border,
    },
    emptyText: {
      fontSize: 16,
      fontWeight: '600',
      color: isDark ? colors.textSecondaryDark : colors.textSecondary,
      marginTop: 16,
    },
    emptySubtext: {
      fontSize: 14,
      color: isDark ? colors.textSecondaryDark : colors.textSecondary,
      textAlign: 'center',
      marginTop: 8,
    },
    dateGroup: {
      marginBottom: 24,
    },
    dateHeader: {
      fontSize: 16,
      fontWeight: '700',
      color: isDark ? colors.textDark : colors.text,
      marginBottom: 12,
      paddingLeft: 4,
    },
    entryCard: {
      backgroundColor: isDark ? colors.cardDark : colors.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: isDark ? colors.borderDark : colors.border,
      boxShadow: '0px 2px 8px rgba(0, 119, 190, 0.1)',
      elevation: 2,
    },
    entryHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    entryTimeContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    entryTime: {
      fontSize: 14,
      fontWeight: '600',
      color: isDark ? colors.textDark : colors.text,
    },
    statusBadge: {
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 12,
    },
    statusText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.card,
    },
    entryDetail: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 8,
    },
    entryDetailText: {
      fontSize: 14,
      color: isDark ? colors.textDark : colors.text,
      flex: 1,
    },
  });


import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  useColorScheme,
  RefreshControl,
} from 'react-native';
import { colors } from '@/styles/commonStyles';
import * as seaTimeApi from '@/utils/seaTimeApi';
import { useRouter } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import React, { useState, useEffect } from 'react';

interface Vessel {
  id: string;
  mmsi: string;
  vessel_name: string;
  is_active: boolean;
  created_at: string;
}

interface SeaTimeEntry {
  id: string;
  vessel: Vessel | null;
  start_time: string;
  end_time: string | null;
  duration_hours: number | string | null;
  status: 'pending' | 'confirmed' | 'rejected';
  notes: string | null;
  created_at: string;
  start_latitude?: number | string | null;
  start_longitude?: number | string | null;
  end_latitude?: number | string | null;
  end_longitude?: number | string | null;
}

const createStyles = (isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? colors.background : colors.backgroundLight,
    },
    header: {
      paddingTop: 60,
      paddingHorizontal: 20,
      paddingBottom: 20,
      backgroundColor: isDark ? colors.background : colors.backgroundLight,
    },
    title: {
      fontSize: 34,
      fontWeight: 'bold',
      color: isDark ? colors.text : colors.textLight,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 16,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
    },
    scrollContent: {
      paddingHorizontal: 20,
      paddingBottom: 100,
    },
    summaryCard: {
      backgroundColor: isDark ? colors.cardBackground : colors.cardBackgroundLight,
      borderRadius: 16,
      padding: 20,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
    },
    summaryTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: isDark ? colors.text : colors.textLight,
      marginBottom: 16,
    },
    summaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    summaryLabel: {
      fontSize: 15,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
    },
    summaryValue: {
      fontSize: 17,
      fontWeight: '600',
      color: isDark ? colors.text : colors.textLight,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: isDark ? colors.text : colors.textLight,
      marginBottom: 12,
      marginTop: 8,
    },
    entryCard: {
      backgroundColor: isDark ? colors.cardBackground : colors.cardBackgroundLight,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
    },
    entryHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    vesselName: {
      fontSize: 16,
      fontWeight: '600',
      color: isDark ? colors.text : colors.textLight,
      flex: 1,
    },
    statusBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
      marginLeft: 8,
    },
    statusText: {
      fontSize: 12,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    entryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 6,
    },
    entryIcon: {
      marginRight: 8,
    },
    entryText: {
      fontSize: 14,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
      flex: 1,
    },
    durationText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.primary,
      marginTop: 8,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingTop: 100,
    },
    emptyText: {
      fontSize: 17,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
      textAlign: 'center',
      marginTop: 16,
    },
    emptySubtext: {
      fontSize: 15,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
      textAlign: 'center',
      marginTop: 8,
      paddingHorizontal: 40,
    },
  });

export default function LogbookScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const styles = createStyles(isDark);
  const router = useRouter();

  const [entries, setEntries] = useState<SeaTimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    console.log('[LogbookScreen] Component mounted, loading data');
    loadData();
  }, []);

  const loadData = async () => {
    try {
      console.log('[LogbookScreen] Fetching sea time entries');
      const data = await seaTimeApi.getSeaTimeEntries();
      console.log('[LogbookScreen] Received entries:', data.length);
      setEntries(data);
    } catch (error) {
      console.error('[LogbookScreen] Error loading entries:', error);
      Alert.alert('Error', 'Failed to load logbook entries');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    console.log('[LogbookScreen] User initiated refresh');
    setRefreshing(true);
    loadData();
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
        return '#34C759';
      case 'pending':
        return '#FF9500';
      case 'rejected':
        return '#FF3B30';
      default:
        return '#8E8E93';
    }
  };

  const toNumber = (value: number | string | null | undefined): number => {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'number') return value;
    const parsed = parseFloat(value);
    return isNaN(parsed) ? 0 : parsed;
  };

  const formatDuration = (hours: number | string | null | undefined): string => {
    const h = toNumber(hours);
    if (h === 0) return 'In progress';
    const wholeHours = Math.floor(h);
    const minutes = Math.round((h - wholeHours) * 60);
    if (minutes === 0) return `${wholeHours}h`;
    return `${wholeHours}h ${minutes}m`;
  };

  const formatDays = (hours: number | string | null | undefined): string => {
    const h = toNumber(hours);
    const days = (h / 24).toFixed(1);
    return `${days} days`;
  };

  const calculateTotalHours = () => {
    return entries
      .filter((e) => e.status === 'confirmed')
      .reduce((sum, entry) => sum + toNumber(entry.duration_hours), 0);
  };

  const calculateTotalDays = () => {
    return (calculateTotalHours() / 24).toFixed(1);
  };

  const confirmedEntries = entries.filter((e) => e.status === 'confirmed');
  const pendingEntries = entries.filter((e) => e.status === 'pending');

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Logbook</Text>
          <Text style={styles.subtitle}>Loading your sea time records...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Logbook</Text>
        <Text style={styles.subtitle}>All your sea time entries</Text>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={entries.length === 0 ? { flex: 1 } : styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {entries.length === 0 ? (
          <View style={styles.emptyContainer}>
            <IconSymbol
              ios_icon_name="book.closed"
              android_material_icon_name="menu-book"
              size={64}
              color={isDark ? colors.textSecondary : colors.textSecondaryLight}
            />
            <Text style={styles.emptyText}>No sea time entries yet</Text>
            <Text style={styles.emptySubtext}>
              Your confirmed sea time entries will appear here once you start tracking vessels
            </Text>
          </View>
        ) : (
          <React.Fragment>
            {/* Summary Card */}
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Summary</Text>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Total Confirmed Days</Text>
                <Text style={styles.summaryValue}>{calculateTotalDays()}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Total Confirmed Hours</Text>
                <Text style={styles.summaryValue}>
                  {calculateTotalHours().toFixed(1)}h
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Confirmed Entries</Text>
                <Text style={styles.summaryValue}>{confirmedEntries.length}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Pending Review</Text>
                <Text style={styles.summaryValue}>{pendingEntries.length}</Text>
              </View>
            </View>

            {/* Confirmed Entries */}
            {confirmedEntries.length > 0 && (
              <React.Fragment>
                <Text style={styles.sectionTitle}>Confirmed Entries</Text>
                {confirmedEntries.map((entry, index) => (
                  <View key={index} style={styles.entryCard}>
                    <View style={styles.entryHeader}>
                      <Text style={styles.vesselName}>
                        {entry.vessel?.vessel_name || 'Unknown Vessel'}
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

                    <View style={styles.entryRow}>
                      <IconSymbol
                        ios_icon_name="calendar"
                        android_material_icon_name="calendar-today"
                        size={16}
                        color={isDark ? colors.textSecondary : colors.textSecondaryLight}
                        style={styles.entryIcon}
                      />
                      <Text style={styles.entryText}>
                        {formatDate(entry.start_time)} at {formatTime(entry.start_time)}
                        {entry.end_time &&
                          ` - ${formatDate(entry.end_time)} at ${formatTime(entry.end_time)}`}
                      </Text>
                    </View>

                    {entry.duration_hours !== null && (
                      <Text style={styles.durationText}>
                        {formatDuration(entry.duration_hours)} ({formatDays(entry.duration_hours)})
                      </Text>
                    )}

                    {entry.notes && (
                      <View style={styles.entryRow}>
                        <IconSymbol
                          ios_icon_name="note.text"
                          android_material_icon_name="description"
                          size={16}
                          color={isDark ? colors.textSecondary : colors.textSecondaryLight}
                          style={styles.entryIcon}
                        />
                        <Text style={styles.entryText}>{entry.notes}</Text>
                      </View>
                    )}
                  </View>
                ))}
              </React.Fragment>
            )}

            {/* Pending Entries */}
            {pendingEntries.length > 0 && (
              <React.Fragment>
                <Text style={styles.sectionTitle}>Pending Review</Text>
                {pendingEntries.map((entry, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.entryCard}
                    onPress={() => {
                      console.log('[LogbookScreen] User tapped pending entry, navigating to Review tab');
                      router.push('/(tabs)/confirmations');
                    }}
                  >
                    <View style={styles.entryHeader}>
                      <Text style={styles.vesselName}>
                        {entry.vessel?.vessel_name || 'Unknown Vessel'}
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

                    <View style={styles.entryRow}>
                      <IconSymbol
                        ios_icon_name="calendar"
                        android_material_icon_name="calendar-today"
                        size={16}
                        color={isDark ? colors.textSecondary : colors.textSecondaryLight}
                        style={styles.entryIcon}
                      />
                      <Text style={styles.entryText}>
                        {formatDate(entry.start_time)} at {formatTime(entry.start_time)}
                        {entry.end_time &&
                          ` - ${formatDate(entry.end_time)} at ${formatTime(entry.end_time)}`}
                      </Text>
                    </View>

                    {entry.duration_hours !== null && (
                      <Text style={styles.durationText}>
                        {formatDuration(entry.duration_hours)} ({formatDays(entry.duration_hours)})
                      </Text>
                    )}
                  </TouchableOpacity>
                ))}
              </React.Fragment>
            )}
          </React.Fragment>
        )}
      </ScrollView>
    </View>
  );
}

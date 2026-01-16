
import { colors } from '@/styles/commonStyles';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as seaTimeApi from '@/utils/seaTimeApi';
import { IconSymbol } from '@/components/IconSymbol';
import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Image,
  ActivityIndicator,
} from 'react-native';
import { scheduleSeaTimeNotification } from '@/utils/notifications';

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

export default function ConfirmationsScreen() {
  const [entries, setEntries] = useState<SeaTimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generatingSamples, setGeneratingSamples] = useState(false);
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const styles = createStyles(isDark, insets.top);
  const notifiedEntriesRef = useRef<Set<string>>(new Set());
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const loadData = useCallback(async () => {
    try {
      console.log('[Confirmations] Loading pending entries');
      const pendingEntries = await seaTimeApi.getPendingEntries();
      setEntries(pendingEntries);
      console.log('[Confirmations] Loaded', pendingEntries.length, 'pending entries');
    } catch (error: any) {
      console.error('[Confirmations] Failed to load data:', error);
      Alert.alert('Error', 'Failed to load data: ' + error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const checkForNewEntries = useCallback(async () => {
    // Skip on web - notifications not supported
    if (Platform.OS === 'web') {
      console.log('[Confirmations] Skipping notification check on web');
      return;
    }

    try {
      console.log('[Confirmations] Checking for new entries to notify');
      const result = await seaTimeApi.getNewSeaTimeEntries();
      
      if (result.newEntries && result.newEntries.length > 0) {
        console.log('[Confirmations] Found', result.newEntries.length, 'new entries to notify');
        
        for (const entry of result.newEntries) {
          // Skip if we've already notified about this entry in this session
          if (notifiedEntriesRef.current.has(entry.id)) {
            console.log('[Confirmations] Skipping already notified entry:', entry.id);
            continue;
          }

          const vesselName = entry.vessel_name || 'Unknown Vessel';
          const durationHours = typeof entry.duration_hours === 'string' 
            ? parseFloat(entry.duration_hours) 
            : entry.duration_hours || 0;

          console.log('[Confirmations] Scheduling notification for entry:', {
            id: entry.id,
            vesselName,
            durationHours,
          });

          await scheduleSeaTimeNotification(vesselName, entry.id, durationHours);
          notifiedEntriesRef.current.add(entry.id);
        }

        // Reload data to show the new entries
        await loadData();
      } else {
        console.log('[Confirmations] No new entries to notify');
      }
    } catch (error) {
      console.error('[Confirmations] Failed to check for new entries:', error);
    }
  }, [loadData]);

  useEffect(() => {
    console.log('[Confirmations] Component mounted, loading data');
    loadData();

    // Set up polling for new entries every 30 seconds (only on native platforms)
    if (Platform.OS !== 'web') {
      console.log('[Confirmations] Setting up notification polling');
      pollIntervalRef.current = setInterval(checkForNewEntries, 30000);
    } else {
      console.log('[Confirmations] Skipping notification polling on web');
    }

    return () => {
      console.log('[Confirmations] Component unmounting, cleaning up polling');
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [loadData, checkForNewEntries]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleGenerateSamples = async () => {
    try {
      console.log('[Confirmations] User generating sample entries');
      setGeneratingSamples(true);
      const result = await seaTimeApi.generateSampleSeaTimeEntries();
      console.log('[Confirmations] Generated samples:', result);
      await loadData();
      Alert.alert(
        'Success',
        `Generated ${result.entries?.length || 3} sample sea time entries for review`,
        [{ text: 'OK' }]
      );
    } catch (error: any) {
      console.error('[Confirmations] Failed to generate samples:', error);
      Alert.alert('Error', 'Failed to generate sample entries: ' + error.message);
    } finally {
      setGeneratingSamples(false);
    }
  };

  const handleConfirmEntry = async (entryId: string) => {
    try {
      console.log('[Confirmations] User confirming entry:', entryId);
      await seaTimeApi.confirmSeaTimeEntry(entryId);
      await loadData();
      Alert.alert('Success', 'Sea time entry confirmed');
    } catch (error: any) {
      console.error('[Confirmations] Failed to confirm entry:', error);
      Alert.alert('Error', 'Failed to confirm entry: ' + error.message);
    }
  };

  const handleRejectEntry = async (entryId: string) => {
    Alert.alert(
      'Reject Entry',
      'Are you sure you want to reject this sea time entry?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('[Confirmations] User rejecting entry:', entryId);
              await seaTimeApi.rejectSeaTimeEntry(entryId);
              await loadData();
              Alert.alert('Success', 'Sea time entry rejected');
            } catch (error: any) {
              console.error('[Confirmations] Failed to reject entry:', error);
              Alert.alert('Error', 'Failed to reject entry: ' + error.message);
            }
          },
        },
      ]
    );
  };

  const toggleExpanded = (entryId: string) => {
    console.log('[Confirmations] Toggling expanded state for entry:', entryId);
    setExpandedEntries(prev => {
      const newSet = new Set(prev);
      if (newSet.has(entryId)) {
        newSet.delete(entryId);
      } else {
        newSet.add(entryId);
      }
      return newSet;
    });
  };

  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch (e) {
      console.error('[Confirmations] Failed to format date:', e);
      return dateString;
    }
  };

  const formatTime = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (e) {
      console.error('[Confirmations] Failed to format time:', e);
      return dateString;
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'confirmed':
        return colors.success;
      case 'rejected':
        return colors.error;
      case 'pending':
        return colors.warning;
      default:
        return colors.textSecondary;
    }
  };

  const toNumber = (value: number | string | null | undefined): number => {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'number') return value;
    const parsed = parseFloat(value);
    return isNaN(parsed) ? 0 : parsed;
  };

  const formatCoordinate = (value: number | string | null | undefined): string => {
    const num = toNumber(value);
    return num.toFixed(6);
  };

  const convertToDMS = (decimal: number, isLatitude: boolean): string => {
    const absolute = Math.abs(decimal);
    const degrees = Math.floor(absolute);
    const minutesDecimal = (absolute - degrees) * 60;
    const minutes = Math.floor(minutesDecimal);
    const seconds = ((minutesDecimal - minutes) * 60).toFixed(1);
    
    let direction = '';
    if (isLatitude) {
      direction = decimal >= 0 ? 'N' : 'S';
    } else {
      direction = decimal >= 0 ? 'E' : 'W';
    }
    
    return `${degrees}° ${minutes}' ${seconds}" ${direction}`;
  };

  const formatCoordinateDMS = (
    lat: number | string | null | undefined,
    lon: number | string | null | undefined
  ): string => {
    const latNum = toNumber(lat);
    const lonNum = toNumber(lon);
    
    if (latNum === 0 && lonNum === 0) return 'No coordinates';
    
    return `${convertToDMS(latNum, true)}, ${convertToDMS(lonNum, false)}`;
  };

  const formatDuration = (hours: number | string | null | undefined): string => {
    const num = toNumber(hours);
    return `${num.toFixed(1)} hours`;
  };

  const formatDays = (hours: number | string | null | undefined): string => {
    const num = toNumber(hours);
    const days = num / 24;
    return `${days.toFixed(2)} days`;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Header with Logo */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <Image
              source={require('@/assets/images/c13cbd51-c2f7-489f-bbbb-6b28094d9b2b.png')}
              style={styles.appIcon}
              resizeMode="contain"
            />
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>Review Sea Time</Text>
              <Text style={styles.headerSubtitle}>
                {entries.length} {entries.length === 1 ? 'entry' : 'entries'} pending confirmation
              </Text>
            </View>
          </View>
        </View>

        {/* Entries List */}
        <View style={styles.content}>
          {entries.length === 0 ? (
            <View style={styles.emptyState}>
              <IconSymbol
                ios_icon_name="checkmark.circle"
                android_material_icon_name="check-circle"
                size={64}
                color={isDark ? colors.textSecondary : colors.textSecondaryLight}
              />
              <Text style={styles.emptyText}>All caught up!</Text>
              <Text style={styles.emptySubtext}>
                No pending sea time entries to review
              </Text>
              
              {/* Generate Samples Button */}
              <TouchableOpacity
                style={styles.generateButton}
                onPress={handleGenerateSamples}
                disabled={generatingSamples}
              >
                {generatingSamples ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <React.Fragment>
                    <IconSymbol
                      ios_icon_name="plus.circle"
                      android_material_icon_name="add-circle"
                      size={20}
                      color="#fff"
                    />
                    <Text style={styles.generateButtonText}>Generate Sample Entries</Text>
                  </React.Fragment>
                )}
              </TouchableOpacity>
              <Text style={styles.generateHint}>
                Create 3 sample sea time entries for testing
              </Text>
            </View>
          ) : (
            entries.map((entry) => {
              const isExpanded = expandedEntries.has(entry.id);
              return (
                <View key={entry.id} style={styles.entryCard}>
                  <TouchableOpacity
                    style={styles.entryHeader}
                    onPress={() => toggleExpanded(entry.id)}
                  >
                    <View style={styles.entryHeaderLeft}>
                      <Text style={styles.vesselName}>
                        {entry.vessel?.vessel_name || 'Unknown Vessel'}
                      </Text>
                      <Text style={styles.entryDate}>
                        {formatDate(entry.start_time)} at {formatTime(entry.start_time)}
                      </Text>
                      <View style={styles.durationBadge}>
                        <Text style={styles.durationText}>
                          {formatDuration(entry.duration_hours)} ({formatDays(entry.duration_hours)})
                        </Text>
                      </View>
                    </View>
                    <IconSymbol
                      ios_icon_name={isExpanded ? 'chevron.up' : 'chevron.down'}
                      android_material_icon_name={isExpanded ? 'expand-less' : 'expand-more'}
                      size={24}
                      color={isDark ? colors.textSecondary : colors.textSecondaryLight}
                    />
                  </TouchableOpacity>

                  {isExpanded && (
                    <View style={styles.entryDetails}>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Start:</Text>
                        <Text style={styles.detailValue}>
                          {formatDate(entry.start_time)} {formatTime(entry.start_time)}
                        </Text>
                      </View>
                      {entry.end_time && (
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>End:</Text>
                          <Text style={styles.detailValue}>
                            {formatDate(entry.end_time)} {formatTime(entry.end_time)}
                          </Text>
                        </View>
                      )}
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Duration:</Text>
                        <Text style={styles.detailValue}>
                          {formatDuration(entry.duration_hours)} ({formatDays(entry.duration_hours)})
                        </Text>
                      </View>
                      {(entry.start_latitude || entry.start_longitude) && (
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Start Position:</Text>
                          <Text style={styles.detailValue}>
                            {formatCoordinateDMS(entry.start_latitude, entry.start_longitude)}
                          </Text>
                        </View>
                      )}
                      {(entry.end_latitude || entry.end_longitude) && (
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>End Position:</Text>
                          <Text style={styles.detailValue}>
                            {formatCoordinateDMS(entry.end_latitude, entry.end_longitude)}
                          </Text>
                        </View>
                      )}
                      {entry.notes && (
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Notes:</Text>
                          <Text style={styles.detailValue}>{entry.notes}</Text>
                        </View>
                      )}
                    </View>
                  )}

                  <View style={styles.entryActions}>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.confirmButton]}
                      onPress={() => handleConfirmEntry(entry.id)}
                    >
                      <IconSymbol
                        ios_icon_name="checkmark"
                        android_material_icon_name="check"
                        size={20}
                        color="#fff"
                      />
                      <Text style={styles.actionButtonText}>Confirm</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.rejectButton]}
                      onPress={() => handleRejectEntry(entry.id)}
                    >
                      <IconSymbol
                        ios_icon_name="xmark"
                        android_material_icon_name="close"
                        size={20}
                        color="#fff"
                      />
                      <Text style={styles.actionButtonText}>Reject</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function createStyles(isDark: boolean, topInset: number) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? colors.background : colors.backgroundLight,
    },
    scrollView: {
      flex: 1,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: isDark ? colors.background : colors.backgroundLight,
      gap: 12,
    },
    loadingText: {
      fontSize: 16,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
    },
    header: {
      padding: 20,
      paddingTop: topInset + 20,
      backgroundColor: isDark ? colors.cardBackground : colors.card,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? colors.border : colors.borderLight,
    },
    headerContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    appIcon: {
      width: 53,
      height: 53,
      borderRadius: 12,
    },
    headerTextContainer: {
      flex: 1,
    },
    headerTitle: {
      fontSize: 28,
      fontWeight: 'bold',
      color: isDark ? colors.text : colors.textLight,
    },
    headerSubtitle: {
      fontSize: 14,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
      marginTop: 4,
    },
    content: {
      padding: 16,
    },
    emptyState: {
      alignItems: 'center',
      padding: 40,
      marginTop: 60,
    },
    emptyText: {
      fontSize: 20,
      fontWeight: 'bold',
      color: isDark ? colors.text : colors.textLight,
      marginTop: 16,
    },
    emptySubtext: {
      fontSize: 14,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
      marginTop: 8,
      textAlign: 'center',
    },
    generateButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      paddingHorizontal: 24,
      paddingVertical: 14,
      borderRadius: 10,
      marginTop: 24,
      gap: 8,
      minWidth: 200,
    },
    generateButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
    },
    generateHint: {
      fontSize: 12,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
      marginTop: 12,
      textAlign: 'center',
    },
    entryCard: {
      backgroundColor: isDark ? colors.cardBackground : colors.card,
      borderRadius: 12,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: isDark ? colors.border : colors.borderLight,
      overflow: 'hidden',
    },
    entryHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
    },
    entryHeaderLeft: {
      flex: 1,
    },
    vesselName: {
      fontSize: 18,
      fontWeight: 'bold',
      color: isDark ? colors.text : colors.textLight,
      marginBottom: 4,
    },
    entryDate: {
      fontSize: 14,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
      marginBottom: 8,
    },
    durationBadge: {
      backgroundColor: colors.primary + '20',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 6,
      alignSelf: 'flex-start',
    },
    durationText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.primary,
    },
    entryDetails: {
      paddingHorizontal: 16,
      paddingBottom: 16,
      borderTopWidth: 1,
      borderTopColor: isDark ? colors.border : colors.borderLight,
    },
    detailRow: {
      flexDirection: 'row',
      marginTop: 12,
    },
    detailLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: isDark ? colors.text : colors.textLight,
      width: 120,
    },
    detailValue: {
      fontSize: 14,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
      flex: 1,
    },
    entryActions: {
      flexDirection: 'row',
      gap: 12,
      padding: 16,
      borderTopWidth: 1,
      borderTopColor: isDark ? colors.border : colors.borderLight,
    },
    actionButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 12,
      borderRadius: 8,
      gap: 8,
    },
    confirmButton: {
      backgroundColor: colors.success,
    },
    rejectButton: {
      backgroundColor: colors.error,
    },
    actionButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
    },
  });
}

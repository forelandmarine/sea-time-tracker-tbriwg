
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
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
import React, { useState, useEffect } from 'react';
import * as seaTimeApi from '@/utils/seaTimeApi';
import { useRouter } from 'expo-router';

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
  const router = useRouter();
  const [pendingEntries, setPendingEntries] = useState<SeaTimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const styles = createStyles(isDark);

  useEffect(() => {
    console.log('[ConfirmationsScreen] Loading pending entries');
    loadData();
  }, []);

  const loadData = async () => {
    try {
      console.log('[ConfirmationsScreen] Fetching pending entries from API...');
      const entriesData = await seaTimeApi.getPendingEntries();
      console.log('[ConfirmationsScreen] Raw pending entries data:', JSON.stringify(entriesData, null, 2));
      
      // Log each entry's coordinates and duration
      entriesData.forEach((entry: SeaTimeEntry, index: number) => {
        console.log(`[ConfirmationsScreen] Entry ${index} (${entry.id}):`, {
          duration_hours: entry.duration_hours,
          duration_type: typeof entry.duration_hours,
          start_latitude: entry.start_latitude,
          start_latitude_type: typeof entry.start_latitude,
          start_longitude: entry.start_longitude,
          end_latitude: entry.end_latitude,
          end_longitude: entry.end_longitude,
        });
      });
      
      setPendingEntries(entriesData);
      console.log('[ConfirmationsScreen] Pending entries loaded:', entriesData.length);
    } catch (error: any) {
      console.error('[ConfirmationsScreen] Failed to load pending entries:', error);
      Alert.alert('Error', 'Failed to load pending entries: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    console.log('[ConfirmationsScreen] User refreshing pending entries');
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleConfirmEntry = async (entryId: string) => {
    Alert.alert(
      'Confirm Sea Time',
      'Confirm this sea time entry?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              console.log('[ConfirmationsScreen] User confirming entry:', entryId);
              await seaTimeApi.confirmSeaTimeEntry(entryId);
              await loadData();
              Alert.alert('Success', 'Sea time entry confirmed');
            } catch (error: any) {
              console.error('[ConfirmationsScreen] Failed to confirm entry:', error);
              Alert.alert('Error', 'Failed to confirm entry: ' + error.message);
            }
          },
        },
      ]
    );
  };

  const handleRejectEntry = async (entryId: string) => {
    Alert.alert(
      'Reject Sea Time',
      'Reject this sea time entry?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('[ConfirmationsScreen] User rejecting entry:', entryId);
              await seaTimeApi.rejectSeaTimeEntry(entryId);
              await loadData();
              Alert.alert('Success', 'Sea time entry rejected');
            } catch (error: any) {
              console.error('[ConfirmationsScreen] Failed to reject entry:', error);
              Alert.alert('Error', 'Failed to reject entry: ' + error.message);
            }
          },
        },
      ]
    );
  };

  const toggleExpanded = (entryId: string) => {
    console.log('[ConfirmationsScreen] User toggling expanded view for entry:', entryId);
    setExpandedEntryId(expandedEntryId === entryId ? null : entryId);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return colors.success;
      case 'rejected':
        return colors.error;
      case 'pending':
        return colors.warning;
      default:
        return isDark ? colors.textSecondary : colors.textSecondaryLight;
    }
  };

  // Helper to convert string or number to number
  const toNumber = (value: number | string | null | undefined): number | null => {
    if (value === null || value === undefined) {
      return null;
    }
    if (typeof value === 'number') {
      return isNaN(value) ? null : value;
    }
    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      return isNaN(parsed) ? null : parsed;
    }
    return null;
  };

  const formatCoordinate = (value: number | string | null | undefined): string => {
    const num = toNumber(value);
    if (num !== null) {
      return num.toFixed(6);
    }
    return 'N/A';
  };

  const convertToDMS = (decimal: number, isLatitude: boolean): string => {
    const absolute = Math.abs(decimal);
    const degrees = Math.floor(absolute);
    const minutesDecimal = (absolute - degrees) * 60;
    const minutes = Math.floor(minutesDecimal);
    const seconds = ((minutesDecimal - minutes) * 60).toFixed(2);
    
    let direction = '';
    if (isLatitude) {
      direction = decimal >= 0 ? 'N' : 'S';
    } else {
      direction = decimal >= 0 ? 'E' : 'W';
    }
    
    return `${degrees}° ${minutes}' ${seconds}" ${direction}`;
  };

  const formatCoordinateDMS = (lat: number | string | null | undefined, lon: number | string | null | undefined): { lat: string; lon: string } => {
    const latNum = toNumber(lat);
    const lonNum = toNumber(lon);
    
    if (latNum !== null && lonNum !== null) {
      return {
        lat: convertToDMS(latNum, true),
        lon: convertToDMS(lonNum, false),
      };
    }
    return { lat: 'N/A', lon: 'N/A' };
  };

  const formatDuration = (hours: number | string | null | undefined): string => {
    const num = toNumber(hours);
    if (num !== null) {
      return num.toFixed(1);
    }
    return '0.0';
  };

  const formatDays = (hours: number | string | null | undefined): string => {
    const num = toNumber(hours);
    if (num !== null) {
      return (num / 24).toFixed(2);
    }
    return '0.00';
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Review</Text>
        <Text style={styles.headerSubtitle}>
          Confirm your sea time entries
        </Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {pendingEntries.length === 0 ? (
          <View style={styles.emptyState}>
            <IconSymbol
              ios_icon_name="checkmark.circle"
              android_material_icon_name="check-circle"
              size={64}
              color={isDark ? colors.textSecondary : colors.textSecondaryLight}
            />
            <Text style={styles.emptyText}>No Pending Confirmations</Text>
            <Text style={styles.emptySubtext}>
              All sea time entries have been reviewed
            </Text>
          </View>
        ) : (
          <View style={styles.entriesContainer}>
            {pendingEntries.map((entry, index) => {
              const vesselName = entry.vessel?.vessel_name || 'Unknown Vessel';
              const vesselMmsi = entry.vessel?.mmsi || 'N/A';
              const hasVesselData = !!entry.vessel;
              const isExpanded = expandedEntryId === entry.id;

              if (!hasVesselData) {
                console.warn('[ConfirmationsScreen] Entry missing vessel data:', entry.id);
              }

              // Convert to numbers for validation
              const startLat = toNumber(entry.start_latitude);
              const startLon = toNumber(entry.start_longitude);
              const endLat = toNumber(entry.end_latitude);
              const endLon = toNumber(entry.end_longitude);
              const durationHours = toNumber(entry.duration_hours);

              const hasStartCoords = startLat !== null && startLon !== null;
              const hasEndCoords = endLat !== null && endLon !== null;
              const hasAnyCoords = hasStartCoords || hasEndCoords;
              const hasDuration = durationHours !== null;

              console.log(`[ConfirmationsScreen] Rendering entry ${entry.id}:`, {
                hasStartCoords,
                hasEndCoords,
                hasDuration,
                duration_hours: entry.duration_hours,
                start_latitude: entry.start_latitude,
                start_longitude: entry.start_longitude,
                end_latitude: entry.end_latitude,
                end_longitude: entry.end_longitude,
              });

              const startDMS = formatCoordinateDMS(entry.start_latitude, entry.start_longitude);
              const endDMS = formatCoordinateDMS(entry.end_latitude, entry.end_longitude);

              return (
                <React.Fragment key={index}>
                  <View style={styles.entryCard}>
                    {/* Tappable area for expansion */}
                    <TouchableOpacity 
                      onPress={() => toggleExpanded(entry.id)}
                      activeOpacity={0.7}
                    >
                      {!hasVesselData && (
                        <View style={styles.warningBanner}>
                          <IconSymbol
                            ios_icon_name="exclamationmark.triangle.fill"
                            android_material_icon_name="warning"
                            size={16}
                            color={colors.warning}
                          />
                          <Text style={styles.warningText}>
                            Vessel information unavailable
                          </Text>
                        </View>
                      )}

                      {/* Vessel Name Header */}
                      <View style={styles.entryHeader}>
                        <View style={styles.vesselInfo}>
                          <IconSymbol
                            ios_icon_name="ferry"
                            android_material_icon_name="directions-boat"
                            size={24}
                            color={colors.primary}
                          />
                          <View style={styles.vesselTextInfo}>
                            <Text style={styles.vesselName}>{vesselName}</Text>
                            <Text style={styles.vesselMmsi}>MMSI: {vesselMmsi}</Text>
                          </View>
                        </View>
                        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(entry.status) + '20' }]}>
                          <Text style={[styles.statusText, { color: getStatusColor(entry.status) }]}>
                            {entry.status.toUpperCase()}
                          </Text>
                        </View>
                      </View>

                      {/* Time Information */}
                      <View style={styles.timeSection}>
                        <View style={styles.timeRow}>
                          <View style={styles.timeLabel}>
                            <IconSymbol
                              ios_icon_name="clock"
                              android_material_icon_name="schedule"
                              size={16}
                              color={isDark ? colors.textSecondary : colors.textSecondaryLight}
                            />
                            <Text style={styles.timeLabelText}>Start</Text>
                          </View>
                          <View style={styles.timeValue}>
                            <Text style={styles.timeDate}>{formatDate(entry.start_time)}</Text>
                            <Text style={styles.timeTime}>{formatTime(entry.start_time)}</Text>
                          </View>
                        </View>

                        {entry.end_time && (
                          <View style={styles.timeRow}>
                            <View style={styles.timeLabel}>
                              <IconSymbol
                                ios_icon_name="clock.fill"
                                android_material_icon_name="schedule"
                                size={16}
                                color={isDark ? colors.textSecondary : colors.textSecondaryLight}
                              />
                              <Text style={styles.timeLabelText}>End</Text>
                            </View>
                            <View style={styles.timeValue}>
                              <Text style={styles.timeDate}>{formatDate(entry.end_time)}</Text>
                              <Text style={styles.timeTime}>{formatTime(entry.end_time)}</Text>
                            </View>
                          </View>
                        )}
                      </View>

                      {/* GPS Coordinates Section */}
                      {hasAnyCoords && (
                        <View style={styles.coordinatesSection}>
                          <View style={styles.coordinatesHeader}>
                            <IconSymbol
                              ios_icon_name="location.fill"
                              android_material_icon_name="location-on"
                              size={16}
                              color={colors.primary}
                            />
                            <Text style={styles.coordinatesHeaderText}>GPS Coordinates</Text>
                            <IconSymbol
                              ios_icon_name={isExpanded ? "chevron.up" : "chevron.down"}
                              android_material_icon_name={isExpanded ? "expand-less" : "expand-more"}
                              size={16}
                              color={colors.primary}
                            />
                          </View>
                          
                          {hasStartCoords && (
                            <View style={styles.coordinateRow}>
                              <Text style={styles.coordinateLabel}>Start Position:</Text>
                              <Text style={styles.coordinateValue}>
                                {formatCoordinate(entry.start_latitude)}°, {formatCoordinate(entry.start_longitude)}°
                              </Text>
                            </View>
                          )}
                          
                          {hasEndCoords && (
                            <View style={styles.coordinateRow}>
                              <Text style={styles.coordinateLabel}>End Position:</Text>
                              <Text style={styles.coordinateValue}>
                                {formatCoordinate(entry.end_latitude)}°, {formatCoordinate(entry.end_longitude)}°
                              </Text>
                            </View>
                          )}
                        </View>
                      )}

                      {/* Duration - Always show, even if 0 */}
                      <View style={styles.durationSection}>
                        <View style={styles.durationCard}>
                          <IconSymbol
                            ios_icon_name="timer"
                            android_material_icon_name="access-time"
                            size={20}
                            color={colors.primary}
                          />
                          <View style={styles.durationInfo}>
                            <Text style={styles.durationLabel}>Total Duration</Text>
                            <Text style={styles.durationValue}>
                              {formatDuration(entry.duration_hours)} hours
                            </Text>
                            <Text style={styles.durationDays}>
                              ({formatDays(entry.duration_hours)} days)
                            </Text>
                          </View>
                        </View>
                      </View>

                      {/* Notes */}
                      {entry.notes && (
                        <View style={styles.notesSection}>
                          <Text style={styles.notesLabel}>Notes:</Text>
                          <Text style={styles.notesText}>{entry.notes}</Text>
                        </View>
                      )}
                    </TouchableOpacity>

                    {/* Expanded DMS Coordinates Section */}
                    {isExpanded && hasAnyCoords && (
                      <View style={styles.dmsSection}>
                        <View style={styles.dmsSectionHeader}>
                          <IconSymbol
                            ios_icon_name="map.fill"
                            android_material_icon_name="map"
                            size={16}
                            color={colors.success}
                          />
                          <Text style={styles.dmsSectionHeaderText}>
                            Degrees, Minutes, Seconds
                          </Text>
                        </View>
                        
                        {hasStartCoords && (
                          <View style={styles.dmsBlock}>
                            <Text style={styles.dmsBlockTitle}>Start Position</Text>
                            <View style={styles.dmsRow}>
                              <Text style={styles.dmsLabel}>Latitude:</Text>
                              <Text style={styles.dmsValue}>{startDMS.lat}</Text>
                            </View>
                            <View style={styles.dmsRow}>
                              <Text style={styles.dmsLabel}>Longitude:</Text>
                              <Text style={styles.dmsValue}>{startDMS.lon}</Text>
                            </View>
                          </View>
                        )}
                        
                        {hasEndCoords && (
                          <View style={styles.dmsBlock}>
                            <Text style={styles.dmsBlockTitle}>End Position</Text>
                            <View style={styles.dmsRow}>
                              <Text style={styles.dmsLabel}>Latitude:</Text>
                              <Text style={styles.dmsValue}>{endDMS.lat}</Text>
                            </View>
                            <View style={styles.dmsRow}>
                              <Text style={styles.dmsLabel}>Longitude:</Text>
                              <Text style={styles.dmsValue}>{endDMS.lon}</Text>
                            </View>
                          </View>
                        )}
                      </View>
                    )}

                    {/* Action Buttons - Outside the TouchableOpacity */}
                    <View style={styles.actionButtons}>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.confirmButton]}
                        onPress={() => handleConfirmEntry(entry.id)}
                      >
                        <IconSymbol
                          ios_icon_name="checkmark.circle.fill"
                          android_material_icon_name="check-circle"
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
                          ios_icon_name="xmark.circle.fill"
                          android_material_icon_name="cancel"
                          size={20}
                          color="#fff"
                        />
                        <Text style={styles.actionButtonText}>Reject</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </React.Fragment>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function createStyles(isDark: boolean) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? colors.background : colors.backgroundLight,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: isDark ? colors.background : colors.backgroundLight,
    },
    loadingText: {
      fontSize: 16,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
    },
    header: {
      padding: 20,
      paddingTop: Platform.OS === 'android' ? 48 : 20,
      backgroundColor: isDark ? colors.cardBackground : colors.card,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? colors.border : colors.borderLight,
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
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: 16,
      paddingBottom: 100,
    },
    entriesContainer: {
      gap: 16,
    },
    entryCard: {
      backgroundColor: isDark ? colors.cardBackground : colors.card,
      borderRadius: 16,
      padding: 16,
      borderLeftWidth: 4,
      borderLeftColor: colors.warning,
      borderWidth: 1,
      borderColor: isDark ? colors.border : colors.borderLight,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    warningBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.warning + '20',
      borderRadius: 8,
      padding: 10,
      marginBottom: 12,
      gap: 8,
    },
    warningText: {
      fontSize: 13,
      color: colors.warning,
      fontWeight: '600',
    },
    entryHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    vesselInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 1,
    },
    vesselTextInfo: {
      flex: 1,
    },
    vesselName: {
      fontSize: 18,
      fontWeight: 'bold',
      color: isDark ? colors.text : colors.textLight,
    },
    vesselMmsi: {
      fontSize: 12,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
      marginTop: 2,
    },
    statusBadge: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 6,
    },
    statusText: {
      fontSize: 11,
      fontWeight: 'bold',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    timeSection: {
      backgroundColor: isDark ? colors.background : colors.backgroundLight,
      borderRadius: 12,
      padding: 12,
      marginBottom: 12,
      gap: 8,
    },
    timeRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    timeLabel: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    timeLabelText: {
      fontSize: 14,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
      fontWeight: '500',
    },
    timeValue: {
      alignItems: 'flex-end',
    },
    timeDate: {
      fontSize: 14,
      fontWeight: '600',
      color: isDark ? colors.text : colors.textLight,
    },
    timeTime: {
      fontSize: 12,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
      marginTop: 2,
    },
    coordinatesSection: {
      backgroundColor: isDark ? 'rgba(0, 122, 255, 0.1)' : 'rgba(0, 122, 255, 0.05)',
      borderRadius: 12,
      padding: 12,
      marginBottom: 12,
      borderLeftWidth: 3,
      borderLeftColor: colors.primary,
    },
    coordinatesHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 8,
    },
    coordinatesHeaderText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.primary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      flex: 1,
    },
    coordinateRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 4,
    },
    coordinateLabel: {
      fontSize: 13,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
      fontWeight: '500',
    },
    coordinateValue: {
      fontSize: 13,
      fontWeight: '600',
      color: isDark ? colors.text : colors.textLight,
      fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    },
    dmsSection: {
      backgroundColor: isDark ? 'rgba(76, 175, 80, 0.1)' : 'rgba(76, 175, 80, 0.05)',
      borderRadius: 12,
      padding: 14,
      marginBottom: 12,
      borderLeftWidth: 3,
      borderLeftColor: colors.success,
    },
    dmsSectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 12,
    },
    dmsSectionHeaderText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.success,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    dmsBlock: {
      backgroundColor: isDark ? colors.background : colors.backgroundLight,
      borderRadius: 8,
      padding: 10,
      marginBottom: 8,
    },
    dmsBlockTitle: {
      fontSize: 11,
      fontWeight: '700',
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 6,
    },
    dmsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 3,
    },
    dmsLabel: {
      fontSize: 13,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
      fontWeight: '500',
    },
    dmsValue: {
      fontSize: 14,
      fontWeight: '700',
      color: isDark ? colors.text : colors.textLight,
      fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    },
    durationSection: {
      marginBottom: 12,
    },
    durationCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.primary + '10',
      borderRadius: 12,
      padding: 12,
      gap: 12,
    },
    durationInfo: {
      flex: 1,
    },
    durationLabel: {
      fontSize: 12,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
      marginBottom: 2,
    },
    durationValue: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.primary,
    },
    durationDays: {
      fontSize: 12,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
      marginTop: 2,
    },
    notesSection: {
      backgroundColor: isDark ? colors.background : colors.backgroundLight,
      borderRadius: 12,
      padding: 12,
      marginBottom: 12,
    },
    notesLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
      marginBottom: 4,
    },
    notesText: {
      fontSize: 14,
      color: isDark ? colors.text : colors.textLight,
      lineHeight: 20,
    },
    actionButtons: {
      flexDirection: 'row',
      gap: 10,
    },
    actionButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 14,
      borderRadius: 10,
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
      fontWeight: 'bold',
      fontSize: 15,
    },
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 80,
      paddingHorizontal: 40,
    },
    emptyText: {
      fontSize: 20,
      fontWeight: 'bold',
      color: isDark ? colors.text : colors.textLight,
      marginTop: 16,
      textAlign: 'center',
    },
    emptySubtext: {
      fontSize: 14,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
      marginTop: 8,
      textAlign: 'center',
    },
  });
}

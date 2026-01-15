
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
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import * as seaTimeApi from '@/utils/seaTimeApi';
import { useRouter } from 'expo-router';
import { Calendar } from 'react-native-calendars';
import { getRequirementTitles } from '@/constants/mcaRequirements';

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

type ViewMode = 'list' | 'calendar';
type ServiceType = 'seagoing' | 'standby' | 'yard';

const createStyles = (isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? colors.background : colors.backgroundLight,
    },
    header: {
      padding: 20,
      paddingTop: Platform.OS === 'android' ? 48 : 20,
      backgroundColor: isDark ? colors.cardBackground : colors.card,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? colors.border : colors.borderLight,
    },
    headerTitleContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 16,
    },
    appIcon: {
      width: 53,
      height: 53,
      borderRadius: 12,
    },
    headerTextContainer: {
      flex: 1,
      minWidth: 0,
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
    headerControls: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    addButton: {
      backgroundColor: colors.primary,
      width: 44,
      height: 44,
      borderRadius: 22,
      justifyContent: 'center',
      alignItems: 'center',
    },
    viewToggle: {
      flexDirection: 'row',
      backgroundColor: isDark ? colors.background : colors.backgroundLight,
      borderRadius: 12,
      padding: 4,
      flex: 1,
      marginRight: 12,
    },
    toggleButton: {
      flex: 1,
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 8,
      alignItems: 'center',
    },
    toggleButtonActive: {
      backgroundColor: colors.primary,
    },
    toggleText: {
      fontSize: 14,
      fontWeight: '600',
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
    },
    toggleTextActive: {
      color: '#FFFFFF',
    },
    scrollContent: {
      paddingHorizontal: 20,
      paddingTop: 16,
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
    calendarContainer: {
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 20,
    },
    calendarCard: {
      backgroundColor: isDark ? colors.cardBackground : colors.cardBackgroundLight,
      borderRadius: 16,
      padding: 16,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContent: {
      backgroundColor: isDark ? colors.cardBackground : colors.cardBackgroundLight,
      borderRadius: 20,
      padding: 24,
      width: '90%',
      maxWidth: 400,
      maxHeight: '80%',
    },
    modalTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      color: isDark ? colors.text : colors.textLight,
      marginBottom: 20,
    },
    inputLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: isDark ? colors.text : colors.textLight,
      marginBottom: 8,
      marginTop: 12,
    },
    input: {
      backgroundColor: isDark ? colors.background : colors.backgroundLight,
      borderRadius: 12,
      padding: 12,
      fontSize: 16,
      color: isDark ? colors.text : colors.textLight,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
    },
    pickerButton: {
      backgroundColor: isDark ? colors.background : colors.backgroundLight,
      borderRadius: 12,
      padding: 12,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
    },
    pickerButtonText: {
      fontSize: 16,
      color: isDark ? colors.text : colors.textLight,
    },
    modalButtons: {
      flexDirection: 'row',
      marginTop: 24,
      gap: 12,
    },
    modalButton: {
      flex: 1,
      padding: 14,
      borderRadius: 12,
      alignItems: 'center',
    },
    cancelButton: {
      backgroundColor: isDark ? colors.background : colors.backgroundLight,
    },
    saveButton: {
      backgroundColor: colors.primary,
    },
    modalButtonText: {
      fontSize: 16,
      fontWeight: '600',
    },
    cancelButtonText: {
      color: isDark ? colors.text : colors.textLight,
    },
    saveButtonText: {
      color: '#FFFFFF',
    },
    vesselOption: {
      padding: 12,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
    },
    vesselOptionText: {
      fontSize: 16,
      color: isDark ? colors.text : colors.textLight,
    },
    mcaButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? colors.background : colors.backgroundLight,
      borderRadius: 12,
      padding: 12,
      marginTop: 12,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    mcaButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.primary,
      marginLeft: 8,
    },
    serviceTypeContainer: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 8,
    },
    serviceTypeButton: {
      flex: 1,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)',
      alignItems: 'center',
    },
    serviceTypeButtonActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    serviceTypeText: {
      fontSize: 13,
      fontWeight: '600',
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
    },
    serviceTypeTextActive: {
      color: '#FFFFFF',
    },
    helperText: {
      fontSize: 12,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
      marginTop: 4,
      fontStyle: 'italic',
    },
  });

export default function LogbookScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const styles = createStyles(isDark);
  const router = useRouter();

  const [entries, setEntries] = useState<SeaTimeEntry[]>([]);
  const [vessels, setVessels] = useState<Vessel[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showVesselPicker, setShowVesselPicker] = useState(false);

  // Form state
  const [selectedVessel, setSelectedVessel] = useState<Vessel | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');
  const [serviceType, setServiceType] = useState<ServiceType>('seagoing');

  useEffect(() => {
    console.log('[LogbookScreen] Component mounted, loading data');
    loadData();
  }, []);

  const loadData = async () => {
    try {
      console.log('[LogbookScreen] Fetching sea time entries and vessels');
      const [entriesData, vesselsData] = await Promise.all([
        seaTimeApi.getSeaTimeEntries(),
        seaTimeApi.getVessels(),
      ]);
      console.log('[LogbookScreen] Received entries:', entriesData.length, 'vessels:', vesselsData.length);
      setEntries(entriesData);
      setVessels(vesselsData);
    } catch (error) {
      console.error('[LogbookScreen] Error loading data:', error);
      Alert.alert('Error', 'Failed to load logbook data');
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

  const handleAddEntry = () => {
    console.log('[LogbookScreen] User tapped Add Entry button');
    setShowAddModal(true);
  };

  const handleViewMCARequirements = () => {
    console.log('[LogbookScreen] User tapped View MCA Requirements from modal');
    router.push('/mca-requirements');
  };

  const handleSaveEntry = async () => {
    console.log('[LogbookScreen] User tapped Save Entry');
    
    if (!selectedVessel) {
      Alert.alert('Error', 'Please select a vessel');
      return;
    }
    
    if (!startDate) {
      Alert.alert('Error', 'Please enter a start date and time');
      return;
    }

    try {
      const startDateTime = new Date(startDate);
      const endDateTime = endDate ? new Date(endDate) : null;

      if (endDateTime && endDateTime <= startDateTime) {
        Alert.alert('Error', 'End date must be after start date');
        return;
      }

      const serviceTypeNote = `Service Type: ${serviceType.charAt(0).toUpperCase() + serviceType.slice(1)}`;
      const fullNotes = notes ? `${serviceTypeNote}\n${notes}` : serviceTypeNote;

      console.log('[LogbookScreen] Creating manual sea time entry:', {
        vessel_id: selectedVessel.id,
        start_time: startDateTime.toISOString(),
        end_time: endDateTime?.toISOString() || null,
        notes: fullNotes,
        service_type: serviceType,
      });

      await seaTimeApi.createManualSeaTimeEntry({
        vessel_id: selectedVessel.id,
        start_time: startDateTime.toISOString(),
        end_time: endDateTime?.toISOString() || null,
        notes: fullNotes,
      });

      Alert.alert('Success', 'Sea time entry added successfully');
      setShowAddModal(false);
      setSelectedVessel(null);
      setStartDate('');
      setEndDate('');
      setNotes('');
      setServiceType('seagoing');
      loadData();
    } catch (error: any) {
      console.error('[LogbookScreen] Error creating entry:', error);
      Alert.alert('Error', error.message || 'Failed to create sea time entry');
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

  const getMarkedDates = () => {
    const marked: any = {};
    entries
      .filter((e) => e.status === 'confirmed')
      .forEach((entry) => {
        const startDate = new Date(entry.start_time);
        const endDate = entry.end_time ? new Date(entry.end_time) : new Date();
        
        let currentDate = new Date(startDate);
        while (currentDate <= endDate) {
          const dateString = currentDate.toISOString().split('T')[0];
          marked[dateString] = {
            marked: true,
            dotColor: colors.primary,
            selected: true,
            selectedColor: colors.primary + '40',
          };
          currentDate.setDate(currentDate.getDate() + 1);
        }
      });
    return marked;
  };

  const confirmedEntries = entries
    .filter((e) => e.status === 'confirmed')
    .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());
  const pendingEntries = entries.filter((e) => e.status === 'pending');

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerTitleContainer}>
            <Image
              source={require('@/assets/images/c13cbd51-c2f7-489f-bbbb-6b28094d9b2b.png')}
              style={styles.appIcon}
              resizeMode="contain"
            />
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle} numberOfLines={1} ellipsizeMode="tail">
                SeaTime Tracker
              </Text>
              <Text style={styles.headerSubtitle}>Loading your sea time records...</Text>
            </View>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleContainer}>
          <Image
            source={require('@/assets/images/c13cbd51-c2f7-489f-bbbb-6b28094d9b2b.png')}
            style={styles.appIcon}
            resizeMode="contain"
          />
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle} numberOfLines={1} ellipsizeMode="tail">
              SeaTime Tracker
            </Text>
            <Text style={styles.headerSubtitle}>Your Sea Time Logbook</Text>
          </View>
        </View>
        
        <View style={styles.headerControls}>
          <View style={styles.viewToggle}>
            <TouchableOpacity
              style={[styles.toggleButton, viewMode === 'list' && styles.toggleButtonActive]}
              onPress={() => {
                console.log('[LogbookScreen] Switching to list view');
                setViewMode('list');
              }}
            >
              <Text style={[styles.toggleText, viewMode === 'list' && styles.toggleTextActive]}>
                List
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleButton, viewMode === 'calendar' && styles.toggleButtonActive]}
              onPress={() => {
                console.log('[LogbookScreen] Switching to calendar view');
                setViewMode('calendar');
              }}
            >
              <Text style={[styles.toggleText, viewMode === 'calendar' && styles.toggleTextActive]}>
                Calendar
              </Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.addButton} onPress={handleAddEntry}>
            <IconSymbol
              ios_icon_name="plus"
              android_material_icon_name="add"
              size={24}
              color="#FFFFFF"
            />
          </TouchableOpacity>
        </View>
      </View>

      {viewMode === 'calendar' ? (
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.calendarContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
        >
          <View style={styles.calendarCard}>
            <Calendar
              markedDates={getMarkedDates()}
              theme={{
                backgroundColor: 'transparent',
                calendarBackground: 'transparent',
                textSectionTitleColor: isDark ? colors.textSecondary : colors.textSecondaryLight,
                selectedDayBackgroundColor: colors.primary,
                selectedDayTextColor: '#FFFFFF',
                todayTextColor: colors.primary,
                dayTextColor: isDark ? colors.text : colors.textLight,
                textDisabledColor: isDark ? colors.textSecondary : colors.textSecondaryLight,
                dotColor: colors.primary,
                selectedDotColor: '#FFFFFF',
                arrowColor: colors.primary,
                monthTextColor: isDark ? colors.text : colors.textLight,
                textMonthFontWeight: 'bold',
                textDayFontSize: 16,
                textMonthFontSize: 18,
              }}
            />
          </View>

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
        </ScrollView>
      ) : (
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
                Tap the + button to manually add a sea time entry, or start tracking vessels
              </Text>
            </View>
          ) : (
            <React.Fragment>
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

              {confirmedEntries.length > 0 && (
                <React.Fragment>
                  <Text style={styles.sectionTitle}>Sea Days (Most Recent First)</Text>
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
      )}

      {/* Add Entry Modal */}
      <Modal
        visible={showAddModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowAddModal(false)}
          >
            <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
              <ScrollView style={styles.modalContent}>
                <Text style={styles.modalTitle}>Add Sea Time Entry</Text>

                <TouchableOpacity style={styles.mcaButton} onPress={handleViewMCARequirements}>
                  <IconSymbol
                    ios_icon_name="info.circle"
                    android_material_icon_name="info"
                    size={20}
                    color={colors.primary}
                  />
                  <Text style={styles.mcaButtonText}>View MCA Requirements</Text>
                </TouchableOpacity>

                <Text style={styles.inputLabel}>Service Type *</Text>
                <View style={styles.serviceTypeContainer}>
                  <TouchableOpacity
                    style={[
                      styles.serviceTypeButton,
                      serviceType === 'seagoing' && styles.serviceTypeButtonActive,
                    ]}
                    onPress={() => setServiceType('seagoing')}
                  >
                    <Text
                      style={[
                        styles.serviceTypeText,
                        serviceType === 'seagoing' && styles.serviceTypeTextActive,
                      ]}
                    >
                      Seagoing
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.serviceTypeButton,
                      serviceType === 'standby' && styles.serviceTypeButtonActive,
                    ]}
                    onPress={() => setServiceType('standby')}
                  >
                    <Text
                      style={[
                        styles.serviceTypeText,
                        serviceType === 'standby' && styles.serviceTypeTextActive,
                      ]}
                    >
                      Standby
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.serviceTypeButton,
                      serviceType === 'yard' && styles.serviceTypeButtonActive,
                    ]}
                    onPress={() => setServiceType('yard')}
                  >
                    <Text
                      style={[
                        styles.serviceTypeText,
                        serviceType === 'yard' && styles.serviceTypeTextActive,
                      ]}
                    >
                      Yard
                    </Text>
                  </TouchableOpacity>
                </View>
                {serviceType === 'standby' && (
                  <Text style={styles.helperText}>
                    Max 14 consecutive days; cannot exceed previous voyage length
                  </Text>
                )}
                {serviceType === 'yard' && (
                  <Text style={styles.helperText}>Up to 90 days total (continuous or split)</Text>
                )}

                <Text style={styles.inputLabel}>Vessel *</Text>
                <TouchableOpacity
                  style={styles.pickerButton}
                  onPress={() => setShowVesselPicker(true)}
                >
                  <Text style={styles.pickerButtonText}>
                    {selectedVessel ? selectedVessel.vessel_name : 'Select a vessel'}
                  </Text>
                </TouchableOpacity>

                <Text style={styles.inputLabel}>Start Date & Time *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="YYYY-MM-DD HH:MM"
                  placeholderTextColor={isDark ? colors.textSecondary : colors.textSecondaryLight}
                  value={startDate}
                  onChangeText={setStartDate}
                />

                <Text style={styles.inputLabel}>End Date & Time (Optional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="YYYY-MM-DD HH:MM"
                  placeholderTextColor={isDark ? colors.textSecondary : colors.textSecondaryLight}
                  value={endDate}
                  onChangeText={setEndDate}
                />

                <Text style={styles.inputLabel}>Notes (Optional)</Text>
                <TextInput
                  style={[styles.input, { height: 80 }]}
                  placeholder="Add any notes about this sea time..."
                  placeholderTextColor={isDark ? colors.textSecondary : colors.textSecondaryLight}
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  numberOfLines={3}
                />

                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.cancelButton]}
                    onPress={() => {
                      console.log('[LogbookScreen] User cancelled add entry');
                      setShowAddModal(false);
                    }}
                  >
                    <Text style={[styles.modalButtonText, styles.cancelButtonText]}>
                      Cancel
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.saveButton]}
                    onPress={handleSaveEntry}
                  >
                    <Text style={[styles.modalButtonText, styles.saveButtonText]}>
                      Save
                    </Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {/* Vessel Picker Modal */}
      <Modal
        visible={showVesselPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowVesselPicker(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowVesselPicker(false)}
        >
          <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Select Vessel</Text>
              <ScrollView style={{ maxHeight: 300 }}>
                {vessels.map((vessel, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.vesselOption}
                    onPress={() => {
                      console.log('[LogbookScreen] User selected vessel:', vessel.vessel_name);
                      setSelectedVessel(vessel);
                      setShowVesselPicker(false);
                    }}
                  >
                    <Text style={styles.vesselOptionText}>{vessel.vessel_name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

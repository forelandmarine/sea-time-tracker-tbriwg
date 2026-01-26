
import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  FlatList,
} from 'react-native';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import * as seaTimeApi from '@/utils/seaTimeApi';
import { useRouter } from 'expo-router';
import { Calendar } from 'react-native-calendars';
import { getRequirementTitles } from '@/constants/mcaRequirements';
import DateTimePicker from '@react-native-community/datetimepicker';

interface Vessel {
  id: string;
  mmsi: string;
  vessel_name: string;
  is_active: boolean;
  created_at: string;
  callsign?: string;
  flag?: string;
  official_number?: string;
  vessel_type?: string;
  length_metres?: number;
  gross_tonnes?: number;
}

interface SeaTimeEntry {
  id: string;
  vessel: Vessel | null;
  start_time: string;
  end_time: string | null;
  duration_hours: number | string | null;
  sea_days: number | null;
  status: 'pending' | 'confirmed' | 'rejected';
  notes: string | null;
  created_at: string;
  start_latitude?: number | string | null;
  start_longitude?: number | string | null;
  end_latitude?: number | string | null;
  end_longitude?: number | string | null;
  service_type?: string | null;
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
    vesselGroupHeader: {
      backgroundColor: isDark ? colors.cardBackground : colors.cardBackgroundLight,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)',
    },
    vesselGroupTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: isDark ? colors.text : colors.textLight,
      marginBottom: 4,
    },
    vesselGroupCallsign: {
      fontSize: 13,
      color: colors.primary,
      fontWeight: '600',
      marginBottom: 8,
    },
    vesselGroupStats: {
      flexDirection: 'row',
      gap: 16,
    },
    vesselStat: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    vesselStatText: {
      fontSize: 13,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
    },
    vesselStatValue: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.primary,
    },
    entryCard: {
      backgroundColor: isDark ? colors.cardBackground : colors.cardBackgroundLight,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      marginLeft: 16,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
      borderLeftWidth: 4,
      borderLeftColor: colors.primary,
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
    seaDayBadge: {
      backgroundColor: colors.primary + '20',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      alignSelf: 'flex-start',
      marginTop: 8,
    },
    seaDayText: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.primary,
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
    calendarLegend: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 12,
      gap: 8,
    },
    legendDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.primary,
    },
    legendText: {
      fontSize: 13,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
    },
    selectedDateCard: {
      backgroundColor: isDark ? colors.cardBackground : colors.cardBackgroundLight,
      borderRadius: 16,
      padding: 20,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
    },
    selectedDateTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: isDark ? colors.text : colors.textLight,
      marginBottom: 16,
    },
    selectedDateEntry: {
      backgroundColor: isDark ? colors.background : colors.backgroundLight,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderLeftWidth: 4,
      borderLeftColor: colors.primary,
    },
    noEntriesText: {
      fontSize: 15,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
      textAlign: 'center',
      fontStyle: 'italic',
    },
    noDateSelectedContainer: {
      backgroundColor: isDark ? colors.cardBackground : colors.cardBackgroundLight,
      borderRadius: 16,
      padding: 32,
      alignItems: 'center',
      marginBottom: 20,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
    },
    noDateSelectedText: {
      fontSize: 16,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
      textAlign: 'center',
      marginTop: 12,
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
      maxWidth: 500,
      maxHeight: '85%',
    },
    modalScrollView: {
      maxHeight: 500,
    },
    modalScrollContent: {
      paddingBottom: 20,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 8,
    },
    modalTitleContainer: {
      flex: 1,
    },
    modalTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      color: isDark ? colors.text : colors.textLight,
    },
    deleteButton: {
      padding: 8,
      marginLeft: 12,
    },
    modalSubtitle: {
      fontSize: 14,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
      marginBottom: 20,
    },
    inputGroup: {
      marginBottom: 20,
    },
    inputLabel: {
      fontSize: 15,
      fontWeight: '600',
      color: isDark ? colors.text : colors.textLight,
      marginBottom: 8,
    },
    inputLabelOptional: {
      fontSize: 13,
      fontWeight: '400',
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
    },
    input: {
      backgroundColor: isDark ? colors.background : colors.backgroundLight,
      borderRadius: 12,
      padding: 14,
      fontSize: 16,
      color: isDark ? colors.text : colors.textLight,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
    },
    pickerButton: {
      backgroundColor: isDark ? colors.background : colors.backgroundLight,
      borderRadius: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    pickerButtonText: {
      fontSize: 16,
      color: isDark ? colors.text : colors.textLight,
    },
    pickerButtonPlaceholder: {
      fontSize: 16,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
    },
    dateTimeButton: {
      backgroundColor: isDark ? colors.background : colors.backgroundLight,
      borderRadius: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    dateTimeText: {
      fontSize: 16,
      color: isDark ? colors.text : colors.textLight,
    },
    dateTimePlaceholder: {
      fontSize: 16,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
    },
    modalButtons: {
      flexDirection: 'row',
      marginTop: 24,
      gap: 12,
    },
    modalButton: {
      flex: 1,
      padding: 16,
      borderRadius: 12,
      alignItems: 'center',
    },
    cancelButton: {
      backgroundColor: isDark ? colors.background : colors.backgroundLight,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)',
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
    vesselPickerContainer: {
      maxHeight: 200,
      marginTop: 8,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
      backgroundColor: isDark ? colors.background : colors.backgroundLight,
    },
    vesselOption: {
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
    },
    vesselOptionLast: {
      borderBottomWidth: 0,
    },
    vesselOptionText: {
      fontSize: 16,
      color: isDark ? colors.text : colors.textLight,
    },
    vesselOptionSubtext: {
      fontSize: 13,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
      marginTop: 4,
    },
    mcaButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? colors.background : colors.backgroundLight,
      borderRadius: 12,
      padding: 12,
      marginBottom: 20,
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
    },
    serviceTypeButton: {
      flex: 1,
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)',
      alignItems: 'center',
    },
    serviceTypeButtonActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    serviceTypeText: {
      fontSize: 14,
      fontWeight: '600',
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
    },
    serviceTypeTextActive: {
      color: '#FFFFFF',
    },
    helperText: {
      fontSize: 12,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
      marginTop: 6,
      fontStyle: 'italic',
      lineHeight: 16,
    },
    voyageRow: {
      flexDirection: 'row',
      gap: 12,
    },
    voyageColumn: {
      flex: 1,
    },
    divider: {
      height: 1,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
      marginVertical: 20,
    },
  });

const formatDateToLocalString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

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
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const [editingEntry, setEditingEntry] = useState<SeaTimeEntry | null>(null);

  const [selectedVessel, setSelectedVessel] = useState<Vessel | null>(null);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [notes, setNotes] = useState('');
  const [serviceType, setServiceType] = useState<ServiceType>('seagoing');
  
  const [voyageFrom, setVoyageFrom] = useState('');
  const [voyageTo, setVoyageTo] = useState('');

  const loadData = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    console.log('[LogbookScreen] Component mounted, loading data');
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    console.log('[LogbookScreen] User initiated refresh');
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const handleAddEntry = () => {
    console.log('[LogbookScreen] User tapped Add Entry button');
    router.push('/add-sea-time');
  };

  const handleEditEntry = (entry: SeaTimeEntry) => {
    console.log('[LogbookScreen] User tapped to edit entry:', entry.id);
    setEditingEntry(entry);
    
    setSelectedVessel(entry.vessel);
    setStartDate(new Date(entry.start_time));
    setEndDate(entry.end_time ? new Date(entry.end_time) : null);
    
    const backendToUIServiceType: { [key: string]: ServiceType } = {
      'actual_sea_service': 'seagoing',
      'watchkeeping_service': 'seagoing',
      'standby_service': 'standby',
      'yard_service': 'yard',
      'service_in_port': 'seagoing',
    };
    const uiServiceType = entry.service_type 
      ? (backendToUIServiceType[entry.service_type] || 'seagoing')
      : 'seagoing';
    setServiceType(uiServiceType);
    
    const notesText = entry.notes || '';
    const lines = notesText.split('\n');
    
    let extractedFrom = '';
    let extractedTo = '';
    let remainingNotes: string[] = [];
    
    lines.forEach(line => {
      if (line.startsWith('From:')) {
        extractedFrom = line.replace('From:', '').trim();
      } else if (line.startsWith('To:')) {
        extractedTo = line.replace('To:', '').trim();
      } else if (line.trim()) {
        remainingNotes.push(line);
      }
    });
    
    setVoyageFrom(extractedFrom);
    setVoyageTo(extractedTo);
    setNotes(remainingNotes.join('\n'));
    
    setShowAddModal(true);
  };

  const handleDeleteEntry = () => {
    if (!editingEntry) return;

    console.log('[LogbookScreen] User tapped delete button for entry:', editingEntry.id);
    
    Alert.alert(
      'Delete Entry',
      'Are you sure you want to delete this sea time entry? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => console.log('[LogbookScreen] Delete cancelled'),
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('[LogbookScreen] Deleting sea time entry:', editingEntry.id);
              await seaTimeApi.deleteSeaTimeEntry(editingEntry.id);
              Alert.alert('Success', 'Sea time entry deleted successfully');
              setShowAddModal(false);
              resetForm();
              loadData();
            } catch (error: any) {
              console.error('[LogbookScreen] Error deleting entry:', error);
              Alert.alert('Error', error.message || 'Failed to delete sea time entry');
            }
          },
        },
      ]
    );
  };

  const handleViewMCARequirements = async () => {
    console.log('[LogbookScreen] User tapped View MCA Requirements from modal - closing modal first');
    setShowAddModal(false);
    
    try {
      const userProfile = await seaTimeApi.getUserProfile();
      const department = userProfile?.department?.toLowerCase() || 'deck';
      console.log('[LogbookScreen] User department:', department, '- navigating to MCA requirements');
      
      setTimeout(() => {
        router.push(`/mca-requirements?department=${department}`);
      }, 100);
    } catch (error) {
      console.error('[LogbookScreen] Failed to get user profile, defaulting to deck pathway:', error);
      setTimeout(() => {
        router.push('/mca-requirements?department=deck');
      }, 100);
    }
  };

  const parseLatLong = (text: string): { lat: number | null; lon: number | null } => {
    const coordPattern = /(-?\d+\.?\d*)\s*[,\s]\s*(-?\d+\.?\d*)/;
    const match = text.match(coordPattern);
    
    if (match) {
      const lat = parseFloat(match[1]);
      const lon = parseFloat(match[2]);
      
      if (!isNaN(lat) && !isNaN(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
        return { lat, lon };
      }
    }
    
    return { lat: null, lon: null };
  };

  const handleSaveEntry = async () => {
    console.log('[LogbookScreen] User tapped Save Entry');
    
    if (!selectedVessel) {
      Alert.alert('Error', 'Please select a vessel');
      return;
    }
    
    if (!startDate) {
      Alert.alert('Error', 'Please select a start date and time');
      return;
    }

    if (endDate && endDate <= startDate) {
      Alert.alert('Error', 'End date must be after start date');
      return;
    }

    try {
      const fromCoords = parseLatLong(voyageFrom);
      const toCoords = parseLatLong(voyageTo);

      const serviceTypeMap: { [key: string]: string } = {
        'seagoing': 'actual_sea_service',
        'standby': 'standby_service',
        'yard': 'yard_service',
      };
      const backendServiceType = serviceTypeMap[serviceType] || 'actual_sea_service';

      const voyageFromNote = voyageFrom ? `From: ${voyageFrom}` : '';
      const voyageToNote = voyageTo ? `To: ${voyageTo}` : '';
      
      const noteParts = [voyageFromNote, voyageToNote, notes].filter(Boolean);
      const fullNotes = noteParts.join('\n');

      if (editingEntry) {
        console.log('[LogbookScreen] Updating sea time entry:', editingEntry.id);
        await seaTimeApi.updateSeaTimeEntry(editingEntry.id, {
          notes: fullNotes || null,
          service_type: backendServiceType,
        });
        Alert.alert('Success', 'Sea time entry updated successfully');
      } else {
        console.log('[LogbookScreen] Creating manual sea time entry with service_type:', backendServiceType);
        await seaTimeApi.createManualSeaTimeEntry({
          vessel_id: selectedVessel.id,
          start_time: startDate.toISOString(),
          end_time: endDate?.toISOString() || null,
          notes: fullNotes || null,
          start_latitude: fromCoords.lat,
          start_longitude: fromCoords.lon,
          end_latitude: toCoords.lat,
          end_longitude: toCoords.lon,
          service_type: backendServiceType,
        });
        Alert.alert('Success', 'Sea time entry added successfully');
      }

      setShowAddModal(false);
      resetForm();
      loadData();
    } catch (error: any) {
      console.error('[LogbookScreen] Error saving entry:', error);
      Alert.alert('Error', error.message || 'Failed to save sea time entry');
    }
  };

  const resetForm = () => {
    console.log('[LogbookScreen] Resetting form');
    setEditingEntry(null);
    setSelectedVessel(null);
    setStartDate(null);
    setEndDate(null);
    setNotes('');
    setServiceType('seagoing');
    setVoyageFrom('');
    setVoyageTo('');
    setShowVesselPicker(false);
  };

  const handleCancelModal = () => {
    console.log('[LogbookScreen] User cancelled modal');
    setShowAddModal(false);
    setTimeout(() => {
      resetForm();
    }, 300);
  };

  const formatDateTime = (date: Date | null) => {
    if (!date) return '';
    return date.toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
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

  const formatDuration = (hours: number | string | null | undefined): string => {
    if (hours === null || hours === undefined) return 'In progress';
    const h = typeof hours === 'number' ? hours : parseFloat(hours);
    if (isNaN(h) || h === 0) return 'In progress';
    
    if (h >= 24) {
      const days = Math.floor(h / 24);
      const remainingHours = Math.round(h % 24);
      if (remainingHours === 0) {
        return `${days} ${days === 1 ? 'day' : 'days'}`;
      }
      return `${days} ${days === 1 ? 'day' : 'days'}, ${remainingHours}h`;
    }
    
    const wholeHours = Math.floor(h);
    const minutes = Math.round((h - wholeHours) * 60);
    if (minutes === 0) return `${wholeHours}h`;
    return `${wholeHours}h ${minutes}m`;
  };

  const formatSeaDay = (seaDays: number | null | undefined): string => {
    if (seaDays === 1) {
      return '✓ Sea Day Qualified';
    } else if (seaDays === 0) {
      return '✗ Not Qualified (< 4 hours)';
    }
    return 'Pending Confirmation';
  };

  const formatServiceTypeDisplay = (serviceType: string | null | undefined): string => {
    if (!serviceType) return '';
    
    const typeMap: { [key: string]: string } = {
      'actual_sea_service': 'Actual Sea Service',
      'watchkeeping_service': 'Watchkeeping Service',
      'standby_service': 'Stand-by Service',
      'yard_service': 'Yard Service',
      'service_in_port': 'Service in Port',
    };
    
    return typeMap[serviceType] || serviceType;
  };

  const calculateTotalSeaDays = () => {
    return entries
      .filter((e) => e.status === 'confirmed')
      .reduce((sum, entry) => sum + (entry.sea_days ?? 0), 0);
  };

  const handleDatePress = (day: any) => {
    const dateString = day.dateString;
    console.log('[LogbookScreen] User tapped calendar date:', dateString);
    setSelectedDate(dateString);
  };

  const getEntriesForDate = useCallback((dateString: string): SeaTimeEntry[] => {
    const dateEntries = entries.filter((entry) => {
      if (entry.status !== 'confirmed') return false;
      
      const entryDate = new Date(entry.start_time);
      const entryDateString = formatDateToLocalString(entryDate);
      
      return entryDateString === dateString;
    });
    
    return dateEntries;
  }, [entries]);

  const markedDates = useMemo(() => {
    const marked: any = {};
    
    const confirmedEntries = entries.filter((e) => e.status === 'confirmed' && e.sea_days === 1);
    
    confirmedEntries.forEach((entry) => {
      const entryDate = new Date(entry.start_time);
      const dateString = formatDateToLocalString(entryDate);
      
      marked[dateString] = {
        marked: true,
        dotColor: colors.primary,
        selected: selectedDate === dateString,
        selectedColor: colors.primary,
        selectedTextColor: '#FFFFFF',
      };
    });
    
    return marked;
  }, [entries, selectedDate]);

  const groupEntriesByVessel = () => {
    const confirmedEntries = entries.filter((e) => e.status === 'confirmed');
    const grouped: { [vesselId: string]: { vessel: Vessel | null; entries: SeaTimeEntry[] } } = {};
    
    confirmedEntries.forEach((entry) => {
      const vesselId = entry.vessel?.id || 'unknown';
      if (!grouped[vesselId]) {
        grouped[vesselId] = {
          vessel: entry.vessel,
          entries: [],
        };
      }
      grouped[vesselId].entries.push(entry);
    });
    
    Object.values(grouped).forEach((group) => {
      group.entries.sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());
    });
    
    return grouped;
  };

  const confirmedEntries = entries
    .filter((e) => e.status === 'confirmed')
    .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());
  const pendingEntries = entries.filter((e) => e.status === 'pending');
  const groupedByVessel = groupEntriesByVessel();

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
                Logbook
              </Text>
              <Text style={styles.headerSubtitle}>Loading your sea time records...</Text>
            </View>
          </View>
        </View>
      </View>
    );
  }

  const totalSeaDays = calculateTotalSeaDays();

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
              Logbook
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
                setSelectedDate(null);
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
              markedDates={markedDates}
              onDayPress={handleDatePress}
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
            <View style={styles.calendarLegend}>
              <View style={styles.legendDot} />
              <Text style={styles.legendText}>Sea day recorded (4+ hours) - Tap to view</Text>
            </View>
          </View>

          {selectedDate ? (
            <View style={styles.selectedDateCard}>
              <Text style={styles.selectedDateTitle}>
                Entries for {formatDate(selectedDate + 'T00:00:00')}
              </Text>
              {getEntriesForDate(selectedDate).length > 0 ? (
                <React.Fragment>
                  {getEntriesForDate(selectedDate).map((entry) => (
                    <TouchableOpacity
                      key={entry.id}
                      style={styles.selectedDateEntry}
                      onPress={() => handleEditEntry(entry)}
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
                            ` - ${formatTime(entry.end_time)}`}
                        </Text>
                      </View>

                      {entry.duration_hours !== null && entry.duration_hours !== undefined && (
                        <View style={styles.entryRow}>
                          <IconSymbol
                            ios_icon_name="clock"
                            android_material_icon_name="schedule"
                            size={16}
                            color={colors.primary}
                            style={styles.entryIcon}
                          />
                          <Text style={[styles.entryText, { color: colors.primary, fontWeight: '600' }]}>
                            {formatDuration(entry.duration_hours)}
                          </Text>
                        </View>
                      )}

                      <View style={styles.seaDayBadge}>
                        <Text style={styles.seaDayText}>
                          {formatSeaDay(entry.sea_days)}
                        </Text>
                      </View>

                      {entry.service_type && (
                        <View style={styles.entryRow}>
                          <IconSymbol
                            ios_icon_name="tag.fill"
                            android_material_icon_name="label"
                            size={16}
                            color={colors.primary}
                            style={styles.entryIcon}
                          />
                          <Text style={[styles.entryText, { color: colors.primary, fontWeight: '600' }]}>
                            {formatServiceTypeDisplay(entry.service_type)}
                          </Text>
                        </View>
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
                    </TouchableOpacity>
                  ))}
                </React.Fragment>
              ) : (
                <Text style={styles.noEntriesText}>No sea days recorded for this date</Text>
              )}
            </View>
          ) : (
            <View style={styles.noDateSelectedContainer}>
              <IconSymbol
                ios_icon_name="calendar"
                android_material_icon_name="calendar-today"
                size={48}
                color={isDark ? colors.textSecondary : colors.textSecondaryLight}
              />
              <Text style={styles.noDateSelectedText}>
                Select a date on the calendar to view sea time entries
              </Text>
            </View>
          )}
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
                Tap the + button to add a sea time entry. Remember: 4+ hours underway = 1 sea day
              </Text>
            </View>
          ) : (
            <React.Fragment>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryTitle}>Summary</Text>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Total Sea Days</Text>
                  <Text style={styles.summaryValue}>{totalSeaDays}</Text>
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
                  <Text style={styles.sectionTitle}>Sea Time Records by Vessel</Text>
                  {Object.entries(groupedByVessel).map(([vesselId, group]) => {
                    const vesselTotalSeaDays = group.entries.reduce(
                      (sum, entry) => sum + (entry.sea_days ?? 0),
                      0
                    );
                    
                    return (
                      <React.Fragment key={vesselId}>
                        <View style={styles.vesselGroupHeader}>
                          <Text style={styles.vesselGroupTitle}>
                            {group.vessel?.vessel_name || 'Unknown Vessel'}
                          </Text>
                          {group.vessel?.callsign && (
                            <Text style={styles.vesselGroupCallsign}>
                              Call Sign: {group.vessel.callsign}
                            </Text>
                          )}
                          <View style={styles.vesselGroupStats}>
                            <View style={styles.vesselStat}>
                              <Text style={styles.vesselStatText}>Entries:</Text>
                              <Text style={styles.vesselStatValue}>{group.entries.length}</Text>
                            </View>
                            <View style={styles.vesselStat}>
                              <Text style={styles.vesselStatText}>Sea Days:</Text>
                              <Text style={styles.vesselStatValue}>{vesselTotalSeaDays}</Text>
                            </View>
                          </View>
                        </View>
                        
                        {group.entries.map((entry) => (
                          <TouchableOpacity
                            key={entry.id}
                            style={styles.entryCard}
                            onPress={() => handleEditEntry(entry)}
                          >
                            <View style={styles.entryHeader}>
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
                                  ` - ${formatTime(entry.end_time)}`}
                              </Text>
                            </View>

                            {entry.duration_hours !== null && entry.duration_hours !== undefined && (
                              <View style={styles.entryRow}>
                                <IconSymbol
                                  ios_icon_name="clock"
                                  android_material_icon_name="schedule"
                                  size={16}
                                  color={colors.primary}
                                  style={styles.entryIcon}
                                />
                                <Text style={[styles.entryText, { color: colors.primary, fontWeight: '600' }]}>
                                  {formatDuration(entry.duration_hours)}
                                </Text>
                              </View>
                            )}

                            <View style={styles.seaDayBadge}>
                              <Text style={styles.seaDayText}>
                                {formatSeaDay(entry.sea_days)}
                              </Text>
                            </View>

                            {entry.service_type && (
                              <View style={styles.entryRow}>
                                <IconSymbol
                                  ios_icon_name="tag.fill"
                                  android_material_icon_name="label"
                                  size={16}
                                  color={colors.primary}
                                  style={styles.entryIcon}
                                />
                                <Text style={[styles.entryText, { color: colors.primary, fontWeight: '600' }]}>
                                  {formatServiceTypeDisplay(entry.service_type)}
                                </Text>
                              </View>
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
                          </TouchableOpacity>
                        ))}
                      </React.Fragment>
                    );
                  })}
                </React.Fragment>
              )}

              {pendingEntries.length > 0 && (
                <React.Fragment>
                  <Text style={styles.sectionTitle}>Pending Review</Text>
                  {pendingEntries.map((entry) => (
                    <TouchableOpacity
                      key={entry.id}
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
                            ` - ${formatTime(entry.end_time)}`}
                        </Text>
                      </View>

                      <View style={styles.seaDayBadge}>
                        <Text style={styles.seaDayText}>
                          {formatSeaDay(entry.sea_days)}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </React.Fragment>
              )}
            </React.Fragment>
          )}
        </ScrollView>
      )}

      <Modal
        visible={showAddModal}
        transparent
        animationType="slide"
        onRequestClose={handleCancelModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={handleCancelModal}
          >
            <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <View style={styles.modalTitleContainer}>
                    <Text style={styles.modalTitle}>
                      {editingEntry ? 'Edit Sea Time Entry' : 'Add Sea Time Entry'}
                    </Text>
                  </View>
                  {editingEntry && (
                    <TouchableOpacity 
                      style={styles.deleteButton}
                      onPress={handleDeleteEntry}
                    >
                      <IconSymbol
                        ios_icon_name="trash"
                        android_material_icon_name="delete"
                        size={22}
                        color="#FF3B30"
                      />
                    </TouchableOpacity>
                  )}
                </View>
                <Text style={styles.modalSubtitle}>
                  {editingEntry ? 'Update your sea time record' : 'Record a sea day: 4+ hours underway in any 24-hour period. Only one sea day can be recorded per calendar day.'}
                </Text>

                <ScrollView 
                  style={styles.modalScrollView} 
                  contentContainerStyle={styles.modalScrollContent}
                  showsVerticalScrollIndicator={true}
                  bounces={true}
                  scrollEnabled={true}
                  nestedScrollEnabled={true}
                  keyboardShouldPersistTaps="handled"
                >
                  {!editingEntry && (
                    <TouchableOpacity style={styles.mcaButton} onPress={handleViewMCARequirements}>
                      <IconSymbol
                        ios_icon_name="info.circle"
                        android_material_icon_name="info"
                        size={20}
                        color={colors.primary}
                      />
                      <Text style={styles.mcaButtonText}>View MCA Requirements</Text>
                    </TouchableOpacity>
                  )}

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Service Type</Text>
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
                      <Text style={styles.helperText}>
                        Up to 90 days total (continuous or split)
                      </Text>
                    )}
                  </View>

                  {!editingEntry && (
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Vessel</Text>
                      <TouchableOpacity
                        style={styles.pickerButton}
                        onPress={() => {
                          console.log('[LogbookScreen] User tapped vessel picker button, toggling dropdown, vessels available:', vessels.length);
                          setShowVesselPicker(!showVesselPicker);
                        }}
                      >
                        <Text
                          style={
                            selectedVessel
                              ? styles.pickerButtonText
                              : styles.pickerButtonPlaceholder
                          }
                        >
                          {selectedVessel ? selectedVessel.vessel_name : 'Select a vessel'}
                        </Text>
                        <IconSymbol
                          ios_icon_name="chevron.down"
                          android_material_icon_name="arrow-drop-down"
                          size={20}
                          color={isDark ? colors.textSecondary : colors.textSecondaryLight}
                        />
                      </TouchableOpacity>
                      
                      {showVesselPicker && vessels.length > 0 && (
                        <View style={styles.vesselPickerContainer}>
                          <FlatList
                            data={vessels}
                            keyExtractor={(item) => item.id}
                            renderItem={({ item, index }) => (
                              <TouchableOpacity
                                style={[
                                  styles.vesselOption,
                                  index === vessels.length - 1 && styles.vesselOptionLast,
                                ]}
                                onPress={() => {
                                  console.log('[LogbookScreen] User selected vessel:', item.vessel_name);
                                  setSelectedVessel(item);
                                  setShowVesselPicker(false);
                                }}
                              >
                                <Text style={styles.vesselOptionText}>{item.vessel_name}</Text>
                                <Text style={styles.vesselOptionSubtext}>
                                  MMSI: {item.mmsi}
                                  {item.callsign && ` • Call Sign: ${item.callsign}`}
                                </Text>
                              </TouchableOpacity>
                            )}
                            scrollEnabled={vessels.length > 3}
                            nestedScrollEnabled={true}
                          />
                        </View>
                      )}
                      
                      {showVesselPicker && vessels.length === 0 && (
                        <View style={styles.vesselPickerContainer}>
                          <View style={styles.vesselOption}>
                            <Text style={styles.vesselOptionText}>No vessels available</Text>
                            <Text style={styles.vesselOptionSubtext}>Add a vessel first from the Home tab</Text>
                          </View>
                        </View>
                      )}
                    </View>
                  )}

                  {editingEntry && (
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Vessel</Text>
                      <View style={styles.pickerButton}>
                        <Text style={styles.pickerButtonText}>
                          {selectedVessel?.vessel_name || 'Unknown Vessel'}
                        </Text>
                      </View>
                      <Text style={styles.helperText}>
                        Vessel cannot be changed when editing
                      </Text>
                    </View>
                  )}

                  <View style={styles.divider} />

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Start Date & Time</Text>
                    <TouchableOpacity
                      style={styles.dateTimeButton}
                      onPress={() => {
                        if (!editingEntry) {
                          console.log('[LogbookScreen] User tapped start date/time button');
                          setShowStartDatePicker(true);
                        }
                      }}
                      disabled={!!editingEntry}
                    >
                      <Text style={startDate ? styles.dateTimeText : styles.dateTimePlaceholder}>
                        {startDate ? formatDateTime(startDate) : 'Select start date & time'}
                      </Text>
                      <IconSymbol
                        ios_icon_name="calendar"
                        android_material_icon_name="calendar-today"
                        size={20}
                        color={isDark ? colors.textSecondary : colors.textSecondaryLight}
                      />
                    </TouchableOpacity>
                    {editingEntry && (
                      <Text style={styles.helperText}>
                        Start date cannot be changed when editing
                      </Text>
                    )}
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>
                      End Date & Time{' '}
                      <Text style={styles.inputLabelOptional}>(Optional)</Text>
                    </Text>
                    <TouchableOpacity
                      style={styles.dateTimeButton}
                      onPress={() => {
                        if (!editingEntry) {
                          console.log('[LogbookScreen] User tapped end date/time button');
                          setShowEndDatePicker(true);
                        }
                      }}
                      disabled={!!editingEntry}
                    >
                      <Text style={endDate ? styles.dateTimeText : styles.dateTimePlaceholder}>
                        {endDate ? formatDateTime(endDate) : 'Select end date & time'}
                      </Text>
                      <IconSymbol
                        ios_icon_name="calendar"
                        android_material_icon_name="calendar-today"
                        size={20}
                        color={isDark ? colors.textSecondary : colors.textSecondaryLight}
                      />
                    </TouchableOpacity>
                    {editingEntry && (
                      <Text style={styles.helperText}>
                        End date cannot be changed when editing
                      </Text>
                    )}
                  </View>

                  <View style={styles.divider} />

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>
                      Voyage Locations{' '}
                      <Text style={styles.inputLabelOptional}>(Optional)</Text>
                    </Text>
                    <Text style={styles.helperText}>
                      Enter location names or coordinates (e.g., "51.5074, -0.1278")
                    </Text>
                  </View>

                  <View style={styles.voyageRow}>
                    <View style={styles.voyageColumn}>
                      <Text style={[styles.inputLabel, { marginBottom: 8 }]}>From</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="Port or coordinates"
                        placeholderTextColor={
                          isDark ? colors.textSecondary : colors.textSecondaryLight
                        }
                        value={voyageFrom}
                        onChangeText={setVoyageFrom}
                      />
                    </View>
                    <View style={styles.voyageColumn}>
                      <Text style={[styles.inputLabel, { marginBottom: 8 }]}>To</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="Port or coordinates"
                        placeholderTextColor={
                          isDark ? colors.textSecondary : colors.textSecondaryLight
                        }
                        value={voyageTo}
                        onChangeText={setVoyageTo}
                      />
                    </View>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>
                      Additional Notes{' '}
                      <Text style={styles.inputLabelOptional}>(Optional)</Text>
                    </Text>
                    <TextInput
                      style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                      placeholder="Add any notes about this sea time..."
                      placeholderTextColor={
                        isDark ? colors.textSecondary : colors.textSecondaryLight
                      }
                      value={notes}
                      onChangeText={setNotes}
                      multiline
                      numberOfLines={3}
                    />
                  </View>
                </ScrollView>

                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.cancelButton]}
                    onPress={handleCancelModal}
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
                      {editingEntry ? 'Update' : 'Save'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {showStartDatePicker && Platform.OS !== 'ios' && !editingEntry && (
        <DateTimePicker
          value={startDate || new Date()}
          mode="date"
          display="default"
          onChange={(event, selectedDate) => {
            setShowStartDatePicker(false);
            if (selectedDate) {
              console.log('[LogbookScreen] Start date selected:', selectedDate.toISOString());
              const newDate = startDate ? new Date(startDate) : new Date();
              newDate.setFullYear(selectedDate.getFullYear());
              newDate.setMonth(selectedDate.getMonth());
              newDate.setDate(selectedDate.getDate());
              setStartDate(newDate);
              setShowStartTimePicker(true);
            }
          }}
        />
      )}

      {showStartTimePicker && Platform.OS !== 'ios' && !editingEntry && (
        <DateTimePicker
          value={startDate || new Date()}
          mode="time"
          display="default"
          onChange={(event, selectedTime) => {
            setShowStartTimePicker(false);
            if (selectedTime) {
              console.log('[LogbookScreen] Start time selected:', selectedTime.toISOString());
              const newDate = startDate ? new Date(startDate) : new Date();
              newDate.setHours(selectedTime.getHours());
              newDate.setMinutes(selectedTime.getMinutes());
              setStartDate(newDate);
            }
          }}
        />
      )}

      {showEndDatePicker && Platform.OS !== 'ios' && !editingEntry && (
        <DateTimePicker
          value={endDate || new Date()}
          mode="date"
          display="default"
          onChange={(event, selectedDate) => {
            setShowEndDatePicker(false);
            if (selectedDate) {
              console.log('[LogbookScreen] End date selected:', selectedDate.toISOString());
              const newDate = endDate ? new Date(endDate) : new Date();
              newDate.setFullYear(selectedDate.getFullYear());
              newDate.setMonth(selectedDate.getMonth());
              newDate.setDate(selectedDate.getDate());
              setEndDate(newDate);
              setShowEndTimePicker(true);
            }
          }}
        />
      )}

      {showEndTimePicker && Platform.OS !== 'ios' && !editingEntry && (
        <DateTimePicker
          value={endDate || new Date()}
          mode="time"
          display="default"
          onChange={(event, selectedTime) => {
            setShowEndTimePicker(false);
            if (selectedTime) {
              console.log('[LogbookScreen] End time selected:', selectedTime.toISOString());
              const newDate = endDate ? new Date(endDate) : new Date();
              newDate.setHours(selectedTime.getHours());
              newDate.setMinutes(selectedTime.getMinutes());
              setEndDate(newDate);
            }
          }}
        />
      )}

      {showStartDatePicker && Platform.OS === 'ios' && !editingEntry && (
        <Modal
          visible={showStartDatePicker}
          transparent
          animationType="slide"
          onRequestClose={() => setShowStartDatePicker(false)}
        >
          <View style={styles.modalOverlay}>
            <TouchableOpacity
              style={{ flex: 1 }}
              activeOpacity={1}
              onPress={() => setShowStartDatePicker(false)}
            />
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Select Start Date & Time</Text>
              <DateTimePicker
                value={startDate || new Date()}
                mode="datetime"
                display="spinner"
                onChange={(event, selectedDate) => {
                  if (selectedDate) {
                    console.log('[LogbookScreen] Start date/time selected:', selectedDate.toISOString());
                    setStartDate(selectedDate);
                  }
                }}
                textColor={isDark ? colors.text : colors.textLight}
              />
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.saveButton]}
                  onPress={() => setShowStartDatePicker(false)}
                >
                  <Text style={[styles.modalButtonText, styles.saveButtonText]}>Done</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {showEndDatePicker && Platform.OS === 'ios' && !editingEntry && (
        <Modal
          visible={showEndDatePicker}
          transparent
          animationType="slide"
          onRequestClose={() => setShowEndDatePicker(false)}
        >
          <View style={styles.modalOverlay}>
            <TouchableOpacity
              style={{ flex: 1 }}
              activeOpacity={1}
              onPress={() => setShowEndDatePicker(false)}
            />
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Select End Date & Time</Text>
              <DateTimePicker
                value={endDate || new Date()}
                mode="datetime"
                display="spinner"
                onChange={(event, selectedDate) => {
                  if (selectedDate) {
                    console.log('[LogbookScreen] End date/time selected:', selectedDate.toISOString());
                    setEndDate(selectedDate);
                  }
                }}
                textColor={isDark ? colors.text : colors.textLight}
              />
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.saveButton]}
                  onPress={() => setShowEndDatePicker(false)}
                >
                  <Text style={[styles.modalButtonText, styles.saveButtonText]}>Done</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

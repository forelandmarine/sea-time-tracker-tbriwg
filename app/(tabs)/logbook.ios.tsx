
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
  FlatList,
} from 'react-native';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import * as seaTimeApi from '@/utils/seaTimeApi';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Calendar } from 'react-native-calendars';
import DateTimePicker from '@react-native-community/datetimepicker';
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

const createStyles = (isDark: boolean, topInset: number) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? colors.background : colors.backgroundLight,
    },
    header: {
      padding: 20,
      paddingTop: topInset + 12,
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
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: isDark ? colors.cardBackground : colors.cardBackgroundLight,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: 24,
      maxHeight: '90%',
    },
    modalScrollContent: {
      paddingBottom: 20,
    },
    modalTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      color: isDark ? colors.text : colors.textLight,
      marginBottom: 8,
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
      maxHeight: 300,
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
    datePickerContainer: {
      backgroundColor: isDark ? colors.cardBackground : colors.cardBackgroundLight,
      borderRadius: 16,
      padding: 16,
      marginTop: 12,
    },
  });

// Helper function to format date in local timezone as YYYY-MM-DD
const formatDateToLocalString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function LogbookScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();
  const styles = createStyles(isDark, insets.top);
  const router = useRouter();

  const [entries, setEntries] = useState<SeaTimeEntry[]>([]);
  const [vessels, setVessels] = useState<Vessel[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showVesselPicker, setShowVesselPicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Edit mode state
  const [editingEntry, setEditingEntry] = useState<SeaTimeEntry | null>(null);

  // Form state
  const [selectedVessel, setSelectedVessel] = useState<Vessel | null>(null);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [notes, setNotes] = useState('');
  const [serviceType, setServiceType] = useState<ServiceType>('seagoing');
  
  // Voyage location fields
  const [voyageFrom, setVoyageFrom] = useState('');
  const [voyageTo, setVoyageTo] = useState('');

  useEffect(() => {
    console.log('[LogbookScreen iOS] Component mounted, loading data');
    loadData();
  }, []);

  const loadData = async () => {
    try {
      console.log('[LogbookScreen iOS] Fetching sea time entries and vessels');
      const [entriesData, vesselsData] = await Promise.all([
        seaTimeApi.getSeaTimeEntries(),
        seaTimeApi.getVessels(),
      ]);
      console.log('[LogbookScreen iOS] Received entries:', entriesData.length, 'vessels:', vesselsData.length);
      
      setEntries(entriesData);
      setVessels(vesselsData);
    } catch (error) {
      console.error('[LogbookScreen iOS] Error loading data:', error);
      Alert.alert('Error', 'Failed to load logbook data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    console.log('[LogbookScreen iOS] User initiated refresh');
    setRefreshing(true);
    loadData();
  };

  const handleAddEntry = () => {
    console.log('[LogbookScreen iOS] User tapped Add Entry button');
    setEditingEntry(null);
    setShowAddModal(true);
  };

  const handleEditEntry = (entry: SeaTimeEntry) => {
    console.log('[LogbookScreen iOS] User tapped to edit entry:', entry.id);
    setEditingEntry(entry);
    
    // Pre-fill form with existing data
    setSelectedVessel(entry.vessel);
    setStartDate(new Date(entry.start_time));
    setEndDate(entry.end_time ? new Date(entry.end_time) : null);
    
    // Parse notes to extract service type and voyage locations
    const notesText = entry.notes || '';
    const lines = notesText.split('\n');
    
    let extractedServiceType: ServiceType = 'seagoing';
    let extractedFrom = '';
    let extractedTo = '';
    let remainingNotes: string[] = [];
    
    lines.forEach(line => {
      if (line.startsWith('Service Type:')) {
        const type = line.replace('Service Type:', '').trim().toLowerCase();
        if (type === 'seagoing' || type === 'standby' || type === 'yard') {
          extractedServiceType = type as ServiceType;
        }
      } else if (line.startsWith('From:')) {
        extractedFrom = line.replace('From:', '').trim();
      } else if (line.startsWith('To:')) {
        extractedTo = line.replace('To:', '').trim();
      } else if (line.trim()) {
        remainingNotes.push(line);
      }
    });
    
    setServiceType(extractedServiceType);
    setVoyageFrom(extractedFrom);
    setVoyageTo(extractedTo);
    setNotes(remainingNotes.join('\n'));
    
    setShowAddModal(true);
  };

  const handleViewMCARequirements = () => {
    console.log('[LogbookScreen iOS] User tapped View MCA Requirements from modal - closing modal first');
    setShowAddModal(false);
    setTimeout(() => {
      router.push('/mca-requirements');
    }, 100);
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
    console.log('[LogbookScreen iOS] User tapped Save Entry');
    
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

      const serviceTypeNote = `Service Type: ${serviceType.charAt(0).toUpperCase() + serviceType.slice(1)}`;
      const voyageFromNote = voyageFrom ? `From: ${voyageFrom}` : '';
      const voyageToNote = voyageTo ? `To: ${voyageTo}` : '';
      
      const noteParts = [serviceTypeNote, voyageFromNote, voyageToNote, notes].filter(Boolean);
      const fullNotes = noteParts.join('\n');

      if (editingEntry) {
        // Update existing entry
        console.log('[LogbookScreen iOS] Updating sea time entry:', editingEntry.id);
        await seaTimeApi.updateSeaTimeEntry(editingEntry.id, {
          notes: fullNotes,
        });
        Alert.alert('Success', 'Sea time entry updated successfully');
      } else {
        // Create new entry
        console.log('[LogbookScreen iOS] Creating manual sea time entry');
        await seaTimeApi.createManualSeaTimeEntry({
          vessel_id: selectedVessel.id,
          start_time: startDate.toISOString(),
          end_time: endDate?.toISOString() || null,
          notes: fullNotes,
          start_latitude: fromCoords.lat,
          start_longitude: fromCoords.lon,
          end_latitude: toCoords.lat,
          end_longitude: toCoords.lon,
        });
        Alert.alert('Success', 'Sea time entry added successfully');
      }

      setShowAddModal(false);
      resetForm();
      loadData();
    } catch (error: any) {
      console.error('[LogbookScreen iOS] Error saving entry:', error);
      Alert.alert('Error', error.message || 'Failed to save sea time entry');
    }
  };

  const resetForm = () => {
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

  const handleDatePress = (day: any) => {
    const dateString = day.dateString;
    console.log('[LogbookScreen iOS] User tapped calendar date:', dateString);
    setSelectedDate(dateString);
  };

  const getEntriesForDate = (dateString: string): SeaTimeEntry[] => {
    const dateEntries = entries.filter((entry) => {
      // Show confirmed entries on calendar
      if (entry.status !== 'confirmed') return false;
      
      const entryStartDate = new Date(entry.start_time);
      const entryEndDate = entry.end_time ? new Date(entry.end_time) : new Date();
      
      const selectedDateObj = new Date(dateString);
      selectedDateObj.setHours(0, 0, 0, 0);
      
      const nextDay = new Date(selectedDateObj);
      nextDay.setDate(nextDay.getDate() + 1);
      
      return entryStartDate < nextDay && entryEndDate >= selectedDateObj;
    });
    
    console.log('[LogbookScreen iOS] Entries for date', dateString, ':', dateEntries.length);
    return dateEntries;
  };

  const getMarkedDates = () => {
    const marked: any = {};
    
    // Filter for confirmed entries only
    const confirmedEntries = entries.filter((e) => e.status === 'confirmed');
    console.log('[LogbookScreen iOS] Marking calendar - Total entries:', entries.length, 'Confirmed:', confirmedEntries.length);
    
    confirmedEntries.forEach((entry) => {
      const startDate = new Date(entry.start_time);
      const endDate = entry.end_time ? new Date(entry.end_time) : new Date();
      
      // Create a new date object for iteration, starting at midnight local time
      let currentDate = new Date(startDate);
      currentDate.setHours(0, 0, 0, 0);
      
      // Set end date to end of day local time
      const endDateNormalized = new Date(endDate);
      endDateNormalized.setHours(23, 59, 59, 999);
      
      console.log('[LogbookScreen iOS] Marking dates for entry:', entry.id, 'Start:', startDate.toISOString(), 'End:', endDate.toISOString());
      
      while (currentDate <= endDateNormalized) {
        // Use local date formatting instead of UTC to avoid timezone shift
        const dateString = formatDateToLocalString(currentDate);
        console.log('[LogbookScreen iOS] Marking date:', dateString, 'for entry:', entry.id);
        
        marked[dateString] = {
          marked: true,
          dotColor: colors.primary,
          selected: selectedDate === dateString,
          selectedColor: colors.primary,
          selectedTextColor: '#FFFFFF',
        };
        currentDate.setDate(currentDate.getDate() + 1);
      }
    });
    
    console.log('[LogbookScreen iOS] Marked dates for calendar:', Object.keys(marked).length, 'days', Object.keys(marked));
    return marked;
  };

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
                console.log('[LogbookScreen iOS] Switching to list view');
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
                console.log('[LogbookScreen iOS] Switching to calendar view');
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
              <Text style={styles.legendText}>Sea day recorded - Tap a date to view details</Text>
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
                    </TouchableOpacity>
                  ))}
                </React.Fragment>
              ) : (
                <Text style={styles.noEntriesText}>No entries recorded for this date</Text>
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
                Select a date on the calendar to view sea time entries for that day
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
                  <Text style={styles.sectionTitle}>Sea Time Records by Vessel</Text>
                  {Object.entries(groupedByVessel).map(([vesselId, group]) => {
                    const vesselTotalHours = group.entries.reduce(
                      (sum, entry) => sum + toNumber(entry.duration_hours),
                      0
                    );
                    const vesselTotalDays = (vesselTotalHours / 24).toFixed(1);
                    
                    return (
                      <React.Fragment key={vesselId}>
                        <View style={styles.vesselGroupHeader}>
                          <Text style={styles.vesselGroupTitle}>
                            {group.vessel?.vessel_name || 'Unknown Vessel'}
                          </Text>
                          <View style={styles.vesselGroupStats}>
                            <View style={styles.vesselStat}>
                              <Text style={styles.vesselStatText}>Entries:</Text>
                              <Text style={styles.vesselStatValue}>{group.entries.length}</Text>
                            </View>
                            <View style={styles.vesselStat}>
                              <Text style={styles.vesselStatText}>Total:</Text>
                              <Text style={styles.vesselStatValue}>{vesselTotalDays} days</Text>
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
                        console.log('[LogbookScreen iOS] User tapped pending entry, navigating to Review tab');
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

      <Modal
        visible={showAddModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          console.log('[LogbookScreen iOS] Add modal closed');
          setShowAddModal(false);
          resetForm();
        }}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={() => {
              console.log('[LogbookScreen iOS] User tapped outside modal, closing');
              setShowAddModal(false);
              resetForm();
            }}
          />
          <KeyboardAvoidingView behavior="padding" style={{ width: '100%' }}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>
                {editingEntry ? 'Edit Sea Time Entry' : 'Add Sea Time Entry'}
              </Text>
              <Text style={styles.modalSubtitle}>
                {editingEntry ? 'Update your sea time record' : 'Manually record your sea time with voyage details'}
              </Text>

              <ScrollView style={{ maxHeight: 500 }} contentContainerStyle={styles.modalScrollContent}>
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
                        console.log('[LogbookScreen iOS] User tapped vessel picker button, toggling dropdown, vessels available:', vessels.length);
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
                                console.log('[LogbookScreen iOS] User selected vessel:', item.vessel_name);
                                setSelectedVessel(item);
                                setShowVesselPicker(false);
                              }}
                            >
                              <Text style={styles.vesselOptionText}>{item.vessel_name}</Text>
                              <Text style={styles.vesselOptionSubtext}>MMSI: {item.mmsi}</Text>
                            </TouchableOpacity>
                          )}
                          scrollEnabled={vessels.length > 4}
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
                  <View style={styles.dateTimeButton}>
                    <Text style={startDate ? styles.dateTimeText : styles.dateTimePlaceholder}>
                      {startDate ? formatDateTime(startDate) : 'Select start date & time'}
                    </Text>
                    <IconSymbol
                      ios_icon_name="calendar"
                      android_material_icon_name="calendar-today"
                      size={20}
                      color={isDark ? colors.textSecondary : colors.textSecondaryLight}
                    />
                  </View>
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
                  <View style={styles.dateTimeButton}>
                    <Text style={endDate ? styles.dateTimeText : styles.dateTimePlaceholder}>
                      {endDate ? formatDateTime(endDate) : 'Select end date & time'}
                    </Text>
                    <IconSymbol
                      ios_icon_name="calendar"
                      android_material_icon_name="calendar-today"
                      size={20}
                      color={isDark ? colors.textSecondary : colors.textSecondaryLight}
                    />
                  </View>
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
                  onPress={() => {
                    console.log('[LogbookScreen iOS] User cancelled');
                    setShowAddModal(false);
                    resetForm();
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
                    {editingEntry ? 'Update' : 'Save'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}


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
  Modal,
  TextInput,
  KeyboardAvoidingView,
  ActivityIndicator,
} from 'react-native';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import * as seaTimeApi from '@/utils/seaTimeApi';
import * as Haptics from 'expo-haptics';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState, useEffect, useCallback } from 'react';

interface Vessel {
  id: string;
  mmsi: string;
  vessel_name: string;
  is_active: boolean;
  created_at: string;
  flag?: string;
  official_number?: string;
  vessel_type?: string;
  length_metres?: number;
  gross_tonnes?: number;
  callsign?: string;
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

interface AISData {
  name: string | null;
  mmsi: string | null;
  imo: string | null;
  speed_knots: number | null;
  latitude: number | null;
  longitude: number | null;
  course: number | null;
  heading: number | null;
  timestamp: string | null;
  status: string | null;
  destination: string | null;
  eta: string | null;
  callsign: string | null;
  ship_type: string | null;
  flag: string | null;
  is_moving: boolean;
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
    particularsCard: {
      backgroundColor: isDark ? colors.cardBackground : colors.card,
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
      borderWidth: 1,
      borderColor: isDark ? colors.border : colors.borderLight,
    },
    particularsHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    particularsHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flex: 1,
    },
    particularsTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: isDark ? colors.text : colors.textLight,
    },
    editButton: {
      backgroundColor: colors.primary,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 6,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    editButtonText: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '600',
    },
    particularRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
    },
    particularRowLast: {
      borderBottomWidth: 0,
    },
    particularLabel: {
      fontSize: 14,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
      fontWeight: '500',
    },
    particularValue: {
      fontSize: 14,
      color: isDark ? colors.text : colors.textLight,
      fontWeight: '600',
    },
    particularValueEmpty: {
      fontSize: 14,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
      fontStyle: 'italic',
    },
    activateButton: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
      marginBottom: 16,
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    activateButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },
    checkAISButton: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
      marginBottom: 24,
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    checkAISButtonDisabled: {
      backgroundColor: isDark ? colors.textSecondary : colors.textSecondaryLight,
      opacity: 0.6,
    },
    checkAISButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
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
    deleteButton: {
      backgroundColor: isDark ? colors.cardBackground : colors.card,
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
      marginTop: 24,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.error,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    deleteButtonText: {
      color: colors.error,
      fontSize: 16,
      fontWeight: '600',
    },
    // Modal styles
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContent: {
      backgroundColor: isDark ? colors.cardBackground : colors.card,
      borderRadius: 16,
      padding: 24,
      width: '90%',
      maxWidth: 500,
      maxHeight: '80%',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 20,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: isDark ? colors.text : colors.textLight,
    },
    closeButton: {
      padding: 4,
    },
    modalScrollContent: {
      paddingBottom: 16,
    },
    inputGroup: {
      marginBottom: 16,
    },
    inputLabel: {
      fontSize: 14,
      fontWeight: '500',
      color: isDark ? colors.text : colors.textLight,
      marginBottom: 8,
    },
    input: {
      backgroundColor: isDark ? colors.background : colors.backgroundLight,
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      color: isDark ? colors.text : colors.textLight,
      borderWidth: 1,
      borderColor: isDark ? colors.border : colors.borderLight,
    },
    typeButtonContainer: {
      flexDirection: 'row',
      gap: 12,
    },
    typeButton: {
      flex: 1,
      padding: 14,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: isDark ? colors.border : colors.borderLight,
      backgroundColor: isDark ? colors.background : colors.backgroundLight,
      alignItems: 'center',
    },
    typeButtonActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    typeButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: isDark ? colors.text : colors.textLight,
    },
    typeButtonTextActive: {
      color: '#fff',
    },
    modalButtons: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 8,
    },
    modalButton: {
      flex: 1,
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
    },
    cancelButton: {
      backgroundColor: isDark ? colors.background : colors.backgroundLight,
      borderWidth: 1,
      borderColor: isDark ? colors.border : colors.borderLight,
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
    // Delete confirmation modal styles
    deleteModalContent: {
      backgroundColor: isDark ? colors.cardBackground : colors.card,
      borderRadius: 16,
      padding: 24,
      width: '90%',
      maxWidth: 400,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    },
    deleteModalTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: isDark ? colors.text : colors.textLight,
      marginBottom: 12,
      textAlign: 'center',
    },
    deleteModalMessage: {
      fontSize: 16,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
      marginBottom: 24,
      textAlign: 'center',
      lineHeight: 22,
    },
    deleteModalButtons: {
      flexDirection: 'row',
      gap: 12,
    },
    deleteModalButton: {
      flex: 1,
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
    },
    deleteCancelButton: {
      backgroundColor: isDark ? colors.background : colors.backgroundLight,
      borderWidth: 1,
      borderColor: isDark ? colors.border : colors.borderLight,
    },
    deleteConfirmButton: {
      backgroundColor: colors.error,
    },
    deleteModalButtonText: {
      fontSize: 16,
      fontWeight: '600',
    },
    deleteCancelButtonText: {
      color: isDark ? colors.text : colors.textLight,
    },
    deleteConfirmButtonText: {
      color: '#FFFFFF',
    },
    // Activate confirmation modal styles
    activateModalContent: {
      backgroundColor: isDark ? colors.cardBackground : colors.card,
      borderRadius: 16,
      padding: 24,
      width: '90%',
      maxWidth: 400,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    },
    activateModalTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: isDark ? colors.text : colors.textLight,
      marginBottom: 12,
      textAlign: 'center',
    },
    activateModalMessage: {
      fontSize: 16,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
      marginBottom: 24,
      textAlign: 'center',
      lineHeight: 22,
    },
    activateModalButtons: {
      flexDirection: 'row',
      gap: 12,
    },
    activateModalButton: {
      flex: 1,
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
    },
    activateCancelButton: {
      backgroundColor: isDark ? colors.background : colors.backgroundLight,
      borderWidth: 1,
      borderColor: isDark ? colors.border : colors.borderLight,
    },
    activateConfirmButton: {
      backgroundColor: colors.primary,
    },
    activateModalButtonText: {
      fontSize: 16,
      fontWeight: '600',
    },
    activateCancelButtonText: {
      color: isDark ? colors.text : colors.textLight,
    },
    activateConfirmButtonText: {
      color: '#FFFFFF',
    },
    // AIS Data Modal styles - Updated to match debug logs formatting
    aisModalContent: {
      backgroundColor: isDark ? colors.cardBackground : colors.card,
      borderRadius: 16,
      padding: 24,
      width: '90%',
      maxWidth: 500,
      maxHeight: '80%',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    },
    aisModalHeader: {
      marginBottom: 16,
    },
    aisModalTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      color: isDark ? colors.text : colors.textLight,
      marginBottom: 8,
    },
    aisModalSubtitle: {
      fontSize: 14,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
      lineHeight: 20,
    },
    aisInfoBanner: {
      flexDirection: 'row',
      backgroundColor: isDark ? 'rgba(0, 122, 255, 0.15)' : 'rgba(0, 122, 255, 0.1)',
      borderRadius: 12,
      padding: 16,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(0, 122, 255, 0.3)' : 'rgba(0, 122, 255, 0.2)',
    },
    aisInfoIcon: {
      marginRight: 12,
      marginTop: 2,
    },
    aisInfoTextContainer: {
      flex: 1,
    },
    aisInfoText: {
      fontSize: 14,
      lineHeight: 20,
      color: isDark ? colors.text : colors.textLight,
    },
    aisDataCard: {
      backgroundColor: isDark ? colors.cardBackground : colors.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: isDark ? colors.border : colors.borderLight,
    },
    aisCardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? colors.border : colors.borderLight,
    },
    aisCardTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: isDark ? colors.text : colors.textLight,
    },
    aisStatusBadge: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 6,
    },
    aisStatusText: {
      fontSize: 12,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    aisDataRow: {
      flexDirection: 'row',
      marginBottom: 10,
      alignItems: 'flex-start',
    },
    aisDataLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: isDark ? colors.text : colors.textLight,
      width: 110,
      flexShrink: 0,
    },
    aisDataValue: {
      fontSize: 13,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
      flex: 1,
    },
    aisCoordinatesContainer: {
      marginTop: 12,
      padding: 12,
      backgroundColor: isDark ? 'rgba(76, 175, 80, 0.15)' : 'rgba(76, 175, 80, 0.1)',
      borderRadius: 8,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(76, 175, 80, 0.3)' : 'rgba(76, 175, 80, 0.2)',
    },
    aisCoordinatesTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: isDark ? '#81c784' : '#2e7d32',
      marginBottom: 8,
    },
    aisCoordinatesText: {
      fontSize: 12,
      color: isDark ? '#a5d6a7' : '#388e3c',
      marginBottom: 4,
      fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    },
    aisCloseButton: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
      marginTop: 8,
    },
    aisCloseButtonText: {
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
  const [checkingAIS, setCheckingAIS] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [activateModalVisible, setActivateModalVisible] = useState(false);
  const [aisModalVisible, setAisModalVisible] = useState(false);
  const [aisData, setAisData] = useState<AISData | null>(null);
  const [activateModalMessage, setActivateModalMessage] = useState('');
  const [editForm, setEditForm] = useState({
    vessel_name: '',
    flag: '',
    official_number: '',
    vessel_type: '',
    length_metres: '',
    gross_tonnes: '',
    callsign: '',
  });
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
      console.log('[VesselDetailScreen] Vessel loaded:', currentVessel.vessel_name, 'MMSI:', currentVessel.mmsi);

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

  const handleEditParticulars = () => {
    console.log('[VesselDetailScreen] User tapped Edit Particulars button');
    if (!vessel) {
      console.error('[VesselDetailScreen] No vessel data available');
      return;
    }
    
    // Pre-fill the form with current values
    setEditForm({
      vessel_name: vessel.vessel_name || '',
      flag: vessel.flag || '',
      official_number: vessel.official_number || '',
      vessel_type: vessel.vessel_type || '',
      length_metres: vessel.length_metres?.toString() || '',
      gross_tonnes: vessel.gross_tonnes?.toString() || '',
      callsign: vessel.callsign || '',
    });
    
    setEditModalVisible(true);
  };

  const handleSaveParticulars = async () => {
    console.log('[VesselDetailScreen] User tapped Save button in edit modal');
    if (!vessel) {
      console.error('[VesselDetailScreen] No vessel data available');
      return;
    }

    try {
      // Prepare the update payload
      const updates: any = {};
      
      if (editForm.vessel_name.trim()) updates.vessel_name = editForm.vessel_name.trim();
      if (editForm.flag.trim()) updates.flag = editForm.flag.trim();
      if (editForm.official_number.trim()) updates.official_number = editForm.official_number.trim();
      if (editForm.vessel_type.trim()) updates.type = editForm.vessel_type.trim();
      if (editForm.callsign.trim()) updates.callsign = editForm.callsign.trim();
      if (editForm.length_metres.trim()) {
        const length = parseFloat(editForm.length_metres);
        if (!isNaN(length) && length > 0) {
          updates.length_metres = length;
        }
      }
      if (editForm.gross_tonnes.trim()) {
        const tonnes = parseFloat(editForm.gross_tonnes);
        if (!isNaN(tonnes) && tonnes > 0) {
          updates.gross_tonnes = tonnes;
        }
      }

      console.log('[VesselDetailScreen] Updating vessel particulars:', updates);
      
      await seaTimeApi.updateVesselParticulars(vessel.id, updates);
      
      setEditModalVisible(false);
      Alert.alert('Success', 'Vessel particulars updated successfully');
      await loadData();
    } catch (error: any) {
      console.error('[VesselDetailScreen] Failed to update vessel particulars:', error);
      
      // Check if it's an authentication error
      if (error.message && (error.message.includes('401') || error.message.includes('Unauthorized') || error.message.includes('authentication'))) {
        Alert.alert(
          'Authentication Required',
          'You need to sign in to edit vessel particulars. Please go to the Profile tab and sign in.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Go to Profile',
              onPress: () => {
                setEditModalVisible(false);
                router.push('/(tabs)/profile');
              },
            },
          ]
        );
      } else {
        Alert.alert('Error', 'Failed to update vessel particulars. Please try again.');
      }
    }
  };

  const handleActivateVessel = async () => {
    console.log('[VesselDetailScreen] User tapped Activate Vessel button');
    
    if (!vessel) {
      console.error('[VesselDetailScreen] No vessel data available');
      return;
    }

    try {
      const vessels = await seaTimeApi.getVessels();
      const activeVessel = vessels.find(v => v.is_active);
      
      const message = activeVessel 
        ? `Start tracking ${vessel.vessel_name}? This will deactivate ${activeVessel.vessel_name}.`
        : `Start tracking ${vessel.vessel_name}? The app will monitor this vessel's AIS data.`;

      console.log('[VesselDetailScreen] Opening activate confirmation modal');
      setActivateModalMessage(message);
      setActivateModalVisible(true);
    } catch (error: any) {
      console.error('[VesselDetailScreen] Error checking active vessels:', error);
      Alert.alert('Error', 'Failed to check active vessels: ' + error.message);
    }
  };

  const confirmActivateVessel = async () => {
    console.log('[VesselDetailScreen] User confirmed vessel activation');
    
    if (!vessel) {
      console.error('[VesselDetailScreen] No vessel data available');
      return;
    }

    try {
      console.log('[VesselDetailScreen] Activating vessel:', vessel.id);
      setActivateModalVisible(false);
      await seaTimeApi.activateVessel(vessel.id);
      await loadData();
      Alert.alert('Success', `${vessel.vessel_name} is now being tracked`);
    } catch (error: any) {
      console.error('[VesselDetailScreen] Failed to activate vessel:', error);
      Alert.alert('Error', 'Failed to activate vessel: ' + error.message);
    }
  };

  const cancelActivateVessel = () => {
    console.log('[VesselDetailScreen] User cancelled vessel activation');
    setActivateModalVisible(false);
  };

  const handleCheckAIS = async () => {
    if (!vessel) {
      console.error('[VesselDetailScreen] No vessel data available');
      return;
    }

    if (!vessel.is_active) {
      Alert.alert('Vessel Not Active', 'Please activate the vessel first before checking AIS data.');
      return;
    }

    // Prevent double-taps
    if (checkingAIS) {
      console.log('[VesselDetailScreen] AIS check already in progress, ignoring duplicate tap');
      return;
    }

    try {
      // Haptic feedback
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }

      console.log('[VesselDetailScreen] 🔍 CHECK AIS BUTTON CLICKED');
      console.log('[VesselDetailScreen] Using vessel from particulars:');
      console.log('[VesselDetailScreen] - Vessel ID:', vessel.id);
      console.log('[VesselDetailScreen] - Vessel Name:', vessel.vessel_name);
      console.log('[VesselDetailScreen] - MMSI:', vessel.mmsi);
      console.log('[VesselDetailScreen] - Call Sign:', vessel.callsign || 'Not set');
      console.log('[VesselDetailScreen] Calling checkVesselAIS with vessel ID:', vessel.id);
      console.log('[VesselDetailScreen] Backend will look up MMSI from database for this vessel ID');
      
      setCheckingAIS(true);
      const result = await seaTimeApi.checkVesselAIS(vessel.id);
      
      console.log('[VesselDetailScreen] ✅ AIS check completed successfully');
      console.log('[VesselDetailScreen] Result:', result);
      
      // Success haptic feedback
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      // Store AIS data and show modal
      setAisData(result);
      setAisModalVisible(true);
      
      // Reload data to get any updated vessel information (like callsign from AIS)
      console.log('[VesselDetailScreen] Reloading vessel data to get any AIS updates...');
      await loadData();
    } catch (error: any) {
      console.error('[VesselDetailScreen] ❌ AIS check failed:', error);
      
      // Error haptic feedback
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }

      Alert.alert('AIS Check Failed', error.message);
    } finally {
      setCheckingAIS(false);
    }
  };

  const handleDeleteVessel = () => {
    console.log('[VesselDetailScreen] 🔴 DELETE BUTTON CLICKED - handleDeleteVessel called');
    
    if (!vessel) {
      console.error('[VesselDetailScreen] No vessel data available for deletion');
      return;
    }

    console.log('[VesselDetailScreen] Vessel to delete:', vessel.id, vessel.vessel_name);
    console.log('[VesselDetailScreen] Opening delete confirmation modal...');
    
    // Show custom modal instead of Alert.alert (which doesn't work on web)
    setDeleteModalVisible(true);
  };

  const confirmDeleteVessel = async () => {
    console.log('[VesselDetailScreen] 🔴 User confirmed deletion - calling deleteVessel API');
    
    if (!vessel) {
      console.error('[VesselDetailScreen] No vessel data available for deletion');
      return;
    }

    try {
      console.log('[VesselDetailScreen] Calling seaTimeApi.deleteVessel with ID:', vessel.id);
      setDeleteModalVisible(false);
      await seaTimeApi.deleteVessel(vessel.id);
      console.log('[VesselDetailScreen] ✅ Delete API call successful');
      Alert.alert('Success', 'Vessel deleted successfully');
      router.back();
    } catch (error: any) {
      console.error('[VesselDetailScreen] ❌ Failed to delete vessel:', error);
      console.error('[VesselDetailScreen] Error message:', error.message);
      console.error('[VesselDetailScreen] Error stack:', error.stack);
      Alert.alert('Error', 'Failed to delete vessel: ' + error.message);
    }
  };

  const cancelDeleteVessel = () => {
    console.log('[VesselDetailScreen] User cancelled deletion');
    setDeleteModalVisible(false);
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

  const formatAISValue = (value: any, suffix: string = ''): string => {
    if (value === null || value === undefined) return 'Unknown';
    return `${value}${suffix}`;
  };

  const formatCoordinates = (lat: number | null, lon: number | null): string => {
    if (lat === null || lon === null) return 'Unknown';
    return `${lat.toFixed(6)}°, ${lon.toFixed(6)}°`;
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

        {/* Vessel Particulars Section */}
        <View style={styles.particularsCard}>
          <View style={styles.particularsHeader}>
            <View style={styles.particularsHeaderLeft}>
              <IconSymbol
                ios_icon_name="info.circle.fill"
                android_material_icon_name="info"
                size={20}
                color={colors.primary}
              />
              <Text style={styles.particularsTitle}>Vessel Particulars</Text>
            </View>
            <TouchableOpacity 
              style={styles.editButton}
              onPress={handleEditParticulars}
            >
              <IconSymbol
                ios_icon_name="pencil"
                android_material_icon_name="edit"
                size={14}
                color="#FFFFFF"
              />
              <Text style={styles.editButtonText}>Edit</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.particularRow}>
            <Text style={styles.particularLabel}>Call Sign</Text>
            <Text style={vessel.callsign ? styles.particularValue : styles.particularValueEmpty}>
              {vessel.callsign || 'Not specified'}
            </Text>
          </View>
          
          <View style={styles.particularRow}>
            <Text style={styles.particularLabel}>Flag</Text>
            <Text style={vessel.flag ? styles.particularValue : styles.particularValueEmpty}>
              {vessel.flag || 'Not specified'}
            </Text>
          </View>
          
          <View style={styles.particularRow}>
            <Text style={styles.particularLabel}>Official No.</Text>
            <Text style={vessel.official_number ? styles.particularValue : styles.particularValueEmpty}>
              {vessel.official_number || 'Not specified'}
            </Text>
          </View>
          
          <View style={styles.particularRow}>
            <Text style={styles.particularLabel}>Type</Text>
            <Text style={vessel.vessel_type ? styles.particularValue : styles.particularValueEmpty}>
              {vessel.vessel_type || 'Not specified'}
            </Text>
          </View>
          
          <View style={styles.particularRow}>
            <Text style={styles.particularLabel}>Length</Text>
            <Text style={vessel.length_metres ? styles.particularValue : styles.particularValueEmpty}>
              {vessel.length_metres ? `${vessel.length_metres} m` : 'Not specified'}
            </Text>
          </View>
          
          <View style={[styles.particularRow, styles.particularRowLast]}>
            <Text style={styles.particularLabel}>Gross Tonnes</Text>
            <Text style={vessel.gross_tonnes ? styles.particularValue : styles.particularValueEmpty}>
              {vessel.gross_tonnes ? `${vessel.gross_tonnes} GT` : 'Not specified'}
            </Text>
          </View>
        </View>

        {/* Activate Button - Only show for inactive vessels */}
        {!vessel.is_active && (
          <TouchableOpacity
            style={styles.activateButton}
            onPress={handleActivateVessel}
          >
            <IconSymbol
              ios_icon_name="play.circle"
              android_material_icon_name="play-circle-filled"
              size={20}
              color="#fff"
            />
            <Text style={styles.activateButtonText}>Activate Vessel</Text>
          </TouchableOpacity>
        )}

        {/* Check AIS Button */}
        <TouchableOpacity
          style={[
            styles.checkAISButton,
            (!vessel.is_active || checkingAIS) && styles.checkAISButtonDisabled
          ]}
          onPress={handleCheckAIS}
          disabled={!vessel.is_active || checkingAIS}
        >
          {checkingAIS ? (
            <>
              <ActivityIndicator size="small" color="#fff" />
              <Text style={styles.checkAISButtonText}>Checking AIS...</Text>
            </>
          ) : (
            <>
              <IconSymbol
                ios_icon_name="location.circle"
                android_material_icon_name="my-location"
                size={20}
                color="#fff"
              />
              <Text style={styles.checkAISButtonText}>
                {vessel.is_active ? 'Check AIS' : 'Activate Vessel to Check AIS'}
              </Text>
            </>
          )}
        </TouchableOpacity>

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
              {vessel.is_active 
                ? 'Check AIS data to start tracking.'
                : 'Activate this vessel and check AIS data to start tracking.'}
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

        {/* Delete Vessel Button - At the bottom like logout button */}
        <TouchableOpacity 
          style={styles.deleteButton} 
          onPress={handleDeleteVessel}
        >
          <Text style={styles.deleteButtonText}>Delete Vessel</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Edit Particulars Modal */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setEditModalVisible(false)}
          >
            <TouchableOpacity
              activeOpacity={1}
              onPress={(e) => e.stopPropagation()}
              style={styles.modalContent}
            >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Edit Vessel Particulars</Text>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => setEditModalVisible(false)}
                >
                  <IconSymbol
                    ios_icon_name="xmark.circle.fill"
                    android_material_icon_name="cancel"
                    size={28}
                    color={isDark ? colors.textSecondary : colors.textSecondaryLight}
                  />
                </TouchableOpacity>
              </View>

              <ScrollView style={{ maxHeight: 400 }} contentContainerStyle={styles.modalScrollContent}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Vessel Name</Text>
                  <TextInput
                    style={styles.input}
                    value={editForm.vessel_name}
                    onChangeText={(text) => setEditForm({ ...editForm, vessel_name: text })}
                    placeholder="e.g., My Yacht"
                    placeholderTextColor={isDark ? colors.textSecondary : colors.textSecondaryLight}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Call Sign</Text>
                  <TextInput
                    style={styles.input}
                    value={editForm.callsign}
                    onChangeText={(text) => setEditForm({ ...editForm, callsign: text })}
                    placeholder="e.g., GBAA"
                    placeholderTextColor={isDark ? colors.textSecondary : colors.textSecondaryLight}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Flag</Text>
                  <TextInput
                    style={styles.input}
                    value={editForm.flag}
                    onChangeText={(text) => setEditForm({ ...editForm, flag: text })}
                    placeholder="e.g., United Kingdom"
                    placeholderTextColor={isDark ? colors.textSecondary : colors.textSecondaryLight}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Official Number</Text>
                  <TextInput
                    style={styles.input}
                    value={editForm.official_number}
                    onChangeText={(text) => setEditForm({ ...editForm, official_number: text })}
                    placeholder="e.g., 123456"
                    placeholderTextColor={isDark ? colors.textSecondary : colors.textSecondaryLight}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Type (Motor/Sail)</Text>
                  <View style={styles.typeButtonContainer}>
                    <TouchableOpacity
                      style={[
                        styles.typeButton,
                        editForm.vessel_type === 'Motor' && styles.typeButtonActive
                      ]}
                      onPress={() => setEditForm({ ...editForm, vessel_type: 'Motor' })}
                    >
                      <Text style={[
                        styles.typeButtonText,
                        editForm.vessel_type === 'Motor' && styles.typeButtonTextActive
                      ]}>
                        Motor
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.typeButton,
                        editForm.vessel_type === 'Sail' && styles.typeButtonActive
                      ]}
                      onPress={() => setEditForm({ ...editForm, vessel_type: 'Sail' })}
                    >
                      <Text style={[
                        styles.typeButtonText,
                        editForm.vessel_type === 'Sail' && styles.typeButtonTextActive
                      ]}>
                        Sail
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Length (metres)</Text>
                  <TextInput
                    style={styles.input}
                    value={editForm.length_metres}
                    onChangeText={(text) => setEditForm({ ...editForm, length_metres: text })}
                    placeholder="e.g., 150"
                    keyboardType="decimal-pad"
                    placeholderTextColor={isDark ? colors.textSecondary : colors.textSecondaryLight}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Gross Tonnes</Text>
                  <TextInput
                    style={styles.input}
                    value={editForm.gross_tonnes}
                    onChangeText={(text) => setEditForm({ ...editForm, gross_tonnes: text })}
                    placeholder="e.g., 5000"
                    keyboardType="decimal-pad"
                    placeholderTextColor={isDark ? colors.textSecondary : colors.textSecondaryLight}
                  />
                </View>
              </ScrollView>

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => setEditModalVisible(false)}
                >
                  <Text style={[styles.modalButtonText, styles.cancelButtonText]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.saveButton]}
                  onPress={handleSaveParticulars}
                >
                  <Text style={[styles.modalButtonText, styles.saveButtonText]}>Save</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {/* Activate Confirmation Modal */}
      <Modal
        visible={activateModalVisible}
        transparent
        animationType="fade"
        onRequestClose={cancelActivateVessel}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={cancelActivateVessel}
          >
            <TouchableOpacity
              activeOpacity={1}
              onPress={(e) => e.stopPropagation()}
              style={styles.activateModalContent}
            >
              <Text style={styles.activateModalTitle}>Activate Vessel</Text>
              <Text style={styles.activateModalMessage}>
                {activateModalMessage}
              </Text>
              <View style={styles.activateModalButtons}>
                <TouchableOpacity
                  style={[styles.activateModalButton, styles.activateCancelButton]}
                  onPress={cancelActivateVessel}
                >
                  <Text style={[styles.activateModalButtonText, styles.activateCancelButtonText]}>
                    Cancel
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.activateModalButton, styles.activateConfirmButton]}
                  onPress={confirmActivateVessel}
                >
                  <Text style={[styles.activateModalButtonText, styles.activateConfirmButtonText]}>
                    Activate
                  </Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={deleteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={cancelDeleteVessel}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={cancelDeleteVessel}
          >
            <TouchableOpacity
              activeOpacity={1}
              onPress={(e) => e.stopPropagation()}
              style={styles.deleteModalContent}
            >
              <Text style={styles.deleteModalTitle}>Delete Vessel</Text>
              <Text style={styles.deleteModalMessage}>
                Are you sure you want to delete {vessel?.vessel_name}? This will also delete all associated sea time entries. This action cannot be undone.
              </Text>
              <View style={styles.deleteModalButtons}>
                <TouchableOpacity
                  style={[styles.deleteModalButton, styles.deleteCancelButton]}
                  onPress={cancelDeleteVessel}
                >
                  <Text style={[styles.deleteModalButtonText, styles.deleteCancelButtonText]}>
                    Cancel
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.deleteModalButton, styles.deleteConfirmButton]}
                  onPress={confirmDeleteVessel}
                >
                  <Text style={[styles.deleteModalButtonText, styles.deleteConfirmButtonText]}>
                    Delete
                  </Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* AIS Data Modal - Updated to match debug logs formatting */}
      <Modal
        visible={aisModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAisModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setAisModalVisible(false)}
          >
            <TouchableOpacity
              activeOpacity={1}
              onPress={(e) => e.stopPropagation()}
              style={styles.aisModalContent}
            >
              <View style={styles.aisModalHeader}>
                <Text style={styles.aisModalTitle}>Current AIS Data</Text>
                <Text style={styles.aisModalSubtitle}>
                  Real-time vessel position and navigation information
                </Text>
              </View>

              <View style={styles.aisInfoBanner}>
                <IconSymbol
                  ios_icon_name="info.circle.fill"
                  android_material_icon_name="info"
                  size={24}
                  color={colors.primary}
                  style={styles.aisInfoIcon}
                />
                <View style={styles.aisInfoTextContainer}>
                  <Text style={styles.aisInfoText}>
                    This data is retrieved from the MyShipTracking AIS service and shows the vessel&apos;s current status and location.
                  </Text>
                </View>
              </View>

              <ScrollView style={{ maxHeight: 400 }} contentContainerStyle={styles.modalScrollContent}>
                {/* Vessel Information Card */}
                <View style={styles.aisDataCard}>
                  <View style={styles.aisCardHeader}>
                    <Text style={styles.aisCardTitle}>Vessel Information</Text>
                    <View
                      style={[
                        styles.aisStatusBadge,
                        { backgroundColor: aisData?.is_moving ? colors.success : colors.warning },
                      ]}
                    >
                      <Text style={styles.aisStatusText}>
                        {aisData?.is_moving ? 'MOVING' : 'STATIONARY'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.aisDataRow}>
                    <Text style={styles.aisDataLabel}>Name:</Text>
                    <Text style={styles.aisDataValue}>{formatAISValue(aisData?.name)}</Text>
                  </View>

                  <View style={styles.aisDataRow}>
                    <Text style={styles.aisDataLabel}>MMSI:</Text>
                    <Text style={styles.aisDataValue}>{formatAISValue(aisData?.mmsi)}</Text>
                  </View>

                  <View style={styles.aisDataRow}>
                    <Text style={styles.aisDataLabel}>IMO:</Text>
                    <Text style={styles.aisDataValue}>{formatAISValue(aisData?.imo)}</Text>
                  </View>

                  <View style={styles.aisDataRow}>
                    <Text style={styles.aisDataLabel}>Call Sign:</Text>
                    <Text style={styles.aisDataValue}>{formatAISValue(aisData?.callsign)}</Text>
                  </View>

                  <View style={styles.aisDataRow}>
                    <Text style={styles.aisDataLabel}>Flag:</Text>
                    <Text style={styles.aisDataValue}>{formatAISValue(aisData?.flag)}</Text>
                  </View>

                  <View style={styles.aisDataRow}>
                    <Text style={styles.aisDataLabel}>Ship Type:</Text>
                    <Text style={styles.aisDataValue}>{formatAISValue(aisData?.ship_type)}</Text>
                  </View>
                </View>

                {/* Position & Navigation Card */}
                <View style={styles.aisDataCard}>
                  <View style={styles.aisCardHeader}>
                    <Text style={styles.aisCardTitle}>Position & Navigation</Text>
                  </View>

                  <View style={styles.aisDataRow}>
                    <Text style={styles.aisDataLabel}>Speed:</Text>
                    <Text style={styles.aisDataValue}>{formatAISValue(aisData?.speed_knots, ' knots')}</Text>
                  </View>

                  <View style={styles.aisDataRow}>
                    <Text style={styles.aisDataLabel}>Course:</Text>
                    <Text style={styles.aisDataValue}>{formatAISValue(aisData?.course, '°')}</Text>
                  </View>

                  <View style={styles.aisDataRow}>
                    <Text style={styles.aisDataLabel}>Heading:</Text>
                    <Text style={styles.aisDataValue}>{formatAISValue(aisData?.heading, '°')}</Text>
                  </View>

                  {aisData?.latitude !== null && aisData?.longitude !== null && (
                    <View style={styles.aisCoordinatesContainer}>
                      <Text style={styles.aisCoordinatesTitle}>📍 Vessel Position</Text>
                      <Text style={styles.aisCoordinatesText}>
                        Latitude: {aisData.latitude.toFixed(6)}°
                      </Text>
                      <Text style={styles.aisCoordinatesText}>
                        Longitude: {aisData.longitude.toFixed(6)}°
                      </Text>
                    </View>
                  )}
                </View>

                {/* Voyage Information Card */}
                <View style={styles.aisDataCard}>
                  <View style={styles.aisCardHeader}>
                    <Text style={styles.aisCardTitle}>Voyage Information</Text>
                  </View>

                  <View style={styles.aisDataRow}>
                    <Text style={styles.aisDataLabel}>Status:</Text>
                    <Text style={styles.aisDataValue}>{formatAISValue(aisData?.status)}</Text>
                  </View>

                  <View style={styles.aisDataRow}>
                    <Text style={styles.aisDataLabel}>Destination:</Text>
                    <Text style={styles.aisDataValue}>{formatAISValue(aisData?.destination)}</Text>
                  </View>

                  <View style={styles.aisDataRow}>
                    <Text style={styles.aisDataLabel}>ETA:</Text>
                    <Text style={styles.aisDataValue}>{formatAISValue(aisData?.eta)}</Text>
                  </View>

                  {aisData?.timestamp && (
                    <View style={styles.aisDataRow}>
                      <Text style={styles.aisDataLabel}>Last Updated:</Text>
                      <Text style={styles.aisDataValue}>
                        {new Date(aisData.timestamp).toLocaleString()}
                      </Text>
                    </View>
                  )}
                </View>
              </ScrollView>

              <TouchableOpacity
                style={styles.aisCloseButton}
                onPress={() => setAisModalVisible(false)}
              >
                <Text style={styles.aisCloseButtonText}>Close</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

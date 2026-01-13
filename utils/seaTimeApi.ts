
import Constants from 'expo-constants';

const API_BASE_URL = Constants.expoConfig?.extra?.backendUrl || '';

// MyShipTracking API key - Replace with your actual API key
// Get your API key from: https://www.myshiptracking.com/
const MYSHIPTRACKING_API_KEY = 'YOUR_MYSHIPTRACKING_API_KEY_HERE';

// Log the backend URL for debugging
console.log('[SeaTimeAPI] Backend URL configured:', API_BASE_URL);
console.log('[SeaTimeAPI] MyShipTracking API key configured:', MYSHIPTRACKING_API_KEY !== 'YOUR_MYSHIPTRACKING_API_KEY_HERE');

export interface Vessel {
  id: string;
  mmsi: string;
  vessel_name: string;
  is_active: boolean;
  created_at: string;
}

export interface SeaTimeEntry {
  id: string;
  vessel: Vessel;
  start_time: string;
  end_time: string | null;
  duration_hours: number | null;
  status: 'pending' | 'confirmed' | 'rejected';
  notes: string | null;
  created_at: string;
}

export interface AISCheckResult {
  check_id: string;
  is_moving: boolean;
  speed_knots: number;
  latitude: number;
  longitude: number;
  sea_time_entry_created: boolean;
}

export interface ReportSummary {
  total_hours: number;
  total_days: number;
  entries_by_vessel: {
    vessel_name: string;
    total_hours: number;
  }[];
  entries_by_month: {
    month: string;
    total_hours: number;
  }[];
}

// Helper function to check if backend is configured
function checkBackendConfigured() {
  if (!API_BASE_URL) {
    throw new Error('Backend URL not configured. Please rebuild the app or check app.json configuration.');
  }
}

// Helper function to get API headers (no API key - backend handles that)
function getApiHeaders(): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  
  return headers;
}

// Vessel Management
export async function getVessels(): Promise<Vessel[]> {
  checkBackendConfigured();
  const url = `${API_BASE_URL}/api/vessels`;
  console.log('[API] Fetching vessels:', url);
  const headers = getApiHeaders();
  const response = await fetch(url, { headers });
  if (!response.ok) {
    const errorText = await response.text();
    console.error('[API] Failed to fetch vessels:', response.status, errorText);
    throw new Error('Failed to fetch vessels');
  }
  const data = await response.json();
  console.log('[API] Vessels fetched:', data.length);
  return data;
}

export async function createVessel(mmsi: string, vessel_name: string, is_active?: boolean): Promise<Vessel> {
  checkBackendConfigured();
  const url = `${API_BASE_URL}/api/vessels`;
  console.log('[API] Creating vessel:', { mmsi, vessel_name, is_active });
  const headers = getApiHeaders();
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ mmsi, vessel_name, is_active }),
  });
  if (!response.ok) {
    const errorText = await response.text();
    console.error('[API] Failed to create vessel:', response.status, errorText);
    throw new Error('Failed to create vessel');
  }
  const data = await response.json();
  console.log('[API] Vessel created:', data);
  return data;
}

export async function activateVessel(vesselId: string): Promise<Vessel> {
  checkBackendConfigured();
  const url = `${API_BASE_URL}/api/vessels/${vesselId}/activate`;
  console.log('[API] Activating vessel:', vesselId);
  const headers = getApiHeaders();
  const response = await fetch(url, {
    method: 'PUT',
    headers,
    body: JSON.stringify({}),
  });
  if (!response.ok) {
    const errorText = await response.text();
    console.error('[API] Failed to activate vessel:', response.status, errorText);
    throw new Error('Failed to activate vessel');
  }
  const data = await response.json();
  console.log('[API] Vessel activated:', data);
  return data;
}

export async function deleteVessel(vesselId: string): Promise<{ success: boolean }> {
  checkBackendConfigured();
  const url = `${API_BASE_URL}/api/vessels/${vesselId}`;
  console.log('[API] Deleting vessel:', vesselId);
  const response = await fetch(url, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const errorText = await response.text();
    console.error('[API] Failed to delete vessel:', response.status, errorText);
    throw new Error('Failed to delete vessel');
  }
  console.log('[API] Vessel deleted successfully');
  return { success: true };
}

export async function getVesselSeaTime(vesselId: string): Promise<SeaTimeEntry[]> {
  checkBackendConfigured();
  const url = `${API_BASE_URL}/api/vessels/${vesselId}/sea-time`;
  console.log('[API] Fetching sea time for vessel:', vesselId);
  const headers = getApiHeaders();
  const response = await fetch(url, { headers });
  if (!response.ok) {
    const errorText = await response.text();
    console.error('[API] Failed to fetch vessel sea time:', response.status, errorText);
    throw new Error('Failed to fetch vessel sea time');
  }
  const data = await response.json();
  console.log('[API] Vessel sea time entries fetched:', data.length);
  return data;
}

// AIS Tracking
export async function checkVesselAIS(vesselId: string): Promise<AISCheckResult> {
  checkBackendConfigured();
  const url = `${API_BASE_URL}/api/ais/check/${vesselId}`;
  console.log('[API] Checking vessel AIS:', vesselId);
  const headers = getApiHeaders();
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({}),
  });
  if (!response.ok) {
    const errorText = await response.text();
    console.error('[API] Failed to check vessel AIS:', response.status, errorText);
    
    // Provide more helpful error messages
    if (response.status === 500 && errorText.includes('API key not configured')) {
      throw new Error('MyShipTracking API key not configured. Please contact the developer.');
    }
    if (response.status === 502) {
      throw new Error('Failed to connect to MyShipTracking API. Please try again later.');
    }
    
    throw new Error('Failed to check vessel AIS');
  }
  const data = await response.json();
  console.log('[API] AIS check result:', data);
  return data;
}

export interface AISStatus {
  is_moving: boolean;
  current_check: any;
  recent_checks: any[];
}

export async function getVesselAISStatus(vesselId: string): Promise<AISStatus> {
  checkBackendConfigured();
  const url = `${API_BASE_URL}/api/ais/status/${vesselId}`;
  console.log('[API] Getting vessel AIS status:', vesselId);
  const headers = getApiHeaders();
  const response = await fetch(url, { headers });
  if (!response.ok) {
    const errorText = await response.text();
    console.error('[API] Failed to get vessel AIS status:', response.status, errorText);
    throw new Error('Failed to get vessel AIS status');
  }
  const data = await response.json();
  console.log('[API] AIS status:', data);
  return data;
}

// Sea Time Management
export async function getSeaTimeEntries(): Promise<SeaTimeEntry[]> {
  checkBackendConfigured();
  const url = `${API_BASE_URL}/api/sea-time`;
  console.log('[API] Fetching sea time entries:', url);
  const headers = getApiHeaders();
  const response = await fetch(url, { headers });
  if (!response.ok) {
    const errorText = await response.text();
    console.error('[API] Failed to fetch sea time entries:', response.status, errorText);
    throw new Error('Failed to fetch sea time entries');
  }
  const data = await response.json();
  console.log('[API] Sea time entries fetched:', data.length);
  return data;
}

export async function getPendingEntries(): Promise<SeaTimeEntry[]> {
  checkBackendConfigured();
  const url = `${API_BASE_URL}/api/sea-time/pending`;
  console.log('[API] Fetching pending entries:', url);
  const headers = getApiHeaders();
  const response = await fetch(url, { headers });
  if (!response.ok) {
    const errorText = await response.text();
    console.error('[API] Failed to fetch pending entries:', response.status, errorText);
    throw new Error('Failed to fetch pending entries');
  }
  const data = await response.json();
  console.log('[API] Pending entries fetched:', data.length);
  return data;
}

export async function confirmSeaTimeEntry(entryId: string, notes?: string): Promise<SeaTimeEntry> {
  checkBackendConfigured();
  const url = `${API_BASE_URL}/api/sea-time/${entryId}/confirm`;
  console.log('[API] Confirming sea time entry:', entryId, notes);
  const headers = getApiHeaders();
  const response = await fetch(url, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ notes: notes || undefined }),
  });
  if (!response.ok) {
    const errorText = await response.text();
    console.error('[API] Failed to confirm entry:', response.status, errorText);
    throw new Error('Failed to confirm entry');
  }
  const data = await response.json();
  console.log('[API] Entry confirmed:', data);
  return data;
}

export async function rejectSeaTimeEntry(entryId: string, notes?: string): Promise<SeaTimeEntry> {
  checkBackendConfigured();
  const url = `${API_BASE_URL}/api/sea-time/${entryId}/reject`;
  console.log('[API] Rejecting sea time entry:', entryId, notes);
  const headers = getApiHeaders();
  const response = await fetch(url, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ notes: notes || undefined }),
  });
  if (!response.ok) {
    const errorText = await response.text();
    console.error('[API] Failed to reject entry:', response.status, errorText);
    throw new Error('Failed to reject entry');
  }
  const data = await response.json();
  console.log('[API] Entry rejected:', data);
  return data;
}

export async function deleteSeaTimeEntry(entryId: string): Promise<{ success: boolean }> {
  checkBackendConfigured();
  const url = `${API_BASE_URL}/api/sea-time/${entryId}`;
  console.log('[API] Deleting sea time entry:', entryId);
  const headers = getApiHeaders();
  const response = await fetch(url, {
    method: 'DELETE',
    headers,
    body: JSON.stringify({}),
  });
  if (!response.ok) {
    const errorText = await response.text();
    console.error('[API] Failed to delete entry:', response.status, errorText);
    throw new Error('Failed to delete entry');
  }
  const data = await response.json();
  console.log('[API] Entry deleted:', data);
  return data;
}

// Reports
export async function getReportSummary(startDate?: string, endDate?: string): Promise<ReportSummary> {
  checkBackendConfigured();
  const params = new URLSearchParams();
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);
  
  const url = `${API_BASE_URL}/api/reports/summary${params.toString() ? '?' + params.toString() : ''}`;
  console.log('[API] Fetching report summary:', url);
  const headers = getApiHeaders();
  const response = await fetch(url, { headers });
  if (!response.ok) {
    const errorText = await response.text();
    console.error('[API] Failed to fetch report summary:', response.status, errorText);
    throw new Error('Failed to fetch report summary');
  }
  return response.json();
}

export async function downloadCSVReport(startDate?: string, endDate?: string): Promise<string> {
  checkBackendConfigured();
  const params = new URLSearchParams();
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);
  
  const url = `${API_BASE_URL}/api/reports/csv${params.toString() ? '?' + params.toString() : ''}`;
  console.log('[API] Downloading CSV report:', url);
  const headers = getApiHeaders();
  const response = await fetch(url, { headers });
  if (!response.ok) {
    const errorText = await response.text();
    console.error('[API] Failed to download CSV report:', response.status, errorText);
    throw new Error('Failed to download CSV report');
  }
  return response.text();
}
</write file>

Now let me fix the main issue - the card layout that's preventing the delete button from working. The problem is that the delete button's `onPress` is being blocked by the parent `TouchableOpacity`. I'll restructure the card to separate the clickable area from the action buttons:

<write file="app/(tabs)/(home)/index.tsx">
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  useColorScheme,
  RefreshControl,
  Platform,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
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

export default function SeaTimeScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const [vessels, setVessels] = useState<Vessel[]>([]);
  const [seaTimeEntries, setSeaTimeEntries] = useState<SeaTimeEntry[]>([]);
  const [pendingEntries, setPendingEntries] = useState<SeaTimeEntry[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  
  // Add vessel modal
  const [showAddVessel, setShowAddVessel] = useState(false);
  const [newMMSI, setNewMMSI] = useState('');
  const [newVesselName, setNewVesselName] = useState('');
  const [setAsActive, setSetAsActive] = useState(true);
  
  // Confirm entry modal
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<SeaTimeEntry | null>(null);
  const [confirmNotes, setConfirmNotes] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      console.log('[SeaTime] Loading data from backend...');
      
      // Load vessels
      const vesselsData = await seaTimeApi.getVessels();
      console.log('[SeaTime] Loaded vessels:', vesselsData);
      setVessels(vesselsData);
      
      // Load all sea time entries
      const entriesData = await seaTimeApi.getSeaTimeEntries();
      console.log('[SeaTime] Loaded sea time entries:', entriesData);
      setSeaTimeEntries(entriesData);
      
      // Load pending entries
      const pendingData = await seaTimeApi.getPendingEntries();
      console.log('[SeaTime] Loaded pending entries:', pendingData);
      setPendingEntries(pendingData);
    } catch (error) {
      console.error('[SeaTime] Error loading data:', error);
      Alert.alert('Error', 'Failed to load data. Please check your connection and try again.');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleAddVessel = async () => {
    if (!newMMSI.trim() || !newVesselName.trim()) {
      Alert.alert('Error', 'Please enter both MMSI and vessel name');
      return;
    }

    try {
      console.log('[SeaTime] Adding vessel:', { mmsi: newMMSI, vessel_name: newVesselName, is_active: setAsActive });
      
      const newVessel = await seaTimeApi.createVessel(newMMSI.trim(), newVesselName.trim(), setAsActive);
      console.log('[SeaTime] Vessel created:', newVessel);
      
      setShowAddVessel(false);
      setNewMMSI('');
      setNewVesselName('');
      setSetAsActive(true);
      await loadData();
      
      if (setAsActive) {
        Alert.alert('Success', `${newVesselName.trim()} is now your active vessel and will be tracked automatically.`);
      } else {
        Alert.alert('Success', 'Vessel added successfully as historic vessel.');
      }
    } catch (error) {
      console.error('[SeaTime] Error adding vessel:', error);
      Alert.alert('Error', 'Failed to add vessel. Please try again.');
    }
  };

  const handleActivateVessel = async (vesselId: string, vesselName: string) => {
    console.log('[SeaTime] User tapped Set as Active button for vessel:', vesselId, vesselName);
    
    Alert.alert(
      'Set Active Vessel',
      `Set "${vesselName}" as your active vessel? This will automatically track its sea time.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Set Active',
          onPress: async () => {
            try {
              console.log('[SeaTime] Activating vessel:', vesselId);
              
              await seaTimeApi.activateVessel(vesselId);
              console.log('[SeaTime] Vessel activated successfully');
              
              await loadData();
              Alert.alert('Success', `${vesselName} is now your active vessel.`);
            } catch (error) {
              console.error('[SeaTime] Error activating vessel:', error);
              Alert.alert('Error', 'Failed to activate vessel. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleCheckVessel = async (vesselId: string, vesselName: string, isActive: boolean) => {
    console.log('[SeaTime] User tapped Check Status button for vessel:', vesselId, vesselName, 'isActive:', isActive);
    
    if (!isActive) {
      Alert.alert(
        'Inactive Vessel',
        `"${vesselName}" is not currently active. Only active vessels can be tracked via AIS.\n\nWould you like to set it as active first?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Set Active',
            onPress: () => handleActivateVessel(vesselId, vesselName),
          },
        ]
      );
      return;
    }
    
    try {
      console.log('[SeaTime] Checking vessel AIS:', vesselId);
      
      const result = await seaTimeApi.checkVesselAIS(vesselId);
      console.log('[SeaTime] AIS check result:', result);
      
      if (result.is_moving) {
        const message = `Vessel is moving at ${result.speed_knots.toFixed(1)} knots.\nPosition: ${result.latitude.toFixed(4)}°, ${result.longitude.toFixed(4)}°${result.sea_time_entry_created ? '\n\nA sea time entry has been created and is pending confirmation.' : ''}`;
        Alert.alert('Vessel Moving', message, [{ text: 'OK' }]);
      } else {
        Alert.alert(
          'Vessel Stationary',
          `Vessel is not moving (speed: ${result.speed_knots.toFixed(1)} knots).\nPosition: ${result.latitude.toFixed(4)}°, ${result.longitude.toFixed(4)}°`,
          [{ text: 'OK' }]
        );
      }
      
      await loadData();
    } catch (error) {
      console.error('[SeaTime] Error checking vessel:', error);
      Alert.alert('Error', 'Failed to check vessel status. Please try again.');
    }
  };

  const handleConfirmEntry = async () => {
    if (!selectedEntry) return;

    try {
      console.log('[SeaTime] Confirming entry:', selectedEntry.id, 'with notes:', confirmNotes);
      
      const confirmedEntry = await seaTimeApi.confirmSeaTimeEntry(
        selectedEntry.id,
        confirmNotes.trim() || undefined
      );
      console.log('[SeaTime] Entry confirmed:', confirmedEntry);
      
      setShowConfirmModal(false);
      setSelectedEntry(null);
      setConfirmNotes('');
      await loadData();
      Alert.alert('Success', 'Sea time entry confirmed');
    } catch (error) {
      console.error('[SeaTime] Error confirming entry:', error);
      Alert.alert('Error', 'Failed to confirm entry. Please try again.');
    }
  };

  const handleRejectEntry = async (entryId: string) => {
    try {
      console.log('[SeaTime] Rejecting entry:', entryId);
      
      const rejectedEntry = await seaTimeApi.rejectSeaTimeEntry(entryId);
      console.log('[SeaTime] Entry rejected:', rejectedEntry);
      
      await loadData();
      Alert.alert('Success', 'Sea time entry rejected');
    } catch (error) {
      console.error('[SeaTime] Error rejecting entry:', error);
      Alert.alert('Error', 'Failed to reject entry. Please try again.');
    }
  };

  const handleDeleteVessel = async (vesselId: string, vesselName: string) => {
    console.log('[SeaTime] User tapped Delete button for vessel:', vesselId, vesselName);
    
    Alert.alert(
      'Delete Vessel',
      `Are you sure you want to delete "${vesselName}"? This will also delete all associated sea time history.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('[SeaTime] Deleting vessel:', vesselId);
              
              await seaTimeApi.deleteVessel(vesselId);
              console.log('[SeaTime] Vessel deleted successfully');
              
              await loadData();
              Alert.alert('Success', 'Vessel deleted successfully');
            } catch (error) {
              console.error('[SeaTime] Error deleting vessel:', error);
              Alert.alert('Error', 'Failed to delete vessel. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleVesselPress = (vesselId: string) => {
    console.log('[SeaTime] Navigating to vessel detail:', vesselId);
    router.push(`/vessel/${vesselId}`);
  };

  const formatDate = (dateString: string) => {
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

  const activeVessel = vessels.find(v => v.is_active);
  const historicVessels = vessels.filter(v => !v.is_active);

  const styles = createStyles(isDark);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleContainer}>
          <Image
            source={require('@/assets/images/9f505c5e-26b6-4025-b589-af78f238fc80.png')}
            style={styles.headerIcon}
            resizeMode="contain"
          />
          <View>
            <Text style={styles.headerTitle}>SeaTime Tracker</Text>
            <Text style={styles.headerSubtitle}>MCA Sea Service Testimonials</Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Pending Confirmations */}
        {pendingEntries.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Pending Confirmations</Text>
            {pendingEntries.map((entry) => (
              <View key={entry.id} style={[styles.card, styles.pendingCard]}>
                <View style={styles.cardHeader}>
                  <IconSymbol
                    ios_icon_name="clock"
                    android_material_icon_name="schedule"
                    size={24}
                    color={colors.warning}
                  />
                  <Text style={styles.cardTitle}>{entry.vessel.vessel_name}</Text>
                </View>
                <Text style={styles.cardText}>
                  SeaTime Tracker thinks you have been at sea for more than 4 hours.
                </Text>
                <Text style={styles.cardText}>
                  Started: {formatDate(entry.start_time)}
                </Text>
                <View style={styles.cardActions}>
                  <TouchableOpacity
                    style={[styles.button, styles.confirmButton]}
                    onPress={() => {
                      setSelectedEntry(entry);
                      setShowConfirmModal(true);
                    }}
                  >
                    <Text style={styles.buttonText}>Confirm</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.button, styles.rejectButton]}
                    onPress={() => handleRejectEntry(entry.id)}
                  >
                    <Text style={styles.buttonText}>Reject</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Active Vessel */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Active Vessel</Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => setShowAddVessel(true)}
            >
              <IconSymbol
                ios_icon_name="plus"
                android_material_icon_name="add"
                size={24}
                color={colors.card}
              />
            </TouchableOpacity>
          </View>

          {!activeVessel ? (
            <View style={styles.emptyState}>
              <IconSymbol
                ios_icon_name="sailboat"
                android_material_icon_name="directions-boat"
                size={64}
                color={colors.textSecondary}
              />
              <Text style={styles.emptyText}>No active vessel</Text>
              <Text style={styles.emptySubtext}>
                Add a vessel to start tracking sea time automatically
              </Text>
            </View>
          ) : (
            <View style={[styles.card, styles.activeCard]}>
              <View style={styles.activeBadgeContainer}>
                <View style={styles.activeBadge}>
                  <IconSymbol
                    ios_icon_name="checkmark.circle.fill"
                    android_material_icon_name="check-circle"
                    size={16}
                    color={colors.card}
                  />
                  <Text style={styles.activeBadgeText}>ACTIVE</Text>
                </View>
              </View>
              
              <TouchableOpacity
                onPress={() => handleVesselPress(activeVessel.id)}
                activeOpacity={0.7}
              >
                <View style={styles.vesselInfo}>
                  <Text style={styles.cardTitle}>{activeVessel.vessel_name}</Text>
                  <Text style={styles.cardSubtext}>MMSI: {activeVessel.mmsi}</Text>
                  <Text style={styles.activeDescription}>
                    Tap to view sea time history
                  </Text>
                </View>
              </TouchableOpacity>
              
              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={[styles.button, styles.checkButton]}
                  onPress={(e) => {
                    e.stopPropagation();
                    handleCheckVessel(activeVessel.id, activeVessel.vessel_name, activeVessel.is_active);
                  }}
                >
                  <IconSymbol
                    ios_icon_name="location"
                    android_material_icon_name="my-location"
                    size={18}
                    color={colors.card}
                  />
                  <Text style={styles.buttonText}>Check AIS Status</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.button, styles.deleteButton]}
                  onPress={(e) => {
                    e.stopPropagation();
                    handleDeleteVessel(activeVessel.id, activeVessel.vessel_name);
                  }}
                >
                  <IconSymbol
                    ios_icon_name="trash"
                    android_material_icon_name="delete"
                    size={18}
                    color={colors.card}
                  />
                  <Text style={styles.buttonText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* Historic Vessels */}
        {historicVessels.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Historic Vessels</Text>
            <Text style={styles.sectionDescription}>
              Tap vessel name to view sea time history
            </Text>
            {historicVessels.map((vessel) => (
              <View key={vessel.id} style={styles.card}>
                <TouchableOpacity
                  onPress={() => handleVesselPress(vessel.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.vesselInfo}>
                    <Text style={styles.cardTitle}>{vessel.vessel_name}</Text>
                    <Text style={styles.cardSubtext}>MMSI: {vessel.mmsi}</Text>
                  </View>
                </TouchableOpacity>
                
                <View style={styles.cardActions}>
                  <TouchableOpacity
                    style={[styles.button, styles.activateButton]}
                    onPress={(e) => {
                      e.stopPropagation();
                      handleActivateVessel(vessel.id, vessel.vessel_name);
                    }}
                  >
                    <IconSymbol
                      ios_icon_name="checkmark.circle"
                      android_material_icon_name="check-circle"
                      size={18}
                      color={colors.card}
                    />
                    <Text style={styles.buttonText}>Set as Active</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.button, styles.deleteButton]}
                    onPress={(e) => {
                      e.stopPropagation();
                      handleDeleteVessel(vessel.id, vessel.vessel_name);
                    }}
                  >
                    <IconSymbol
                      ios_icon_name="trash"
                      android_material_icon_name="delete"
                      size={18}
                      color={colors.card}
                    />
                    <Text style={styles.buttonText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Recent Sea Time */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Sea Time</Text>
          {seaTimeEntries.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No sea time recorded yet</Text>
            </View>
          ) : (
            seaTimeEntries.slice(0, 5).map((entry) => (
              <TouchableOpacity
                key={entry.id}
                style={styles.card}
                onPress={() => handleVesselPress(entry.vessel.id)}
                activeOpacity={0.7}
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>{entry.vessel.vessel_name}</Text>
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
                <Text style={styles.cardText}>
                  {formatDate(entry.start_time)} → {entry.end_time ? formatDate(entry.end_time) : 'Ongoing'}
                </Text>
                {entry.duration_hours && (
                  <Text style={styles.cardText}>
                    Duration: {entry.duration_hours.toFixed(1)} hours
                  </Text>
                )}
                {entry.notes && (
                  <Text style={styles.cardNotes}>Notes: {entry.notes}</Text>
                )}
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>

      {/* Add Vessel Modal */}
      <Modal
        visible={showAddVessel}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddVessel(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Vessel</Text>
            
            <Text style={styles.inputLabel}>MMSI Number</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., 235012345"
              placeholderTextColor={isDark ? colors.textSecondaryDark : colors.textSecondary}
              value={newMMSI}
              onChangeText={setNewMMSI}
              keyboardType="numeric"
            />
            
            <Text style={styles.inputLabel}>Vessel Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., MY Serenity"
              placeholderTextColor={isDark ? colors.textSecondaryDark : colors.textSecondary}
              value={newVesselName}
              onChangeText={setNewVesselName}
            />
            
            <TouchableOpacity
              style={styles.checkboxContainer}
              onPress={() => setSetAsActive(!setAsActive)}
            >
              <View style={[styles.checkbox, setAsActive && styles.checkboxChecked]}>
                {setAsActive && (
                  <IconSymbol
                    ios_icon_name="checkmark"
                    android_material_icon_name="check"
                    size={16}
                    color={colors.card}
                  />
                )}
              </View>
              <View style={styles.checkboxLabel}>
                <Text style={styles.checkboxText}>Set as active vessel</Text>
                <Text style={styles.checkboxSubtext}>
                  Active vessels are tracked automatically
                </Text>
              </View>
            </TouchableOpacity>
            
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={() => {
                  setShowAddVessel(false);
                  setNewMMSI('');
                  setNewVesselName('');
                  setSetAsActive(true);
                }}
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.confirmButton]}
                onPress={handleAddVessel}
              >
                <Text style={styles.buttonText}>Add Vessel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Confirm Entry Modal */}
      <Modal
        visible={showConfirmModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowConfirmModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Confirm Sea Time</Text>
            
            {selectedEntry && (
              <>
                <Text style={styles.modalText}>
                  Vessel: {selectedEntry.vessel.vessel_name}
                </Text>
                <Text style={styles.modalText}>
                  Started: {formatDate(selectedEntry.start_time)}
                </Text>
              </>
            )}
            
            <Text style={styles.inputLabel}>Notes (optional)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="e.g., Passage to Southampton"
              placeholderTextColor={isDark ? colors.textSecondaryDark : colors.textSecondary}
              value={confirmNotes}
              onChangeText={setConfirmNotes}
              multiline
              numberOfLines={3}
            />
            
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={() => {
                  setShowConfirmModal(false);
                  setSelectedEntry(null);
                  setConfirmNotes('');
                }}
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.confirmButton]}
                onPress={handleConfirmEntry}
              >
                <Text style={styles.buttonText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? colors.backgroundDark : colors.background,
      paddingTop: Platform.OS === 'android' ? 48 : 0,
    },
    header: {
      padding: 20,
      paddingTop: Platform.OS === 'ios' ? 60 : 20,
      backgroundColor: isDark ? colors.cardDark : colors.card,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? colors.borderDark : colors.border,
      boxShadow: '0px 2px 8px rgba(0, 119, 190, 0.1)',
      elevation: 3,
    },
    headerTitleContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    headerIcon: {
      width: 48,
      height: 48,
    },
    headerTitle: {
      fontSize: 28,
      fontWeight: '700',
      color: isDark ? colors.textDark : colors.text,
    },
    headerSubtitle: {
      fontSize: 14,
      color: isDark ? colors.textSecondaryDark : colors.textSecondary,
      marginTop: 4,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: 16,
      paddingBottom: 100,
    },
    section: {
      marginBottom: 24,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: isDark ? colors.textDark : colors.text,
      marginBottom: 12,
    },
    sectionDescription: {
      fontSize: 14,
      color: isDark ? colors.textSecondaryDark : colors.textSecondary,
      marginBottom: 12,
      marginTop: -8,
    },
    addButton: {
      backgroundColor: colors.primary,
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
    },
    card: {
      backgroundColor: isDark ? colors.cardDark : colors.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: isDark ? colors.borderDark : colors.border,
      boxShadow: '0px 2px 8px rgba(0, 119, 190, 0.1)',
      elevation: 2,
    },
    pendingCard: {
      borderColor: colors.warning,
      borderWidth: 2,
    },
    activeCard: {
      borderColor: colors.success,
      borderWidth: 2,
      position: 'relative',
    },
    activeBadgeContainer: {
      position: 'absolute',
      top: -1,
      right: -1,
      zIndex: 1,
    },
    activeBadge: {
      backgroundColor: colors.success,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderTopRightRadius: 11,
      borderBottomLeftRadius: 11,
    },
    activeBadgeText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.card,
    },
    activeDescription: {
      fontSize: 12,
      color: colors.success,
      marginTop: 4,
      fontWeight: '500',
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    vesselInfo: {
      marginBottom: 12,
    },
    cardTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: isDark ? colors.textDark : colors.text,
      marginBottom: 4,
    },
    cardSubtext: {
      fontSize: 14,
      color: isDark ? colors.textSecondaryDark : colors.textSecondary,
    },
    cardText: {
      fontSize: 14,
      color: isDark ? colors.textDark : colors.text,
      marginBottom: 4,
    },
    cardNotes: {
      fontSize: 14,
      color: isDark ? colors.textSecondaryDark : colors.textSecondary,
      fontStyle: 'italic',
      marginTop: 4,
    },
    cardActions: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 8,
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
    button: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 8,
      gap: 6,
    },
    checkButton: {
      backgroundColor: colors.primary,
      flex: 1,
    },
    activateButton: {
      backgroundColor: colors.success,
      flex: 1,
    },
    deleteButton: {
      backgroundColor: colors.danger,
      flex: 1,
    },
    confirmButton: {
      backgroundColor: colors.success,
      flex: 1,
    },
    rejectButton: {
      backgroundColor: colors.danger,
      flex: 1,
    },
    cancelButton: {
      backgroundColor: colors.textSecondary,
      flex: 1,
    },
    buttonText: {
      color: colors.card,
      fontSize: 14,
      fontWeight: '600',
    },
    emptyState: {
      alignItems: 'center',
      padding: 32,
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
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    modalContent: {
      backgroundColor: isDark ? colors.cardDark : colors.card,
      borderRadius: 16,
      padding: 24,
      width: '100%',
      maxWidth: 400,
    },
    modalTitle: {
      fontSize: 22,
      fontWeight: '700',
      color: isDark ? colors.textDark : colors.text,
      marginBottom: 16,
    },
    modalText: {
      fontSize: 14,
      color: isDark ? colors.textDark : colors.text,
      marginBottom: 8,
    },
    inputLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: isDark ? colors.textDark : colors.text,
      marginBottom: 8,
      marginTop: 12,
    },
    input: {
      backgroundColor: isDark ? colors.backgroundDark : colors.background,
      borderWidth: 1,
      borderColor: isDark ? colors.borderDark : colors.border,
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      color: isDark ? colors.textDark : colors.text,
    },
    textArea: {
      height: 80,
      textAlignVertical: 'top',
    },
    checkboxContainer: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginTop: 16,
      gap: 12,
    },
    checkbox: {
      width: 24,
      height: 24,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: isDark ? colors.borderDark : colors.border,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 2,
    },
    checkboxChecked: {
      backgroundColor: colors.success,
      borderColor: colors.success,
    },
    checkboxLabel: {
      flex: 1,
    },
    checkboxText: {
      fontSize: 16,
      fontWeight: '600',
      color: isDark ? colors.textDark : colors.text,
    },
    checkboxSubtext: {
      fontSize: 13,
      color: isDark ? colors.textSecondaryDark : colors.textSecondary,
      marginTop: 2,
    },
    modalActions: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 20,
    },
  });
</write file>

Now let me also update the iOS-specific file to match:

<write file="app/(tabs)/(home)/index.ios.tsx">
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  useColorScheme,
  RefreshControl,
  Platform,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
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

export default function SeaTimeScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const [vessels, setVessels] = useState<Vessel[]>([]);
  const [seaTimeEntries, setSeaTimeEntries] = useState<SeaTimeEntry[]>([]);
  const [pendingEntries, setPendingEntries] = useState<SeaTimeEntry[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  
  // Add vessel modal
  const [showAddVessel, setShowAddVessel] = useState(false);
  const [newMMSI, setNewMMSI] = useState('');
  const [newVesselName, setNewVesselName] = useState('');
  const [setAsActive, setSetAsActive] = useState(true);
  
  // Confirm entry modal
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<SeaTimeEntry | null>(null);
  const [confirmNotes, setConfirmNotes] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      console.log('[SeaTime] Loading data from backend...');
      
      // Load vessels
      const vesselsData = await seaTimeApi.getVessels();
      console.log('[SeaTime] Loaded vessels:', vesselsData);
      setVessels(vesselsData);
      
      // Load all sea time entries
      const entriesData = await seaTimeApi.getSeaTimeEntries();
      console.log('[SeaTime] Loaded sea time entries:', entriesData);
      setSeaTimeEntries(entriesData);
      
      // Load pending entries
      const pendingData = await seaTimeApi.getPendingEntries();
      console.log('[SeaTime] Loaded pending entries:', pendingData);
      setPendingEntries(pendingData);
    } catch (error) {
      console.error('[SeaTime] Error loading data:', error);
      Alert.alert('Error', 'Failed to load data. Please check your connection and try again.');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleAddVessel = async () => {
    if (!newMMSI.trim() || !newVesselName.trim()) {
      Alert.alert('Error', 'Please enter both MMSI and vessel name');
      return;
    }

    try {
      console.log('[SeaTime] Adding vessel:', { mmsi: newMMSI, vessel_name: newVesselName, is_active: setAsActive });
      
      const newVessel = await seaTimeApi.createVessel(newMMSI.trim(), newVesselName.trim(), setAsActive);
      console.log('[SeaTime] Vessel created:', newVessel);
      
      setShowAddVessel(false);
      setNewMMSI('');
      setNewVesselName('');
      setSetAsActive(true);
      await loadData();
      
      if (setAsActive) {
        Alert.alert('Success', `${newVesselName.trim()} is now your active vessel and will be tracked automatically.`);
      } else {
        Alert.alert('Success', 'Vessel added successfully as historic vessel.');
      }
    } catch (error) {
      console.error('[SeaTime] Error adding vessel:', error);
      Alert.alert('Error', 'Failed to add vessel. Please try again.');
    }
  };

  const handleActivateVessel = async (vesselId: string, vesselName: string) => {
    console.log('[SeaTime] User tapped Set as Active button for vessel:', vesselId, vesselName);
    
    Alert.alert(
      'Set Active Vessel',
      `Set "${vesselName}" as your active vessel? This will automatically track its sea time.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Set Active',
          onPress: async () => {
            try {
              console.log('[SeaTime] Activating vessel:', vesselId);
              
              await seaTimeApi.activateVessel(vesselId);
              console.log('[SeaTime] Vessel activated successfully');
              
              await loadData();
              Alert.alert('Success', `${vesselName} is now your active vessel.`);
            } catch (error) {
              console.error('[SeaTime] Error activating vessel:', error);
              Alert.alert('Error', 'Failed to activate vessel. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleCheckVessel = async (vesselId: string, vesselName: string, isActive: boolean) => {
    console.log('[SeaTime] User tapped Check Status button for vessel:', vesselId, vesselName, 'isActive:', isActive);
    
    if (!isActive) {
      Alert.alert(
        'Inactive Vessel',
        `"${vesselName}" is not currently active. Only active vessels can be tracked via AIS.\n\nWould you like to set it as active first?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Set Active',
            onPress: () => handleActivateVessel(vesselId, vesselName),
          },
        ]
      );
      return;
    }
    
    try {
      console.log('[SeaTime] Checking vessel AIS:', vesselId);
      
      const result = await seaTimeApi.checkVesselAIS(vesselId);
      console.log('[SeaTime] AIS check result:', result);
      
      if (result.is_moving) {
        const message = `Vessel is moving at ${result.speed_knots.toFixed(1)} knots.\nPosition: ${result.latitude.toFixed(4)}°, ${result.longitude.toFixed(4)}°${result.sea_time_entry_created ? '\n\nA sea time entry has been created and is pending confirmation.' : ''}`;
        Alert.alert('Vessel Moving', message, [{ text: 'OK' }]);
      } else {
        Alert.alert(
          'Vessel Stationary',
          `Vessel is not moving (speed: ${result.speed_knots.toFixed(1)} knots).\nPosition: ${result.latitude.toFixed(4)}°, ${result.longitude.toFixed(4)}°`,
          [{ text: 'OK' }]
        );
      }
      
      await loadData();
    } catch (error) {
      console.error('[SeaTime] Error checking vessel:', error);
      Alert.alert('Error', 'Failed to check vessel status. Please try again.');
    }
  };

  const handleConfirmEntry = async () => {
    if (!selectedEntry) return;

    try {
      console.log('[SeaTime] Confirming entry:', selectedEntry.id, 'with notes:', confirmNotes);
      
      const confirmedEntry = await seaTimeApi.confirmSeaTimeEntry(
        selectedEntry.id,
        confirmNotes.trim() || undefined
      );
      console.log('[SeaTime] Entry confirmed:', confirmedEntry);
      
      setShowConfirmModal(false);
      setSelectedEntry(null);
      setConfirmNotes('');
      await loadData();
      Alert.alert('Success', 'Sea time entry confirmed');
    } catch (error) {
      console.error('[SeaTime] Error confirming entry:', error);
      Alert.alert('Error', 'Failed to confirm entry. Please try again.');
    }
  };

  const handleRejectEntry = async (entryId: string) => {
    try {
      console.log('[SeaTime] Rejecting entry:', entryId);
      
      const rejectedEntry = await seaTimeApi.rejectSeaTimeEntry(entryId);
      console.log('[SeaTime] Entry rejected:', rejectedEntry);
      
      await loadData();
      Alert.alert('Success', 'Sea time entry rejected');
    } catch (error) {
      console.error('[SeaTime] Error rejecting entry:', error);
      Alert.alert('Error', 'Failed to reject entry. Please try again.');
    }
  };

  const handleDeleteVessel = async (vesselId: string, vesselName: string) => {
    console.log('[SeaTime] User tapped Delete button for vessel:', vesselId, vesselName);
    
    Alert.alert(
      'Delete Vessel',
      `Are you sure you want to delete "${vesselName}"? This will also delete all associated sea time history.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('[SeaTime] Deleting vessel:', vesselId);
              
              await seaTimeApi.deleteVessel(vesselId);
              console.log('[SeaTime] Vessel deleted successfully');
              
              await loadData();
              Alert.alert('Success', 'Vessel deleted successfully');
            } catch (error) {
              console.error('[SeaTime] Error deleting vessel:', error);
              Alert.alert('Error', 'Failed to delete vessel. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleVesselPress = (vesselId: string) => {
    console.log('[SeaTime] Navigating to vessel detail:', vesselId);
    router.push(`/vessel/${vesselId}`);
  };

  const formatDate = (dateString: string) => {
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

  const activeVessel = vessels.find(v => v.is_active);
  const historicVessels = vessels.filter(v => !v.is_active);

  const styles = createStyles(isDark);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleContainer}>
          <Image
            source={require('@/assets/images/9f505c5e-26b6-4025-b589-af78f238fc80.png')}
            style={styles.headerIcon}
            resizeMode="contain"
          />
          <View>
            <Text style={styles.headerTitle}>SeaTime Tracker</Text>
            <Text style={styles.headerSubtitle}>MCA Sea Service Testimonials</Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Pending Confirmations */}
        {pendingEntries.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Pending Confirmations</Text>
            {pendingEntries.map((entry) => (
              <View key={entry.id} style={[styles.card, styles.pendingCard]}>
                <View style={styles.cardHeader}>
                  <IconSymbol
                    ios_icon_name="clock"
                    android_material_icon_name="schedule"
                    size={24}
                    color={colors.warning}
                  />
                  <Text style={styles.cardTitle}>{entry.vessel.vessel_name}</Text>
                </View>
                <Text style={styles.cardText}>
                  SeaTime Tracker thinks you have been at sea for more than 4 hours.
                </Text>
                <Text style={styles.cardText}>
                  Started: {formatDate(entry.start_time)}
                </Text>
                <View style={styles.cardActions}>
                  <TouchableOpacity
                    style={[styles.button, styles.confirmButton]}
                    onPress={() => {
                      setSelectedEntry(entry);
                      setShowConfirmModal(true);
                    }}
                  >
                    <Text style={styles.buttonText}>Confirm</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.button, styles.rejectButton]}
                    onPress={() => handleRejectEntry(entry.id)}
                  >
                    <Text style={styles.buttonText}>Reject</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Active Vessel */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Active Vessel</Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => setShowAddVessel(true)}
            >
              <IconSymbol
                ios_icon_name="plus"
                android_material_icon_name="add"
                size={24}
                color={colors.card}
              />
            </TouchableOpacity>
          </View>

          {!activeVessel ? (
            <View style={styles.emptyState}>
              <IconSymbol
                ios_icon_name="sailboat"
                android_material_icon_name="directions-boat"
                size={64}
                color={colors.textSecondary}
              />
              <Text style={styles.emptyText}>No active vessel</Text>
              <Text style={styles.emptySubtext}>
                Add a vessel to start tracking sea time automatically
              </Text>
            </View>
          ) : (
            <View style={[styles.card, styles.activeCard]}>
              <View style={styles.activeBadgeContainer}>
                <View style={styles.activeBadge}>
                  <IconSymbol
                    ios_icon_name="checkmark.circle.fill"
                    android_material_icon_name="check-circle"
                    size={16}
                    color={colors.card}
                  />
                  <Text style={styles.activeBadgeText}>ACTIVE</Text>
                </View>
              </View>
              
              <TouchableOpacity
                onPress={() => handleVesselPress(activeVessel.id)}
                activeOpacity={0.7}
              >
                <View style={styles.vesselInfo}>
                  <Text style={styles.cardTitle}>{activeVessel.vessel_name}</Text>
                  <Text style={styles.cardSubtext}>MMSI: {activeVessel.mmsi}</Text>
                  <Text style={styles.activeDescription}>
                    Tap to view sea time history
                  </Text>
                </View>
              </TouchableOpacity>
              
              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={[styles.button, styles.checkButton]}
                  onPress={(e) => {
                    e.stopPropagation();
                    handleCheckVessel(activeVessel.id, activeVessel.vessel_name, activeVessel.is_active);
                  }}
                >
                  <IconSymbol
                    ios_icon_name="location"
                    android_material_icon_name="my-location"
                    size={18}
                    color={colors.card}
                  />
                  <Text style={styles.buttonText}>Check AIS Status</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.button, styles.deleteButton]}
                  onPress={(e) => {
                    e.stopPropagation();
                    handleDeleteVessel(activeVessel.id, activeVessel.vessel_name);
                  }}
                >
                  <IconSymbol
                    ios_icon_name="trash"
                    android_material_icon_name="delete"
                    size={18}
                    color={colors.card}
                  />
                  <Text style={styles.buttonText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* Historic Vessels */}
        {historicVessels.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Historic Vessels</Text>
            <Text style={styles.sectionDescription}>
              Tap vessel name to view sea time history
            </Text>
            {historicVessels.map((vessel) => (
              <View key={vessel.id} style={styles.card}>
                <TouchableOpacity
                  onPress={() => handleVesselPress(vessel.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.vesselInfo}>
                    <Text style={styles.cardTitle}>{vessel.vessel_name}</Text>
                    <Text style={styles.cardSubtext}>MMSI: {vessel.mmsi}</Text>
                  </View>
                </TouchableOpacity>
                
                <View style={styles.cardActions}>
                  <TouchableOpacity
                    style={[styles.button, styles.activateButton]}
                    onPress={(e) => {
                      e.stopPropagation();
                      handleActivateVessel(vessel.id, vessel.vessel_name);
                    }}
                  >
                    <IconSymbol
                      ios_icon_name="checkmark.circle"
                      android_material_icon_name="check-circle"
                      size={18}
                      color={colors.card}
                    />
                    <Text style={styles.buttonText}>Set as Active</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.button, styles.deleteButton]}
                    onPress={(e) => {
                      e.stopPropagation();
                      handleDeleteVessel(vessel.id, vessel.vessel_name);
                    }}
                  >
                    <IconSymbol
                      ios_icon_name="trash"
                      android_material_icon_name="delete"
                      size={18}
                      color={colors.card}
                    />
                    <Text style={styles.buttonText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Recent Sea Time */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Sea Time</Text>
          {seaTimeEntries.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No sea time recorded yet</Text>
            </View>
          ) : (
            seaTimeEntries.slice(0, 5).map((entry) => (
              <TouchableOpacity
                key={entry.id}
                style={styles.card}
                onPress={() => handleVesselPress(entry.vessel.id)}
                activeOpacity={0.7}
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>{entry.vessel.vessel_name}</Text>
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
                <Text style={styles.cardText}>
                  {formatDate(entry.start_time)} → {entry.end_time ? formatDate(entry.end_time) : 'Ongoing'}
                </Text>
                {entry.duration_hours && (
                  <Text style={styles.cardText}>
                    Duration: {entry.duration_hours.toFixed(1)} hours
                  </Text>
                )}
                {entry.notes && (
                  <Text style={styles.cardNotes}>Notes: {entry.notes}</Text>
                )}
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>

      {/* Add Vessel Modal */}
      <Modal
        visible={showAddVessel}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddVessel(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Vessel</Text>
            
            <Text style={styles.inputLabel}>MMSI Number</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., 235012345"
              placeholderTextColor={isDark ? colors.textSecondaryDark : colors.textSecondary}
              value={newMMSI}
              onChangeText={setNewMMSI}
              keyboardType="numeric"
            />
            
            <Text style={styles.inputLabel}>Vessel Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., MY Serenity"
              placeholderTextColor={isDark ? colors.textSecondaryDark : colors.textSecondary}
              value={newVesselName}
              onChangeText={setNewVesselName}
            />
            
            <TouchableOpacity
              style={styles.checkboxContainer}
              onPress={() => setSetAsActive(!setAsActive)}
            >
              <View style={[styles.checkbox, setAsActive && styles.checkboxChecked]}>
                {setAsActive && (
                  <IconSymbol
                    ios_icon_name="checkmark"
                    android_material_icon_name="check"
                    size={16}
                    color={colors.card}
                  />
                )}
              </View>
              <View style={styles.checkboxLabel}>
                <Text style={styles.checkboxText}>Set as active vessel</Text>
                <Text style={styles.checkboxSubtext}>
                  Active vessels are tracked automatically
                </Text>
              </View>
            </TouchableOpacity>
            
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={() => {
                  setShowAddVessel(false);
                  setNewMMSI('');
                  setNewVesselName('');
                  setSetAsActive(true);
                }}
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.confirmButton]}
                onPress={handleAddVessel}
              >
                <Text style={styles.buttonText}>Add Vessel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Confirm Entry Modal */}
      <Modal
        visible={showConfirmModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowConfirmModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Confirm Sea Time</Text>
            
            {selectedEntry && (
              <>
                <Text style={styles.modalText}>
                  Vessel: {selectedEntry.vessel.vessel_name}
                </Text>
                <Text style={styles.modalText}>
                  Started: {formatDate(selectedEntry.start_time)}
                </Text>
              </>
            )}
            
            <Text style={styles.inputLabel}>Notes (optional)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="e.g., Passage to Southampton"
              placeholderTextColor={isDark ? colors.textSecondaryDark : colors.textSecondary}
              value={confirmNotes}
              onChangeText={setConfirmNotes}
              multiline
              numberOfLines={3}
            />
            
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={() => {
                  setShowConfirmModal(false);
                  setSelectedEntry(null);
                  setConfirmNotes('');
                }}
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.confirmButton]}
                onPress={handleConfirmEntry}
              >
                <Text style={styles.buttonText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? colors.backgroundDark : colors.background,
      paddingTop: Platform.OS === 'android' ? 48 : 0,
    },
    header: {
      padding: 20,
      paddingTop: Platform.OS === 'ios' ? 60 : 20,
      backgroundColor: isDark ? colors.cardDark : colors.card,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? colors.borderDark : colors.border,
      boxShadow: '0px 2px 8px rgba(0, 119, 190, 0.1)',
      elevation: 3,
    },
    headerTitleContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    headerIcon: {
      width: 48,
      height: 48,
    },
    headerTitle: {
      fontSize: 28,
      fontWeight: '700',
      color: isDark ? colors.textDark : colors.text,
    },
    headerSubtitle: {
      fontSize: 14,
      color: isDark ? colors.textSecondaryDark : colors.textSecondary,
      marginTop: 4,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: 16,
      paddingBottom: 100,
    },
    section: {
      marginBottom: 24,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: isDark ? colors.textDark : colors.text,
      marginBottom: 12,
    },
    sectionDescription: {
      fontSize: 14,
      color: isDark ? colors.textSecondaryDark : colors.textSecondary,
      marginBottom: 12,
      marginTop: -8,
    },
    addButton: {
      backgroundColor: colors.primary,
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
    },
    card: {
      backgroundColor: isDark ? colors.cardDark : colors.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: isDark ? colors.borderDark : colors.border,
      boxShadow: '0px 2px 8px rgba(0, 119, 190, 0.1)',
      elevation: 2,
    },
    pendingCard: {
      borderColor: colors.warning,
      borderWidth: 2,
    },
    activeCard: {
      borderColor: colors.success,
      borderWidth: 2,
      position: 'relative',
    },
    activeBadgeContainer: {
      position: 'absolute',
      top: -1,
      right: -1,
      zIndex: 1,
    },
    activeBadge: {
      backgroundColor: colors.success,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderTopRightRadius: 11,
      borderBottomLeftRadius: 11,
    },
    activeBadgeText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.card,
    },
    activeDescription: {
      fontSize: 12,
      color: colors.success,
      marginTop: 4,
      fontWeight: '500',
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    vesselInfo: {
      marginBottom: 12,
    },
    cardTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: isDark ? colors.textDark : colors.text,
      marginBottom: 4,
    },
    cardSubtext: {
      fontSize: 14,
      color: isDark ? colors.textSecondaryDark : colors.textSecondary,
    },
    cardText: {
      fontSize: 14,
      color: isDark ? colors.textDark : colors.text,
      marginBottom: 4,
    },
    cardNotes: {
      fontSize: 14,
      color: isDark ? colors.textSecondaryDark : colors.textSecondary,
      fontStyle: 'italic',
      marginTop: 4,
    },
    cardActions: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 8,
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
    button: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 8,
      gap: 6,
    },
    checkButton: {
      backgroundColor: colors.primary,
      flex: 1,
    },
    activateButton: {
      backgroundColor: colors.success,
      flex: 1,
    },
    deleteButton: {
      backgroundColor: colors.danger,
      flex: 1,
    },
    confirmButton: {
      backgroundColor: colors.success,
      flex: 1,
    },
    rejectButton: {
      backgroundColor: colors.danger,
      flex: 1,
    },
    cancelButton: {
      backgroundColor: colors.textSecondary,
      flex: 1,
    },
    buttonText: {
      color: colors.card,
      fontSize: 14,
      fontWeight: '600',
    },
    emptyState: {
      alignItems: 'center',
      padding: 32,
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
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    modalContent: {
      backgroundColor: isDark ? colors.cardDark : colors.card,
      borderRadius: 16,
      padding: 24,
      width: '100%',
      maxWidth: 400,
    },
    modalTitle: {
      fontSize: 22,
      fontWeight: '700',
      color: isDark ? colors.textDark : colors.text,
      marginBottom: 16,
    },
    modalText: {
      fontSize: 14,
      color: isDark ? colors.textDark : colors.text,
      marginBottom: 8,
    },
    inputLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: isDark ? colors.textDark : colors.text,
      marginBottom: 8,
      marginTop: 12,
    },
    input: {
      backgroundColor: isDark ? colors.backgroundDark : colors.background,
      borderWidth: 1,
      borderColor: isDark ? colors.borderDark : colors.border,
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      color: isDark ? colors.textDark : colors.text,
    },
    textArea: {
      height: 80,
      textAlignVertical: 'top',
    },
    checkboxContainer: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginTop: 16,
      gap: 12,
    },
    checkbox: {
      width: 24,
      height: 24,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: isDark ? colors.borderDark : colors.border,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 2,
    },
    checkboxChecked: {
      backgroundColor: colors.success,
      borderColor: colors.success,
    },
    checkboxLabel: {
      flex: 1,
    },
    checkboxText: {
      fontSize: 16,
      fontWeight: '600',
      color: isDark ? colors.textDark : colors.text,
    },
    checkboxSubtext: {
      fontSize: 13,
      color: isDark ? colors.textSecondaryDark : colors.textSecondary,
      marginTop: 2,
    },
    modalActions: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 20,
    },
  });

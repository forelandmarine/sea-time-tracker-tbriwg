
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
} from 'react-native';
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

  const handleCheckVessel = async (vesselId: string) => {
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
        <Text style={styles.headerTitle}>SeaTime Tracker</Text>
        <Text style={styles.headerSubtitle}>MCA Sea Service Testimonials</Text>
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
            <Text style={styles.sectionTitle}>⚠️ Pending Confirmations</Text>
            {pendingEntries.map((entry, index) => (
              <View key={entry.id || index} style={[styles.card, styles.pendingCard]}>
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
              <View style={styles.cardHeader}>
                <View style={styles.vesselInfo}>
                  <Text style={styles.cardTitle}>{activeVessel.vessel_name}</Text>
                  <Text style={styles.cardSubtext}>MMSI: {activeVessel.mmsi}</Text>
                  <Text style={styles.activeDescription}>
                    This vessel is being tracked automatically
                  </Text>
                </View>
                <TouchableOpacity onPress={() => handleDeleteVessel(activeVessel.id, activeVessel.vessel_name)}>
                  <IconSymbol
                    ios_icon_name="trash"
                    android_material_icon_name="delete"
                    size={20}
                    color={colors.danger}
                  />
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={[styles.button, styles.checkButton]}
                onPress={() => handleCheckVessel(activeVessel.id)}
              >
                <IconSymbol
                  ios_icon_name="location"
                  android_material_icon_name="my-location"
                  size={18}
                  color={colors.card}
                />
                <Text style={styles.buttonText}>Check AIS Status</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Historic Vessels */}
        {historicVessels.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📚 Historic Vessels</Text>
            <Text style={styles.sectionDescription}>
              These vessels maintain their sea time history but are not actively tracked
            </Text>
            {historicVessels.map((vessel, index) => (
              <View key={vessel.id || index} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.vesselInfo}>
                    <Text style={styles.cardTitle}>{vessel.vessel_name}</Text>
                    <Text style={styles.cardSubtext}>MMSI: {vessel.mmsi}</Text>
                  </View>
                  <TouchableOpacity onPress={() => handleDeleteVessel(vessel.id, vessel.vessel_name)}>
                    <IconSymbol
                      ios_icon_name="trash"
                      android_material_icon_name="delete"
                      size={20}
                      color={colors.danger}
                    />
                  </TouchableOpacity>
                </View>
                <View style={styles.cardActions}>
                  <TouchableOpacity
                    style={[styles.button, styles.activateButton]}
                    onPress={() => handleActivateVessel(vessel.id, vessel.vessel_name)}
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
                    style={[styles.button, styles.checkButton]}
                    onPress={() => handleCheckVessel(vessel.id)}
                  >
                    <IconSymbol
                      ios_icon_name="location"
                      android_material_icon_name="my-location"
                      size={18}
                      color={colors.card}
                    />
                    <Text style={styles.buttonText}>Check Status</Text>
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
            seaTimeEntries.slice(0, 5).map((entry, index) => (
              <View key={entry.id || index} style={styles.card}>
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
              </View>
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
      flex: 1,
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
      marginTop: 12,
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

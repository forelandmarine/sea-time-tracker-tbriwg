
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
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

export default function SeaTimeScreen() {
  const router = useRouter();
  const [vessels, setVessels] = useState<Vessel[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [newMMSI, setNewMMSI] = useState('');
  const [newVesselName, setNewVesselName] = useState('');
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const styles = createStyles(isDark);

  // Separate vessels into active and historic
  const activeVessel = vessels.find(v => v.is_active);
  const historicVessels = vessels.filter(v => !v.is_active);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      console.log('Loading vessels...');
      const vesselsData = await seaTimeApi.getVessels();
      setVessels(vesselsData);
      console.log('Data loaded successfully - Active vessels:', vesselsData.filter(v => v.is_active).length, 'Historic vessels:', vesselsData.filter(v => !v.is_active).length);
    } catch (error: any) {
      console.error('Failed to load data:', error);
      Alert.alert('Error', 'Failed to load data: ' + error.message);
    } finally {
      setLoading(false);
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
      console.log('Creating new vessel:', { mmsi: newMMSI, name: newVesselName });
      await seaTimeApi.createVessel(newMMSI.trim(), newVesselName.trim(), false);
      setModalVisible(false);
      setNewMMSI('');
      setNewVesselName('');
      await loadData();
      Alert.alert('Success', 'Vessel added successfully');
    } catch (error: any) {
      console.error('Failed to add vessel:', error);
      Alert.alert('Error', 'Failed to add vessel: ' + error.message);
    }
  };

  const handleActivateVessel = async (vesselId: string, vesselName: string) => {
    const message = activeVessel 
      ? `Start tracking ${vesselName}? This will deactivate ${activeVessel.vessel_name}.`
      : `Start tracking ${vesselName}? The app will monitor this vessel's AIS data.`;

    Alert.alert(
      'Activate Vessel',
      message,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Activate',
          onPress: async () => {
            try {
              console.log('Activating vessel:', vesselId, '(will deactivate others)');
              await seaTimeApi.activateVessel(vesselId);
              await loadData();
              Alert.alert('Success', `${vesselName} is now being tracked`);
            } catch (error: any) {
              console.error('Failed to activate vessel:', error);
              Alert.alert('Error', 'Failed to activate vessel: ' + error.message);
            }
          },
        },
      ]
    );
  };

  const handleCheckVessel = async (vesselId: string, vesselName: string, isActive: boolean) => {
    if (!isActive) {
      Alert.alert('Vessel Not Active', 'Please activate the vessel first before checking AIS data.');
      return;
    }

    try {
      console.log('Checking AIS for vessel:', vesselId);
      const result = await seaTimeApi.checkVesselAIS(vesselId);
      
      // Handle null values gracefully
      const speedText = result.speed_knots !== null && result.speed_knots !== undefined
        ? result.speed_knots.toFixed(1) + ' knots'
        : 'Unknown';
      
      const positionText =
        result.latitude !== null && result.latitude !== undefined &&
        result.longitude !== null && result.longitude !== undefined
          ? `${result.latitude.toFixed(4)}, ${result.longitude.toFixed(4)}`
          : 'Unknown';

      const message = result.is_moving
        ? `✅ Vessel is moving\n\nSpeed: ${speedText}\nPosition: ${positionText}`
        : `⚓ Vessel is not moving\n\nSpeed: ${speedText}\nPosition: ${positionText}`;

      Alert.alert(`AIS Check - ${vesselName}`, message);
      await loadData();
    } catch (error: any) {
      console.error('AIS check failed:', error);
      Alert.alert('AIS Check Failed', error.message);
    }
  };

  const handleDeleteVessel = async (vesselId: string, vesselName: string) => {
    Alert.alert(
      'Delete Vessel',
      `Are you sure you want to delete ${vesselName}? This will also delete all associated sea time entries.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('Deleting vessel:', vesselId);
              await seaTimeApi.deleteVessel(vesselId);
              await loadData();
              Alert.alert('Success', 'Vessel deleted');
            } catch (error: any) {
              console.error('Failed to delete vessel:', error);
              Alert.alert('Error', 'Failed to delete vessel: ' + error.message);
            }
          },
        },
      ]
    );
  };

  const handleVesselPress = (vesselId: string) => {
    console.log('Navigating to vessel detail:', vesselId);
    router.push(`/vessel/${vesselId}` as any);
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
      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTitleContainer}>
            <Image
              source={require('@/assets/images/9f505c5e-26b6-4025-b589-af78f238fc80.png')}
              style={styles.appIcon}
              resizeMode="contain"
            />
            <View>
              <Text style={styles.headerTitle}>SeaTime Tracker</Text>
              <Text style={styles.headerSubtitle}>Track your days at sea</Text>
            </View>
          </View>
        </View>

        {/* Active Vessel Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Active Vessel</Text>
            <TouchableOpacity style={styles.addButton} onPress={() => setModalVisible(true)}>
              <IconSymbol
                ios_icon_name="plus.circle.fill"
                android_material_icon_name="add-circle"
                size={28}
                color={colors.primary}
              />
            </TouchableOpacity>
          </View>

          {!activeVessel ? (
            <View style={styles.emptyState}>
              <IconSymbol
                ios_icon_name="ferry"
                android_material_icon_name="directions-boat"
                size={64}
                color={isDark ? colors.textSecondary : colors.textSecondaryLight}
              />
              <Text style={styles.emptyText}>No active vessel</Text>
              <Text style={styles.emptySubtext}>
                {historicVessels.length > 0 
                  ? 'Activate a vessel from the historic list below'
                  : 'Tap the + button to add your first vessel'}
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.vesselCard, styles.activeVesselCard]}
              onPress={() => handleVesselPress(activeVessel.id)}
            >
              <View style={styles.vesselHeader}>
                <View style={styles.vesselInfo}>
                  <View style={styles.activeVesselBadge}>
                    <View style={styles.activeIndicatorPulse} />
                    <Text style={styles.activeVesselBadgeText}>TRACKING</Text>
                  </View>
                  <Text style={styles.vesselName}>{activeVessel.vessel_name}</Text>
                  <Text style={styles.vesselMmsi}>MMSI: {activeVessel.mmsi}</Text>
                </View>
              </View>
              <View style={styles.vesselActions}>
                <TouchableOpacity
                  style={[styles.vesselButton, styles.checkButton]}
                  onPress={() => handleCheckVessel(activeVessel.id, activeVessel.vessel_name, true)}
                >
                  <IconSymbol
                    ios_icon_name="location.circle"
                    android_material_icon_name="my-location"
                    size={20}
                    color="#fff"
                  />
                  <Text style={styles.vesselButtonText}>Check AIS</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.vesselButton, styles.deleteButton]}
                  onPress={() => handleDeleteVessel(activeVessel.id, activeVessel.vessel_name)}
                >
                  <IconSymbol
                    ios_icon_name="trash"
                    android_material_icon_name="delete"
                    size={20}
                    color="#fff"
                  />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* Historic Vessels Section */}
        {historicVessels.length > 0 && (
          <View style={styles.section}>
            <View style={styles.historicHeader}>
              <Text style={styles.sectionTitle}>Historic Vessels</Text>
              <Text style={styles.sectionSubtitle}>
                Tap a vessel to view its history or activate it for tracking
              </Text>
            </View>
            {historicVessels.map((vessel, index) => (
              <TouchableOpacity
                key={vessel.id}
                style={styles.vesselCard}
                onPress={() => handleVesselPress(vessel.id)}
              >
                <View style={styles.vesselHeader}>
                  <View style={styles.vesselInfo}>
                    <Text style={styles.vesselName}>{vessel.vessel_name}</Text>
                    <Text style={styles.vesselMmsi}>MMSI: {vessel.mmsi}</Text>
                  </View>
                  <View style={styles.statusIndicator} />
                </View>
                <View style={styles.vesselActions}>
                  <TouchableOpacity
                    style={[styles.vesselButton, styles.activateButton]}
                    onPress={() => handleActivateVessel(vessel.id, vessel.vessel_name)}
                  >
                    <IconSymbol
                      ios_icon_name="play.circle"
                      android_material_icon_name="play-circle-filled"
                      size={20}
                      color="#fff"
                    />
                    <Text style={styles.vesselButtonText}>Activate</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.vesselButton, styles.deleteButton]}
                    onPress={() => handleDeleteVessel(vessel.id, vessel.vessel_name)}
                  >
                    <IconSymbol
                      ios_icon_name="trash"
                      android_material_icon_name="delete"
                      size={20}
                      color="#fff"
                    />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Add Vessel Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add New Vessel</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <IconSymbol
                  ios_icon_name="xmark.circle.fill"
                  android_material_icon_name="cancel"
                  size={28}
                  color={isDark ? colors.textSecondary : colors.textSecondaryLight}
                />
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Vessel Name</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., MV Serenity"
                placeholderTextColor={isDark ? colors.textSecondary : colors.textSecondaryLight}
                value={newVesselName}
                onChangeText={setNewVesselName}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>MMSI Number</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., 235012345"
                placeholderTextColor={isDark ? colors.textSecondary : colors.textSecondaryLight}
                value={newMMSI}
                onChangeText={setNewMMSI}
                keyboardType="numeric"
              />
            </View>

            <TouchableOpacity style={styles.submitButton} onPress={handleAddVessel}>
              <Text style={styles.submitButtonText}>Add Vessel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function createStyles(isDark: boolean) {
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
    headerTitleContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    appIcon: {
      width: 53,
      height: 53,
      borderRadius: 12,
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
    section: {
      padding: 16,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    historicHeader: {
      marginBottom: 12,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: isDark ? colors.text : colors.textLight,
      marginBottom: 4,
    },
    sectionSubtitle: {
      fontSize: 14,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
      marginTop: 4,
    },
    addButton: {
      padding: 4,
    },
    vesselCard: {
      backgroundColor: isDark ? colors.cardBackground : colors.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: isDark ? colors.border : colors.borderLight,
    },
    activeVesselCard: {
      borderLeftWidth: 4,
      borderLeftColor: colors.success,
      backgroundColor: isDark ? colors.cardBackground : colors.card,
    },
    vesselHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    vesselInfo: {
      flex: 1,
    },
    activeVesselBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.success + '20',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 4,
      alignSelf: 'flex-start',
      marginBottom: 8,
      gap: 6,
    },
    activeIndicatorPulse: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.success,
    },
    activeVesselBadgeText: {
      fontSize: 11,
      fontWeight: 'bold',
      color: colors.success,
      letterSpacing: 0.5,
    },
    vesselName: {
      fontSize: 18,
      fontWeight: 'bold',
      color: isDark ? colors.text : colors.textLight,
      marginBottom: 4,
    },
    vesselMmsi: {
      fontSize: 14,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
    },
    statusIndicator: {
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: isDark ? colors.textSecondary : colors.textSecondaryLight,
    },
    statusActive: {
      backgroundColor: colors.success,
    },
    vesselActions: {
      flexDirection: 'row',
      gap: 8,
    },
    vesselButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 10,
      borderRadius: 8,
      gap: 6,
    },
    activateButton: {
      backgroundColor: colors.primary,
    },
    checkButton: {
      backgroundColor: colors.primary,
    },
    deleteButton: {
      backgroundColor: colors.error,
      flex: 0,
      paddingHorizontal: 12,
    },
    vesselButtonText: {
      color: '#fff',
      fontWeight: '600',
      fontSize: 14,
    },
    emptyState: {
      alignItems: 'center',
      padding: 40,
    },
    emptyText: {
      fontSize: 18,
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
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: isDark ? colors.cardBackground : colors.card,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: 20,
      paddingBottom: 40,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 20,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: isDark ? colors.text : colors.textLight,
    },
    inputGroup: {
      marginBottom: 16,
    },
    inputLabel: {
      fontSize: 14,
      fontWeight: '600',
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
    submitButton: {
      backgroundColor: colors.primary,
      padding: 16,
      borderRadius: 8,
      alignItems: 'center',
      marginTop: 8,
    },
    submitButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: 'bold',
    },
  });
}

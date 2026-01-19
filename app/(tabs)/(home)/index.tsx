
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import CartoMap from '@/components/CartoMap';
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
  KeyboardAvoidingView,
  Dimensions,
} from 'react-native';
import React, { useState, useEffect, useCallback } from 'react';
import * as seaTimeApi from '@/utils/seaTimeApi';
import { useRouter } from 'expo-router';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

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

interface VesselLocation {
  latitude: number | null;
  longitude: number | null;
  timestamp: string | null;
}

export default function SeaTimeScreen() {
  const router = useRouter();
  const [vessels, setVessels] = useState<Vessel[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [newVesselName, setNewVesselName] = useState('');
  const [newMMSI, setNewMMSI] = useState('');
  const [newCallSign, setNewCallSign] = useState('');
  const [newFlag, setNewFlag] = useState('');
  const [newOfficialNumber, setNewOfficialNumber] = useState('');
  const [newVesselType, setNewVesselType] = useState('');
  const [newLengthMetres, setNewLengthMetres] = useState('');
  const [newGrossTonnes, setNewGrossTonnes] = useState('');
  const [activeVesselLocation, setActiveVesselLocation] = useState<VesselLocation | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const styles = createStyles(isDark);

  // Separate vessels into active and historic
  const activeVessel = vessels.find(v => v.is_active);
  const historicVessels = vessels.filter(v => !v.is_active);

  useEffect(() => {
    loadData();
  }, []);

  const loadActiveVesselLocation = useCallback(async () => {
    if (!activeVessel) {
      console.log('No active vessel to load location for');
      return;
    }

    try {
      setLocationLoading(true);
      console.log('Loading location for active vessel:', activeVessel.id);
      const locationData = await seaTimeApi.getVesselAISLocation(activeVessel.id, false);
      setActiveVesselLocation({
        latitude: locationData.latitude,
        longitude: locationData.longitude,
        timestamp: locationData.timestamp,
      });
      console.log('Active vessel location loaded:', locationData.latitude, locationData.longitude, 'timestamp:', locationData.timestamp);
    } catch (error: any) {
      console.error('Failed to load active vessel location:', error);
      // Don't show alert for location errors, just log them
      setActiveVesselLocation(null);
    } finally {
      setLocationLoading(false);
    }
  }, [activeVessel]);

  useEffect(() => {
    if (activeVessel) {
      loadActiveVesselLocation();
    } else {
      setActiveVesselLocation(null);
    }
  }, [activeVessel, loadActiveVesselLocation]);

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
    if (activeVessel) {
      await loadActiveVesselLocation();
    }
    setRefreshing(false);
  };

  const handleAddVessel = async () => {
    if (!newMMSI.trim() || !newVesselName.trim()) {
      Alert.alert('Error', 'Please enter both MMSI and vessel name');
      return;
    }

    try {
      console.log('Creating new vessel:', { 
        mmsi: newMMSI, 
        name: newVesselName,
        callsign: newCallSign,
        flag: newFlag,
        official_number: newOfficialNumber,
        vessel_type: newVesselType,
        length_metres: newLengthMetres,
        gross_tonnes: newGrossTonnes
      });
      
      await seaTimeApi.createVessel(
        newMMSI.trim(), 
        newVesselName.trim(), 
        false,
        newFlag.trim() || undefined,
        newOfficialNumber.trim() || undefined,
        newVesselType || undefined,
        newLengthMetres ? parseFloat(newLengthMetres) : undefined,
        newGrossTonnes ? parseFloat(newGrossTonnes) : undefined,
        newCallSign.trim() || undefined
      );
      
      setModalVisible(false);
      setNewMMSI('');
      setNewVesselName('');
      setNewCallSign('');
      setNewFlag('');
      setNewOfficialNumber('');
      setNewVesselType('');
      setNewLengthMetres('');
      setNewGrossTonnes('');
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

  const formatLocationDMS = (lat: number | null | undefined, lon: number | null | undefined): { lat: string; lon: string } | null => {
    if (lat === null || lat === undefined || lon === null || lon === undefined) {
      return null;
    }
    return {
      lat: convertToDMS(lat, true),
      lon: convertToDMS(lon, false)
    };
  };

  const formatTimestamp = (timestamp: string | null | undefined): string => {
    if (!timestamp) return '';
    try {
      const date = new Date(timestamp);
      return date.toLocaleString();
    } catch (e) {
      console.error('Failed to format timestamp:', e);
      return '';
    }
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
              source={require('@/assets/images/c13cbd51-c2f7-489f-bbbb-6b28094d9b2b.png')}
              style={styles.appIcon}
              resizeMode="contain"
            />
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle} numberOfLines={1} ellipsizeMode="tail">
                SeaTime Tracker
              </Text>
              <Text style={styles.headerSubtitle}>Track Your Days at Sea with AIS</Text>
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
                  ? 'Tap a vessel below to view details and activate it'
                  : 'Tap the + button to add your first vessel'}
              </Text>
            </View>
          ) : (
            <View>
              <TouchableOpacity
                style={[styles.vesselCard, styles.activeVesselCard]}
                onPress={() => handleVesselPress(activeVessel.id)}
              >
                <View style={styles.activeVesselBadge}>
                  <View style={styles.activeIndicatorPulse} />
                  <Text style={styles.activeVesselBadgeText}>TRACKING</Text>
                </View>
                
                <Text style={styles.vesselName}>{activeVessel.vessel_name}</Text>
                <Text style={styles.vesselMmsi}>MMSI: {activeVessel.mmsi}</Text>
                
                {/* Vessel Particulars in 2-column grid - now includes call sign */}
                <View style={styles.vesselParticularsGrid}>
                  {activeVessel.callsign && (
                    <View style={styles.particularItem}>
                      <Text style={styles.particularLabel}>Call Sign</Text>
                      <Text style={styles.particularValue}>{activeVessel.callsign}</Text>
                    </View>
                  )}
                  {activeVessel.flag && (
                    <View style={styles.particularItem}>
                      <Text style={styles.particularLabel}>Flag</Text>
                      <Text style={styles.particularValue}>{activeVessel.flag}</Text>
                    </View>
                  )}
                  {activeVessel.vessel_type && (
                    <View style={styles.particularItem}>
                      <Text style={styles.particularLabel}>Type</Text>
                      <Text style={styles.particularValue}>{activeVessel.vessel_type}</Text>
                    </View>
                  )}
                  {activeVessel.official_number && (
                    <View style={styles.particularItem}>
                      <Text style={styles.particularLabel}>Official No.</Text>
                      <Text style={styles.particularValue}>{activeVessel.official_number}</Text>
                    </View>
                  )}
                  {activeVessel.length_metres && (
                    <View style={styles.particularItem}>
                      <Text style={styles.particularLabel}>Length</Text>
                      <Text style={styles.particularValue}>{activeVessel.length_metres}m</Text>
                    </View>
                  )}
                  {activeVessel.gross_tonnes && (
                    <View style={styles.particularItem}>
                      <Text style={styles.particularLabel}>Gross Tonnes</Text>
                      <Text style={styles.particularValue}>{activeVessel.gross_tonnes}</Text>
                    </View>
                  )}
                </View>

                {/* Location in DMS format with timestamp */}
                {locationLoading ? (
                  <View style={styles.locationSection}>
                    <Text style={styles.locationSectionTitle}>Position</Text>
                    <Text style={styles.vesselLocation}>Loading location...</Text>
                  </View>
                ) : activeVesselLocation && (activeVesselLocation.latitude !== null || activeVesselLocation.longitude !== null) ? (
                  (() => {
                    const dmsLocation = formatLocationDMS(activeVesselLocation.latitude, activeVesselLocation.longitude);
                    return dmsLocation ? (
                      <View style={styles.locationSection}>
                        <Text style={styles.locationSectionTitle}>Position</Text>
                        <View style={styles.locationGrid}>
                          <View style={styles.locationItem}>
                            <Text style={styles.locationLabel}>Latitude</Text>
                            <Text style={styles.locationValue}>{dmsLocation.lat}</Text>
                          </View>
                          <View style={styles.locationItem}>
                            <Text style={styles.locationLabel}>Longitude</Text>
                            <Text style={styles.locationValue}>{dmsLocation.lon}</Text>
                          </View>
                        </View>
                        {activeVesselLocation.timestamp && (
                          <Text style={styles.vesselTimestamp}>
                            Updated: {formatTimestamp(activeVesselLocation.timestamp)}
                          </Text>
                        )}
                      </View>
                    ) : null;
                  })()
                ) : null}
              </TouchableOpacity>

              {/* Map showing vessel location */}
              {activeVesselLocation && 
               activeVesselLocation.latitude !== null && 
               activeVesselLocation.longitude !== null && (
                <View style={styles.mapContainer}>
                  <CartoMap
                    latitude={activeVesselLocation.latitude}
                    longitude={activeVesselLocation.longitude}
                    vesselName={activeVessel.vessel_name}
                  />
                </View>
              )}
            </View>
          )}
        </View>

        {/* Historic Vessels Section - Always show */}
        <View style={styles.section}>
          <View style={styles.historicHeader}>
            <Text style={styles.sectionTitle}>Historic Vessels</Text>
            <Text style={styles.sectionSubtitle}>
              {historicVessels.length > 0 
                ? 'Tap a vessel to view its history and activate it for tracking'
                : 'No historic vessels'}
            </Text>
          </View>
          {historicVessels.length === 0 ? (
            <View style={styles.emptyState}>
              <IconSymbol
                ios_icon_name="clock"
                android_material_icon_name="history"
                size={48}
                color={isDark ? colors.textSecondary : colors.textSecondaryLight}
              />
              <Text style={styles.emptyHistoricText}>No historic vessels</Text>
              <Text style={styles.emptySubtext}>
                Vessels you&apos;ve previously tracked will appear here
              </Text>
            </View>
          ) : (
            historicVessels.map((vessel) => (
              <React.Fragment key={vessel.id}>
                <TouchableOpacity
                  style={styles.vesselCard}
                  onPress={() => handleVesselPress(vessel.id)}
                >
                  <View style={styles.vesselHeader}>
                    <View style={styles.vesselInfo}>
                      <Text style={styles.vesselName}>{vessel.vessel_name}</Text>
                      <Text style={styles.vesselMmsi}>MMSI: {vessel.mmsi}</Text>
                      
                      {/* Vessel Particulars for historic vessels */}
                      <View style={styles.vesselParticulars}>
                        {vessel.callsign && (
                          <Text style={styles.vesselDetail}>Call Sign: {vessel.callsign}</Text>
                        )}
                        {vessel.flag && (
                          <Text style={styles.vesselDetail}>Flag: {vessel.flag}</Text>
                        )}
                        {vessel.official_number && (
                          <Text style={styles.vesselDetail}>Official No.: {vessel.official_number}</Text>
                        )}
                        {vessel.vessel_type && (
                          <Text style={styles.vesselDetail}>Type: {vessel.vessel_type}</Text>
                        )}
                        {vessel.length_metres && (
                          <Text style={styles.vesselDetail}>Length: {vessel.length_metres}m</Text>
                        )}
                        {vessel.gross_tonnes && (
                          <Text style={styles.vesselDetail}>Gross Tonnes: {vessel.gross_tonnes}</Text>
                        )}
                      </View>
                    </View>
                    <IconSymbol
                      ios_icon_name="chevron.right"
                      android_material_icon_name="chevron-right"
                      size={24}
                      color={isDark ? colors.textSecondary : colors.textSecondaryLight}
                    />
                  </View>
                </TouchableOpacity>
              </React.Fragment>
            ))
          )}
        </View>
      </ScrollView>

      {/* Add Vessel Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity 
            style={styles.modalBackdrop} 
            activeOpacity={1} 
            onPress={() => setModalVisible(false)}
          />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalKeyboardView}
          >
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

              <ScrollView
                style={styles.modalScrollView}
                contentContainerStyle={styles.modalScrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={true}
              >
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Vessel Name *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g., MV Serenity"
                    placeholderTextColor={isDark ? colors.textSecondary : colors.textSecondaryLight}
                    value={newVesselName}
                    onChangeText={setNewVesselName}
                    returnKeyType="next"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>MMSI Number *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g., 235012345"
                    placeholderTextColor={isDark ? colors.textSecondary : colors.textSecondaryLight}
                    value={newMMSI}
                    onChangeText={setNewMMSI}
                    keyboardType="numeric"
                    returnKeyType="next"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Call Sign</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g., GBAA"
                    placeholderTextColor={isDark ? colors.textSecondary : colors.textSecondaryLight}
                    value={newCallSign}
                    onChangeText={setNewCallSign}
                    autoCapitalize="characters"
                    returnKeyType="next"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Flag</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g., United Kingdom"
                    placeholderTextColor={isDark ? colors.textSecondary : colors.textSecondaryLight}
                    value={newFlag}
                    onChangeText={setNewFlag}
                    returnKeyType="next"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Official No.</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g., 123456"
                    placeholderTextColor={isDark ? colors.textSecondary : colors.textSecondaryLight}
                    value={newOfficialNumber}
                    onChangeText={setNewOfficialNumber}
                    returnKeyType="next"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Type (Motor/Sail)</Text>
                  <View style={styles.typeButtonContainer}>
                    <TouchableOpacity
                      style={[
                        styles.typeButton,
                        newVesselType === 'Motor' && styles.typeButtonActive
                      ]}
                      onPress={() => setNewVesselType('Motor')}
                    >
                      <Text style={[
                        styles.typeButtonText,
                        newVesselType === 'Motor' && styles.typeButtonTextActive
                      ]}>
                        Motor
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.typeButton,
                        newVesselType === 'Sail' && styles.typeButtonActive
                      ]}
                      onPress={() => setNewVesselType('Sail')}
                    >
                      <Text style={[
                        styles.typeButtonText,
                        newVesselType === 'Sail' && styles.typeButtonTextActive
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
                    placeholder="e.g., 45.5"
                    placeholderTextColor={isDark ? colors.textSecondary : colors.textSecondaryLight}
                    value={newLengthMetres}
                    onChangeText={setNewLengthMetres}
                    keyboardType="decimal-pad"
                    returnKeyType="next"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Gross Tonnes</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g., 500"
                    placeholderTextColor={isDark ? colors.textSecondary : colors.textSecondaryLight}
                    value={newGrossTonnes}
                    onChangeText={setNewGrossTonnes}
                    keyboardType="decimal-pad"
                    returnKeyType="done"
                    onSubmitEditing={handleAddVessel}
                  />
                </View>

                <TouchableOpacity style={styles.submitButton} onPress={handleAddVessel}>
                  <Text style={styles.submitButtonText}>Add Vessel</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
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
      marginBottom: 12,
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
      fontSize: 20,
      fontWeight: 'bold',
      color: isDark ? colors.text : colors.textLight,
      marginBottom: 4,
    },
    vesselMmsi: {
      fontSize: 14,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
      marginBottom: 12,
    },
    vesselParticularsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginBottom: 16,
      gap: 12,
    },
    particularItem: {
      width: '48%',
      backgroundColor: isDark ? colors.background : colors.backgroundLight,
      padding: 10,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: isDark ? colors.border : colors.borderLight,
    },
    particularLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 4,
    },
    particularValue: {
      fontSize: 14,
      fontWeight: '600',
      color: isDark ? colors.text : colors.textLight,
    },
    locationSection: {
      backgroundColor: isDark ? colors.background : colors.backgroundLight,
      padding: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: isDark ? colors.border : colors.borderLight,
    },
    locationSectionTitle: {
      fontSize: 11,
      fontWeight: '600',
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 8,
    },
    locationGrid: {
      flexDirection: 'row',
      gap: 12,
    },
    locationItem: {
      flex: 1,
    },
    locationLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
      marginBottom: 4,
    },
    locationValue: {
      fontSize: 13,
      fontWeight: '600',
      color: isDark ? colors.text : colors.textLight,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    vesselLocation: {
      fontSize: 13,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
      marginBottom: 1,
    },
    vesselTimestamp: {
      fontSize: 11,
      color: colors.primary,
      marginTop: 8,
      fontWeight: '600',
    },
    vesselParticulars: {
      marginTop: 4,
      marginBottom: 8,
    },
    vesselDetail: {
      fontSize: 13,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
      marginBottom: 2,
    },
    mapContainer: {
      marginTop: 12,
      borderRadius: 8,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: isDark ? colors.border : colors.borderLight,
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
      marginTop: 12,
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
    emptyHistoricText: {
      fontSize: 16,
      fontWeight: '600',
      color: isDark ? colors.text : colors.textLight,
      marginTop: 12,
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
    modalBackdrop: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
    modalKeyboardView: {
      justifyContent: 'flex-end',
      maxHeight: SCREEN_HEIGHT * 0.85,
    },
    modalContent: {
      backgroundColor: isDark ? colors.cardBackground : colors.card,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      height: SCREEN_HEIGHT * 0.85,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 20,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? colors.border : colors.borderLight,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: isDark ? colors.text : colors.textLight,
    },
    modalScrollView: {
      flex: 1,
    },
    modalScrollContent: {
      padding: 20,
      paddingTop: SCREEN_HEIGHT * 0.1,
      paddingBottom: 40,
    },
    inputGroup: {
      marginBottom: 20,
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
      padding: 14,
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
    submitButton: {
      backgroundColor: colors.primary,
      padding: 16,
      borderRadius: 8,
      alignItems: 'center',
      marginTop: 12,
    },
    submitButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: 'bold',
    },
  });
}

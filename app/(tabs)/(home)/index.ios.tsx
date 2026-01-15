
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
  KeyboardAvoidingView,
  Dimensions,
} from 'react-native';
import React, { useState, useEffect } from 'react';
import * as seaTimeApi from '@/utils/seaTimeApi';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
}

export default function SeaTimeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [vessels, setVessels] = useState<Vessel[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [newVesselName, setNewVesselName] = useState('');
  const [newMMSI, setNewMMSI] = useState('');
  const [newFlag, setNewFlag] = useState('');
  const [newOfficialNumber, setNewOfficialNumber] = useState('');
  const [newVesselType, setNewVesselType] = useState('');
  const [newLengthMetres, setNewLengthMetres] = useState('');
  const [newGrossTonnes, setNewGrossTonnes] = useState('');
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const styles = createStyles(isDark, insets.top);

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
      console.log('Creating new vessel:', { 
        mmsi: newMMSI, 
        name: newVesselName,
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
        newGrossTonnes ? parseFloat(newGrossTonnes) : undefined
      );
      
      setModalVisible(false);
      setNewMMSI('');
      setNewVesselName('');
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
            {historicVessels.map((vessel) => (
              <React.Fragment key={vessel.id}>
                <TouchableOpacity
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
              </React.Fragment>
            ))}
          </View>
        )}
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
    },
    loadingText: {
      fontSize: 16,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
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

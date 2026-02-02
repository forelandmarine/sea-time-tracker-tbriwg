
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors } from '@/styles/commonStyles';
import React, { useState, useEffect, useCallback } from 'react';
import * as seaTimeApi from '@/utils/seaTimeApi';
import { IconSymbol } from '@/components/IconSymbol';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  useColorScheme,
  TextInput,
  Platform,
  Modal,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';

interface Vessel {
  id: string;
  mmsi: string;
  vessel_name: string;
  is_active: boolean;
  created_at: string;
  callsign?: string;
}

interface SeaTimeEntry {
  id: string;
  vessel: Vessel | null;
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
  service_type?: string | null;
}

type ServiceType = 'watchkeeping' | 'cargo_operations' | 'maintenance' | 'training' | 'standby' | 'other';

function createStyles(isDark: boolean) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? colors.background : colors.backgroundLight,
    },
    scrollContent: {
      padding: 16,
      paddingBottom: 100,
    },
    section: {
      marginBottom: 24,
    },
    label: {
      fontSize: 16,
      fontWeight: '600',
      color: isDark ? colors.text : colors.textLight,
      marginBottom: 8,
    },
    input: {
      backgroundColor: isDark ? colors.cardBackground : colors.card,
      borderRadius: 12,
      padding: 16,
      fontSize: 16,
      color: isDark ? colors.text : colors.textLight,
      borderWidth: 1,
      borderColor: isDark ? colors.border : colors.borderLight,
    },
    textArea: {
      minHeight: 100,
      textAlignVertical: 'top',
    },
    dateButton: {
      backgroundColor: isDark ? colors.cardBackground : colors.card,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: isDark ? colors.border : colors.borderLight,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    dateButtonText: {
      fontSize: 16,
      color: isDark ? colors.text : colors.textLight,
    },
    pickerButton: {
      backgroundColor: isDark ? colors.cardBackground : colors.card,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: isDark ? colors.border : colors.borderLight,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    pickerButtonText: {
      fontSize: 16,
      color: isDark ? colors.text : colors.textLight,
    },
    saveButton: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
      marginTop: 24,
    },
    saveButtonDisabled: {
      opacity: 0.5,
    },
    saveButtonText: {
      color: '#FFFFFF',
      fontSize: 18,
      fontWeight: '600',
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
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
      maxHeight: '50%',
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: isDark ? colors.text : colors.textLight,
      marginBottom: 16,
      textAlign: 'center',
    },
    modalItem: {
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? colors.border : colors.borderLight,
    },
    modalItemText: {
      fontSize: 16,
      color: isDark ? colors.text : colors.textLight,
    },
    modalItemSelected: {
      backgroundColor: colors.primary + '20',
    },
    modalCloseButton: {
      marginTop: 16,
      padding: 16,
      backgroundColor: colors.primary,
      borderRadius: 12,
      alignItems: 'center',
    },
    modalCloseButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },
  });
}

function formatDateTime(date: Date | null): string {
  if (!date) return 'Not set';
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function EditSeaTimeScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const params = useLocalSearchParams();
  const entryId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [entry, setEntry] = useState<SeaTimeEntry | null>(null);
  const [vessels, setVessels] = useState<Vessel[]>([]);
  const [selectedVesselId, setSelectedVesselId] = useState<string>('');
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [endTime, setEndTime] = useState<Date | null>(null);
  const [notes, setNotes] = useState('');
  const [startLat, setStartLat] = useState('');
  const [startLon, setStartLon] = useState('');
  const [endLat, setEndLat] = useState('');
  const [endLon, setEndLon] = useState('');
  const [serviceType, setServiceType] = useState<ServiceType>('watchkeeping');
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [showVesselPicker, setShowVesselPicker] = useState(false);
  const [showServiceTypePicker, setShowServiceTypePicker] = useState(false);

  const router = useRouter();

  const loadEntry = useCallback(async () => {
    try {
      console.log('[EditSeaTime] Loading entry:', entryId);
      const data = await seaTimeApi.getSeaTimeEntry(entryId);
      console.log('[EditSeaTime] Entry loaded:', data);
      setEntry(data);
      
      if (data.vessel) {
        setSelectedVesselId(data.vessel.id);
      }
      setStartTime(new Date(data.start_time));
      if (data.end_time) {
        setEndTime(new Date(data.end_time));
      }
      setNotes(data.notes || '');
      setStartLat(data.start_latitude?.toString() || '');
      setStartLon(data.start_longitude?.toString() || '');
      setEndLat(data.end_latitude?.toString() || '');
      setEndLon(data.end_longitude?.toString() || '');
      setServiceType((data.service_type as ServiceType) || 'watchkeeping');
    } catch (error: any) {
      console.error('[EditSeaTime] Error loading entry:', error);
      Alert.alert('Error', 'Failed to load sea time entry');
      router.back();
    } finally {
      setLoading(false);
    }
  }, [entryId, router]);

  useEffect(() => {
    console.log('[EditSeaTime] Component mounted');
    loadEntry();
    loadVessels();
  }, [loadEntry]);

  const loadVessels = async () => {
    try {
      console.log('[EditSeaTime] Loading vessels');
      const data = await seaTimeApi.getVessels();
      console.log('[EditSeaTime] Vessels loaded:', data.length);
      setVessels(data);
    } catch (error: any) {
      console.error('[EditSeaTime] Error loading vessels:', error);
    }
  };

  const parseLatLong = (text: string): number | null => {
    const cleaned = text.trim();
    if (!cleaned) return null;
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  };

  const handleSave = async () => {
    if (!selectedVesselId) {
      Alert.alert('Validation Error', 'Please select a vessel');
      return;
    }

    if (!startTime) {
      Alert.alert('Validation Error', 'Please select a start time');
      return;
    }

    setSaving(true);
    try {
      console.log('[EditSeaTime] Saving entry');

      const updateData = {
        vessel_id: selectedVesselId,
        start_time: startTime.toISOString(),
        end_time: endTime ? endTime.toISOString() : null,
        notes: notes.trim() || null,
        start_latitude: parseLatLong(startLat),
        start_longitude: parseLatLong(startLon),
        end_latitude: parseLatLong(endLat),
        end_longitude: parseLatLong(endLon),
        service_type: serviceType,
      };

      console.log('[EditSeaTime] Update data:', updateData);

      await seaTimeApi.updateSeaTimeEntry(entryId, updateData);
      console.log('[EditSeaTime] Entry updated successfully');

      Alert.alert('Success', 'Sea time entry updated successfully', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]);
    } catch (error: any) {
      console.error('[EditSeaTime] Error saving entry:', error);
      Alert.alert('Error', error.message || 'Failed to update sea time entry');
    } finally {
      setSaving(false);
    }
  };

  const styles = createStyles(isDark);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const selectedVessel = vessels.find(v => v.id === selectedVesselId);
  const vesselButtonText = selectedVessel ? selectedVessel.vessel_name : 'Select Vessel';

  const serviceTypeLabels: Record<ServiceType, string> = {
    watchkeeping: 'Watchkeeping',
    cargo_operations: 'Cargo Operations',
    maintenance: 'Maintenance',
    training: 'Training',
    standby: 'Standby',
    other: 'Other',
  };

  const serviceTypeButtonText = serviceTypeLabels[serviceType];

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Edit Sea Time',
          headerShown: true,
        }}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        <View style={styles.section}>
          <Text style={styles.label}>Vessel *</Text>
          <TouchableOpacity style={styles.pickerButton} onPress={() => setShowVesselPicker(true)}>
            <Text style={styles.pickerButtonText}>{vesselButtonText}</Text>
            <IconSymbol
              ios_icon_name="chevron.down"
              android_material_icon_name="arrow-drop-down"
              size={24}
              color={isDark ? colors.text : colors.textLight}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Start Time *</Text>
          <TouchableOpacity style={styles.dateButton} onPress={() => setShowStartPicker(true)}>
            <Text style={styles.dateButtonText}>{formatDateTime(startTime)}</Text>
            <IconSymbol
              ios_icon_name="calendar"
              android_material_icon_name="calendar-today"
              size={24}
              color={isDark ? colors.text : colors.textLight}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>End Time</Text>
          <TouchableOpacity style={styles.dateButton} onPress={() => setShowEndPicker(true)}>
            <Text style={styles.dateButtonText}>{formatDateTime(endTime)}</Text>
            <IconSymbol
              ios_icon_name="calendar"
              android_material_icon_name="calendar-today"
              size={24}
              color={isDark ? colors.text : colors.textLight}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Service Type</Text>
          <TouchableOpacity style={styles.pickerButton} onPress={() => setShowServiceTypePicker(true)}>
            <Text style={styles.pickerButtonText}>{serviceTypeButtonText}</Text>
            <IconSymbol
              ios_icon_name="chevron.down"
              android_material_icon_name="arrow-drop-down"
              size={24}
              color={isDark ? colors.text : colors.textLight}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Start Latitude</Text>
          <TextInput
            style={styles.input}
            value={startLat}
            onChangeText={setStartLat}
            placeholder="e.g., 51.5074"
            placeholderTextColor={isDark ? colors.textSecondary : colors.textSecondaryLight}
            keyboardType="numeric"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Start Longitude</Text>
          <TextInput
            style={styles.input}
            value={startLon}
            onChangeText={setStartLon}
            placeholder="e.g., -0.1278"
            placeholderTextColor={isDark ? colors.textSecondary : colors.textSecondaryLight}
            keyboardType="numeric"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>End Latitude</Text>
          <TextInput
            style={styles.input}
            value={endLat}
            onChangeText={setEndLat}
            placeholder="e.g., 51.5074"
            placeholderTextColor={isDark ? colors.textSecondary : colors.textSecondaryLight}
            keyboardType="numeric"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>End Longitude</Text>
          <TextInput
            style={styles.input}
            value={endLon}
            onChangeText={setEndLon}
            placeholder="e.g., -0.1278"
            placeholderTextColor={isDark ? colors.textSecondary : colors.textSecondaryLight}
            keyboardType="numeric"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Notes</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Add any additional notes..."
            placeholderTextColor={isDark ? colors.textSecondary : colors.textSecondaryLight}
            multiline
            numberOfLines={4}
          />
        </View>

        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.saveButtonText}>Save Changes</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {showStartPicker && (
        <DateTimePicker
          value={startTime || new Date()}
          mode="datetime"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, selectedDate) => {
            setShowStartPicker(Platform.OS === 'ios');
            if (selectedDate) {
              setStartTime(selectedDate);
            }
          }}
        />
      )}

      {showEndPicker && (
        <DateTimePicker
          value={endTime || new Date()}
          mode="datetime"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, selectedDate) => {
            setShowEndPicker(Platform.OS === 'ios');
            if (selectedDate) {
              setEndTime(selectedDate);
            }
          }}
        />
      )}

      <Modal
        visible={showVesselPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowVesselPicker(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowVesselPicker(false)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Vessel</Text>
            <ScrollView>
              {vessels.map(vessel => {
                const isSelected = vessel.id === selectedVesselId;
                return (
                  <TouchableOpacity
                    key={vessel.id}
                    style={[styles.modalItem, isSelected && styles.modalItemSelected]}
                    onPress={() => {
                      setSelectedVesselId(vessel.id);
                      setShowVesselPicker(false);
                    }}
                  >
                    <Text style={styles.modalItemText}>{vessel.vessel_name}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setShowVesselPicker(false)}>
              <Text style={styles.modalCloseButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      <Modal
        visible={showServiceTypePicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowServiceTypePicker(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowServiceTypePicker(false)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Service Type</Text>
            <ScrollView>
              {(Object.keys(serviceTypeLabels) as ServiceType[]).map(type => {
                const isSelected = type === serviceType;
                const label = serviceTypeLabels[type];
                return (
                  <TouchableOpacity
                    key={type}
                    style={[styles.modalItem, isSelected && styles.modalItemSelected]}
                    onPress={() => {
                      setServiceType(type);
                      setShowServiceTypePicker(false);
                    }}
                  >
                    <Text style={styles.modalItemText}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setShowServiceTypePicker(false)}>
              <Text style={styles.modalCloseButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

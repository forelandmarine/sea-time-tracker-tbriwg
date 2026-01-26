
import React, { useState, useEffect, useCallback } from 'react';
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
  FlatList,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import * as seaTimeApi from '@/utils/seaTimeApi';
import DateTimePicker from '@react-native-community/datetimepicker';

interface Vessel {
  id: string;
  mmsi: string;
  vessel_name: string;
  is_active: boolean;
  created_at: string;
  callsign?: string;
}

type ServiceType = 'seagoing' | 'standby' | 'yard';

const createStyles = (isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? colors.background : colors.backgroundLight,
    },
    scrollContent: {
      padding: 20,
      paddingBottom: 40,
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
      backgroundColor: isDark ? colors.cardBackground : colors.cardBackgroundLight,
      borderRadius: 12,
      padding: 14,
      fontSize: 16,
      color: isDark ? colors.text : colors.textLight,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
    },
    pickerButton: {
      backgroundColor: isDark ? colors.cardBackground : colors.cardBackgroundLight,
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
      backgroundColor: isDark ? colors.cardBackground : colors.cardBackgroundLight,
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
    vesselPickerContainer: {
      maxHeight: 200,
      marginTop: 8,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
      backgroundColor: isDark ? colors.cardBackground : colors.cardBackgroundLight,
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
      backgroundColor: isDark ? colors.cardBackground : colors.cardBackgroundLight,
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
    saveButton: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
      marginTop: 20,
    },
    saveButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    datePickerModal: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    datePickerContainer: {
      backgroundColor: isDark ? colors.cardBackground : colors.cardBackgroundLight,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: 20,
    },
    datePickerTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: isDark ? colors.text : colors.textLight,
      marginBottom: 16,
    },
    datePickerButton: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
      marginTop: 16,
    },
    datePickerButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#FFFFFF',
    },
  });

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

export default function AddSeaTimeScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const styles = createStyles(isDark);
  const router = useRouter();

  const [vessels, setVessels] = useState<Vessel[]>([]);
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
  const [showVesselPicker, setShowVesselPicker] = useState(false);

  useEffect(() => {
    console.log('[AddSeaTimeScreen] Loading vessels');
    loadVessels();
  }, []);

  const loadVessels = async () => {
    try {
      const vesselsData = await seaTimeApi.getVessels();
      console.log('[AddSeaTimeScreen] Loaded vessels:', vesselsData.length);
      setVessels(vesselsData);
    } catch (error) {
      console.error('[AddSeaTimeScreen] Error loading vessels:', error);
      Alert.alert('Error', 'Failed to load vessels');
    }
  };

  const handleViewMCARequirements = async () => {
    console.log('[AddSeaTimeScreen] User tapped View MCA Requirements');
    try {
      const userProfile = await seaTimeApi.getUserProfile();
      const department = userProfile?.department?.toLowerCase() || 'deck';
      console.log('[AddSeaTimeScreen] User department:', department);
      router.push(`/mca-requirements?department=${department}`);
    } catch (error) {
      console.error('[AddSeaTimeScreen] Failed to get user profile:', error);
      router.push('/mca-requirements?department=deck');
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

  const handleSave = async () => {
    console.log('[AddSeaTimeScreen] User tapped Save');
    
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

      console.log('[AddSeaTimeScreen] Creating manual sea time entry');
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

      Alert.alert('Success', 'Sea time entry added successfully', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]);
    } catch (error: any) {
      console.error('[AddSeaTimeScreen] Error saving entry:', error);
      Alert.alert('Error', error.message || 'Failed to save sea time entry');
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Add Sea Time Entry',
          presentation: 'formSheet',
          headerShown: true,
        }}
      />
      
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={true}
      >
        <TouchableOpacity style={styles.mcaButton} onPress={handleViewMCARequirements}>
          <IconSymbol
            ios_icon_name="info.circle"
            android_material_icon_name="info"
            size={20}
            color={colors.primary}
          />
          <Text style={styles.mcaButtonText}>View MCA Requirements</Text>
        </TouchableOpacity>

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

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Vessel</Text>
          <TouchableOpacity
            style={styles.pickerButton}
            onPress={() => {
              console.log('[AddSeaTimeScreen] User tapped vessel picker');
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
                      console.log('[AddSeaTimeScreen] User selected vessel:', item.vessel_name);
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

        <View style={styles.divider} />

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Start Date & Time</Text>
          <TouchableOpacity
            style={styles.dateTimeButton}
            onPress={() => {
              console.log('[AddSeaTimeScreen] User tapped start date/time');
              setShowStartDatePicker(true);
            }}
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
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>
            End Date & Time{' '}
            <Text style={styles.inputLabelOptional}>(Optional)</Text>
          </Text>
          <TouchableOpacity
            style={styles.dateTimeButton}
            onPress={() => {
              console.log('[AddSeaTimeScreen] User tapped end date/time');
              setShowEndDatePicker(true);
            }}
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

        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>Save Entry</Text>
        </TouchableOpacity>
      </ScrollView>

      {showStartDatePicker && Platform.OS === 'ios' && (
        <View style={styles.datePickerModal}>
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={() => setShowStartDatePicker(false)}
          />
          <View style={styles.datePickerContainer}>
            <Text style={styles.datePickerTitle}>Select Start Date & Time</Text>
            <DateTimePicker
              value={startDate || new Date()}
              mode="datetime"
              display="spinner"
              onChange={(event, selectedDate) => {
                if (selectedDate) {
                  console.log('[AddSeaTimeScreen] Start date selected:', selectedDate);
                  setStartDate(selectedDate);
                }
              }}
              textColor={isDark ? colors.text : colors.textLight}
            />
            <TouchableOpacity
              style={styles.datePickerButton}
              onPress={() => setShowStartDatePicker(false)}
            >
              <Text style={styles.datePickerButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {showEndDatePicker && Platform.OS === 'ios' && (
        <View style={styles.datePickerModal}>
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={() => setShowEndDatePicker(false)}
          />
          <View style={styles.datePickerContainer}>
            <Text style={styles.datePickerTitle}>Select End Date & Time</Text>
            <DateTimePicker
              value={endDate || new Date()}
              mode="datetime"
              display="spinner"
              onChange={(event, selectedDate) => {
                if (selectedDate) {
                  console.log('[AddSeaTimeScreen] End date selected:', selectedDate);
                  setEndDate(selectedDate);
                }
              }}
              textColor={isDark ? colors.text : colors.textLight}
            />
            <TouchableOpacity
              style={styles.datePickerButton}
              onPress={() => setShowEndDatePicker(false)}
            >
              <Text style={styles.datePickerButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {showStartDatePicker && Platform.OS !== 'ios' && (
        <DateTimePicker
          value={startDate || new Date()}
          mode="date"
          display="default"
          onChange={(event, selectedDate) => {
            setShowStartDatePicker(false);
            if (selectedDate) {
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

      {showStartTimePicker && Platform.OS !== 'ios' && (
        <DateTimePicker
          value={startDate || new Date()}
          mode="time"
          display="default"
          onChange={(event, selectedTime) => {
            setShowStartTimePicker(false);
            if (selectedTime) {
              const newDate = startDate ? new Date(startDate) : new Date();
              newDate.setHours(selectedTime.getHours());
              newDate.setMinutes(selectedTime.getMinutes());
              setStartDate(newDate);
            }
          }}
        />
      )}

      {showEndDatePicker && Platform.OS !== 'ios' && (
        <DateTimePicker
          value={endDate || new Date()}
          mode="date"
          display="default"
          onChange={(event, selectedDate) => {
            setShowEndDatePicker(false);
            if (selectedDate) {
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

      {showEndTimePicker && Platform.OS !== 'ios' && (
        <DateTimePicker
          value={endDate || new Date()}
          mode="time"
          display="default"
          onChange={(event, selectedTime) => {
            setShowEndTimePicker(false);
            if (selectedTime) {
              const newDate = endDate ? new Date(endDate) : new Date();
              newDate.setHours(selectedTime.getHours());
              newDate.setMinutes(selectedTime.getMinutes());
              setEndDate(newDate);
            }
          }}
        />
      )}
    </View>
  );
}

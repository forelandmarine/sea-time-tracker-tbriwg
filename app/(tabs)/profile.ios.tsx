
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import * as Sharing from 'expo-sharing';
import { colors } from '@/styles/commonStyles';
import React, { useState, useEffect, useCallback } from 'react';
import * as seaTimeApi from '@/utils/seaTimeApi';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/IconSymbol';
import * as FileSystem from 'expo-file-system/legacy';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  useColorScheme,
  Platform,
  Image,
  ActivityIndicator,
  Modal,
  RefreshControl,
  Linking,
} from 'react-native';

interface UserProfile {
  id: string;
  name: string;
  email: string;
  email_verified: boolean;
  emailVerified: boolean;
  image: string | null;
  imageUrl: string | null;
  created_at: string;
  createdAt: string;
  updatedAt: string;
  department?: string | null;
}

interface SeaTimeSummary {
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
  entries_by_service_type?: {
    service_type: string;
    total_hours: number;
  }[];
}

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

interface SeaDayDefinition {
  title: string;
  description: string;
  department: 'deck' | 'engineering' | 'both';
}

const SEA_DAY_DEFINITIONS: SeaDayDefinition[] = [
  {
    title: 'What is a Sea Day?',
    description: 'A sea day is a period of at least 4 hours spent at sea on a qualifying vessel.',
    department: 'both',
  },
  {
    title: 'Deck Department',
    description: 'For deck officers, sea days must be spent performing watchkeeping or other navigational duties.',
    department: 'deck',
  },
  {
    title: 'Engineering Department',
    description: 'For engineering officers, sea days must be spent performing watchkeeping or other engineering duties.',
    department: 'engineering',
  },
  {
    title: 'MCA Requirements',
    description: 'The Maritime and Coastguard Agency (MCA) requires specific amounts of sea time for different certificates of competency.',
    department: 'both',
  },
];

const ALL_SERVICE_TYPES = [
  'watchkeeping',
  'cargo_operations',
  'maintenance',
  'training',
  'standby',
  'other',
];

function createStyles(isDark: boolean, topInset: number) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? colors.background : colors.backgroundLight,
    },
    scrollContent: {
      padding: 16,
      paddingTop: topInset + 16,
      paddingBottom: 100,
    },
    profileHeader: {
      alignItems: 'center',
      marginBottom: 24,
      paddingTop: 16,
    },
    avatarContainer: {
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
      overflow: 'hidden',
    },
    avatar: {
      width: 100,
      height: 100,
    },
    avatarText: {
      fontSize: 36,
      fontWeight: 'bold',
      color: '#FFFFFF',
    },
    profileName: {
      fontSize: 24,
      fontWeight: 'bold',
      color: isDark ? colors.text : colors.textLight,
      marginBottom: 4,
    },
    profileEmail: {
      fontSize: 16,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
      marginBottom: 8,
    },
    departmentBadge: {
      backgroundColor: colors.primary,
      paddingHorizontal: 16,
      paddingVertical: 6,
      borderRadius: 16,
    },
    departmentText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '600',
      textTransform: 'capitalize',
    },
    card: {
      backgroundColor: isDark ? colors.cardBackground : colors.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
    },
    cardTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: isDark ? colors.text : colors.textLight,
      marginBottom: 12,
    },
    summaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? colors.border : colors.borderLight,
    },
    summaryRowLast: {
      borderBottomWidth: 0,
    },
    summaryLabel: {
      fontSize: 16,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
    },
    summaryValue: {
      fontSize: 18,
      fontWeight: '600',
      color: isDark ? colors.text : colors.textLight,
    },
    vesselItem: {
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? colors.border : colors.borderLight,
    },
    vesselItemLast: {
      borderBottomWidth: 0,
    },
    vesselName: {
      fontSize: 16,
      fontWeight: '500',
      color: isDark ? colors.text : colors.textLight,
      marginBottom: 4,
    },
    vesselDetails: {
      fontSize: 14,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
    },
    button: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
    },
    buttonSecondary: {
      backgroundColor: 'transparent',
      borderWidth: 2,
      borderColor: isDark ? colors.border : colors.borderLight,
    },
    buttonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
      marginLeft: 8,
    },
    buttonTextSecondary: {
      color: isDark ? colors.text : colors.textLight,
    },
    signOutButton: {
      backgroundColor: colors.error,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    emptyText: {
      fontSize: 16,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
      textAlign: 'center',
      fontStyle: 'italic',
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    modalContent: {
      backgroundColor: isDark ? colors.cardBackground : colors.card,
      borderRadius: 16,
      padding: 24,
      width: '100%',
      maxWidth: 400,
      maxHeight: '80%',
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: isDark ? colors.text : colors.textLight,
      marginBottom: 16,
    },
    modalSection: {
      marginBottom: 20,
    },
    modalSectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: isDark ? colors.text : colors.textLight,
      marginBottom: 8,
    },
    modalText: {
      fontSize: 14,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
      lineHeight: 20,
      marginBottom: 8,
    },
    modalCloseButton: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      padding: 14,
      alignItems: 'center',
      marginTop: 8,
    },
    modalCloseButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },
  });
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [summary, setSummary] = useState<SeaTimeSummary | null>(null);
  const [vessels, setVessels] = useState<Vessel[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showSeaDayModal, setShowSeaDayModal] = useState(false);
  const [selectedVesselName, setSelectedVesselName] = useState<string | null>(null);
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const loadProfile = useCallback(async (retryCount = 0) => {
    try {
      console.log('[Profile] Loading user profile');
      const data = await seaTimeApi.getUserProfile();
      console.log('[Profile] Profile loaded:', data);
      setProfile(data);
    } catch (error: any) {
      console.error('[Profile] Error loading profile:', error);
      
      if (retryCount < 2) {
        console.log(`[Profile] Retrying profile load (${retryCount + 1}/2)`);
        setTimeout(() => loadProfile(retryCount + 1), 1000);
      }
    }
  }, []);

  const loadSummary = useCallback(async (retryCount = 0) => {
    try {
      console.log('[Profile] Loading sea time summary');
      const data = await seaTimeApi.getSeaTimeSummary();
      console.log('[Profile] Summary loaded:', data);
      setSummary(data);
    } catch (error: any) {
      console.error('[Profile] Error loading summary:', error);
      
      if (retryCount < 2) {
        console.log(`[Profile] Retrying summary load (${retryCount + 1}/2)`);
        setTimeout(() => loadSummary(retryCount + 1), 1000);
      }
    }
  }, []);

  const loadVessels = useCallback(async (retryCount = 0) => {
    try {
      console.log('[Profile] Loading vessels');
      const data = await seaTimeApi.getVessels();
      console.log('[Profile] Vessels loaded:', data.length);
      setVessels(data);
    } catch (error: any) {
      console.error('[Profile] Error loading vessels:', error);
      
      if (retryCount < 2) {
        console.log(`[Profile] Retrying vessels load (${retryCount + 1}/2)`);
        setTimeout(() => loadVessels(retryCount + 1), 1000);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    console.log('[Profile] Component mounted');
    loadProfile();
    loadSummary();
    loadVessels();
  }, [loadProfile, loadSummary, loadVessels]);

  useEffect(() => {
    const refreshTrigger = (global as any).__GLOBAL_REFRESH_TRIGGER__;
    if (refreshTrigger) {
      console.log('[Profile] Global refresh triggered');
      loadProfile();
      loadSummary();
      loadVessels();
    }
  }, [(global as any).__GLOBAL_REFRESH_TRIGGER__, loadProfile, loadSummary, loadVessels]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadProfile(), loadSummary(), loadVessels()]);
    setRefreshing(false);
  }, [loadProfile, loadSummary, loadVessels]);

  const handleEditProfile = () => {
    console.log('[Profile] User tapped Edit Profile button');
    router.push('/user-profile');
  };

  const handleScheduledTasks = () => {
    console.log('[Profile] User tapped Scheduled Tasks button');
    router.push('/scheduled-tasks');
  };

  const handleSupport = async () => {
    console.log('[Profile] User tapped Support button');
    const email = 'support@forelandmarine.com';
    const subject = 'SeaTime Tracker Support Request';
    const url = `mailto:${email}?subject=${encodeURIComponent(subject)}`;
    
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
    } else {
      Alert.alert('Support', `Please email us at ${email}`);
    }
  };

  const handleVesselPress = (vesselName: string) => {
    console.log('[Profile] User tapped vessel:', vesselName);
    setSelectedVesselName(vesselName);
    setShowSeaDayModal(true);
  };

  const handleCloseModal = () => {
    setShowSeaDayModal(false);
    setSelectedVesselName(null);
  };

  const formatServiceType = (serviceType: string): string => {
    return serviceType
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const getAllServiceTypesWithHours = () => {
    const serviceTypeMap = new Map<string, number>();
    
    ALL_SERVICE_TYPES.forEach(type => {
      serviceTypeMap.set(type, 0);
    });
    
    if (summary?.entries_by_service_type) {
      summary.entries_by_service_type.forEach(entry => {
        serviceTypeMap.set(entry.service_type, entry.total_hours);
      });
    }
    
    return Array.from(serviceTypeMap.entries()).map(([service_type, total_hours]) => ({
      service_type,
      total_hours,
    }));
  };

  const handleDownloadPDF = async () => {
    try {
      console.log('[Profile] User tapped Download PDF button');
      Alert.alert('Download PDF', 'PDF report generation is coming soon!');
    } catch (error: any) {
      console.error('[Profile] Error downloading PDF:', error);
      Alert.alert('Error', 'Failed to download PDF report');
    }
  };

  const handleDownloadCSV = async () => {
    try {
      console.log('[Profile] User tapped Download CSV button');
      Alert.alert('Download CSV', 'CSV report generation is coming soon!');
    } catch (error: any) {
      console.error('[Profile] Error downloading CSV:', error);
      Alert.alert('Error', 'Failed to download CSV report');
    }
  };

  const handleSignOut = () => {
    console.log('[Profile] User tapped Sign Out button');
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('[Profile] User confirmed sign out');
              await signOut();
              router.replace('/auth');
            } catch (error: any) {
              console.error('[Profile] Sign out error:', error);
            }
          },
        },
      ]
    );
  };

  const getInitials = (name: string | null | undefined): string => {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const styles = createStyles(isDark, insets.top);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const totalHoursText = summary?.total_hours?.toFixed(1) || '0.0';
  const totalDaysText = summary?.total_days?.toFixed(1) || '0.0';
  const vesselCountText = vessels.length.toString();
  const activeVesselCountText = vessels.filter(v => v.is_active).length.toString();

  const userDepartment = profile?.department || 'both';
  const filteredDefinitions = SEA_DAY_DEFINITIONS.filter(
    def => def.department === 'both' || def.department === userDepartment
  );

  const allServiceTypes = getAllServiceTypesWithHours();

  return (
    <>
      <ScrollView 
        style={styles.container} 
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
        }
      >
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            {profile?.image || profile?.imageUrl ? (
              <Image
                source={{ uri: profile.image || profile.imageUrl || undefined }}
                style={styles.avatar}
              />
            ) : (
              <Text style={styles.avatarText}>{getInitials(profile?.name)}</Text>
            )}
          </View>
          <Text style={styles.profileName}>{profile?.name || 'User'}</Text>
          <Text style={styles.profileEmail}>{profile?.email || user?.email || ''}</Text>
          {profile?.department && (
            <View style={styles.departmentBadge}>
              <Text style={styles.departmentText}>{profile.department}</Text>
            </View>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Sea Time Summary</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Hours</Text>
            <Text style={styles.summaryValue}>{totalHoursText}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Days</Text>
            <Text style={styles.summaryValue}>{totalDaysText}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Vessels</Text>
            <Text style={styles.summaryValue}>{vesselCountText}</Text>
          </View>
          <View style={[styles.summaryRow, styles.summaryRowLast]}>
            <Text style={styles.summaryLabel}>Active Vessels</Text>
            <Text style={styles.summaryValue}>{activeVesselCountText}</Text>
          </View>
        </View>

        {allServiceTypes.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Hours by Service Type</Text>
            {allServiceTypes.map((entry, index) => {
              const isLast = index === allServiceTypes.length - 1;
              const serviceTypeLabel = formatServiceType(entry.service_type);
              const hoursText = entry.total_hours.toFixed(1);
              
              return (
                <View key={entry.service_type} style={[styles.summaryRow, isLast && styles.summaryRowLast]}>
                  <Text style={styles.summaryLabel}>{serviceTypeLabel}</Text>
                  <Text style={styles.summaryValue}>{hoursText}</Text>
                </View>
              );
            })}
          </View>
        )}

        {vessels.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>My Vessels</Text>
            {vessels.map((vessel, index) => {
              const isLast = index === vessels.length - 1;
              const statusText = vessel.is_active ? 'Active' : 'Inactive';
              const mmsiText = `MMSI: ${vessel.mmsi}`;
              
              return (
                <TouchableOpacity
                  key={vessel.id}
                  style={[styles.vesselItem, isLast && styles.vesselItemLast]}
                  onPress={() => handleVesselPress(vessel.vessel_name)}
                >
                  <Text style={styles.vesselName}>{vessel.vessel_name}</Text>
                  <Text style={styles.vesselDetails}>{mmsiText}</Text>
                  <Text style={styles.vesselDetails}>{statusText}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <TouchableOpacity style={styles.button} onPress={handleEditProfile}>
          <IconSymbol
            ios_icon_name="person.circle"
            android_material_icon_name="person"
            size={20}
            color="#FFFFFF"
          />
          <Text style={styles.buttonText}>Edit Profile</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={handleScheduledTasks}>
          <IconSymbol
            ios_icon_name="calendar"
            android_material_icon_name="calendar-today"
            size={20}
            color="#FFFFFF"
          />
          <Text style={styles.buttonText}>Scheduled Tasks</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={handleDownloadPDF}>
          <IconSymbol
            ios_icon_name="doc.fill"
            android_material_icon_name="description"
            size={20}
            color="#FFFFFF"
          />
          <Text style={styles.buttonText}>Download PDF Report</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={handleDownloadCSV}>
          <IconSymbol
            ios_icon_name="tablecells"
            android_material_icon_name="insert-drive-file"
            size={20}
            color="#FFFFFF"
          />
          <Text style={styles.buttonText}>Download CSV Report</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.buttonSecondary]} onPress={handleSupport}>
          <IconSymbol
            ios_icon_name="envelope"
            android_material_icon_name="email"
            size={20}
            color={isDark ? colors.text : colors.textLight}
          />
          <Text style={[styles.buttonText, styles.buttonTextSecondary]}>Contact Support</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.signOutButton]} onPress={handleSignOut}>
          <IconSymbol
            ios_icon_name="arrow.right.square"
            android_material_icon_name="exit-to-app"
            size={20}
            color="#FFFFFF"
          />
          <Text style={styles.buttonText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal
        visible={showSeaDayModal}
        transparent
        animationType="slide"
        onRequestClose={handleCloseModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Sea Day Information</Text>
            <ScrollView>
              {filteredDefinitions.map((def, index) => (
                <View key={index} style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>{def.title}</Text>
                  <Text style={styles.modalText}>{def.description}</Text>
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.modalCloseButton} onPress={handleCloseModal}>
              <Text style={styles.modalCloseButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

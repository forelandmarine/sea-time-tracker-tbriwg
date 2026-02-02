
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { colors } from '@/styles/commonStyles';
import React, { useState, useEffect, useCallback } from 'react';
import * as seaTimeApi from '@/utils/seaTimeApi';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/IconSymbol';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  useColorScheme,
  ActivityIndicator,
  RefreshControl,
  Modal,
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
    total_days?: number;
  }[];
  entries_by_month: {
    month: string;
    total_hours: number;
  }[];
  entries_by_service_type?: {
    service_type: string;
    total_hours: number;
    total_days?: number;
  }[];
}

function createStyles(isDark: boolean, topInset: number) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? colors.background : colors.backgroundLight,
    },
    scrollContent: {
      paddingBottom: 100,
    },
    greyHeader: {
      backgroundColor: isDark ? '#2C2C2E' : '#E5E5EA',
      paddingTop: topInset + 16,
      paddingBottom: 24,
      paddingHorizontal: 16,
      alignItems: 'center',
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
      width: '100%',
    },
    lighthouseIcon: {
      marginRight: 12,
    },
    headerTitle: {
      fontSize: 28,
      fontWeight: 'bold',
      color: isDark ? colors.text : colors.textLight,
    },
    avatarContainer: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 12,
    },
    avatarText: {
      fontSize: 36,
      fontWeight: 'bold',
      color: '#FFFFFF',
    },
    userName: {
      fontSize: 20,
      fontWeight: '600',
      color: isDark ? colors.text : colors.textLight,
      marginBottom: 4,
    },
    userEmail: {
      fontSize: 14,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
    },
    contentSection: {
      padding: 16,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: isDark ? colors.text : colors.textLight,
      marginBottom: 12,
      marginTop: 8,
    },
    card: {
      backgroundColor: isDark ? colors.cardBackground : colors.card,
      borderRadius: 12,
      padding: 20,
      marginBottom: 16,
    },
    emptyStateText: {
      fontSize: 16,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
      textAlign: 'center',
    },
    reportButtonsRow: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 16,
    },
    reportButton: {
      flex: 1,
      backgroundColor: colors.primary,
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'center',
    },
    reportButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#FFFFFF',
      marginLeft: 8,
    },
    pathwayCard: {
      backgroundColor: isDark ? colors.cardBackground : colors.card,
      borderRadius: 12,
      padding: 20,
      marginBottom: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    pathwayContent: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    pathwayText: {
      fontSize: 16,
      fontWeight: '600',
      color: isDark ? colors.text : colors.textLight,
      marginLeft: 12,
    },
    serviceTypeRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? colors.border : colors.borderLight,
    },
    serviceTypeRowLast: {
      borderBottomWidth: 0,
    },
    serviceTypeLabel: {
      fontSize: 16,
      color: isDark ? colors.text : colors.textLight,
    },
    serviceTypeValue: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.primary,
    },
    accountCard: {
      backgroundColor: isDark ? colors.cardBackground : colors.card,
      borderRadius: 12,
      marginBottom: 16,
    },
    accountButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? colors.border : colors.borderLight,
    },
    accountButtonLast: {
      borderBottomWidth: 0,
    },
    accountButtonContent: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    accountButtonText: {
      fontSize: 16,
      color: isDark ? colors.text : colors.textLight,
      marginLeft: 12,
    },
    signOutButton: {
      backgroundColor: '#FF3B30',
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
      marginBottom: 16,
    },
    signOutButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    contactSupportButton: {
      backgroundColor: 'transparent',
      borderWidth: 2,
      borderColor: colors.primary,
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
      marginBottom: 16,
    },
    contactSupportButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.primary,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContent: {
      backgroundColor: isDark ? colors.cardBackground : '#FFFFFF',
      borderRadius: 16,
      padding: 24,
      width: '80%',
      maxWidth: 400,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: isDark ? colors.text : colors.textLight,
      marginBottom: 12,
      textAlign: 'center',
    },
    modalMessage: {
      fontSize: 16,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
      marginBottom: 24,
      textAlign: 'center',
    },
    modalButtons: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    modalButton: {
      flex: 1,
      padding: 12,
      borderRadius: 8,
      alignItems: 'center',
      marginHorizontal: 6,
    },
    modalButtonCancel: {
      backgroundColor: isDark ? colors.border : colors.borderLight,
    },
    modalButtonConfirm: {
      backgroundColor: '#FF3B30',
    },
    modalButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: isDark ? colors.text : colors.textLight,
    },
    modalButtonTextConfirm: {
      color: '#FFFFFF',
    },
  });
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [summary, setSummary] = useState<SeaTimeSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showSignOutModal, setShowSignOutModal] = useState(false);
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
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    console.log('[Profile] Component mounted');
    loadProfile();
    loadSummary();
  }, [loadProfile, loadSummary]);

  useEffect(() => {
    const refreshTrigger = (global as any).__GLOBAL_REFRESH_TRIGGER__;
    if (refreshTrigger) {
      console.log('[Profile] Global refresh triggered');
      loadProfile();
      loadSummary();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [(global as any).__GLOBAL_REFRESH_TRIGGER__]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadProfile(), loadSummary()]);
    setRefreshing(false);
  }, [loadProfile, loadSummary]);

  const handleEditProfile = () => {
    console.log('[Profile] User tapped Edit Profile');
    router.push('/user-profile');
  };

  const handleScheduledTasks = () => {
    console.log('[Profile] User tapped Scheduled Tasks');
    router.push('/scheduled-tasks');
  };

  const handleNotificationSettings = () => {
    console.log('[Profile] User tapped Notification Settings');
    router.push('/notification-settings');
  };

  const handleSignOut = () => {
    console.log('[Profile] User tapped Sign Out');
    setShowSignOutModal(true);
  };

  const confirmSignOut = async () => {
    console.log('[Profile] User confirmed sign out');
    setShowSignOutModal(false);
    try {
      await signOut();
      router.replace('/auth');
    } catch (error) {
      console.error('[Profile] Error signing out:', error);
    }
  };

  const cancelSignOut = () => {
    console.log('[Profile] User cancelled sign out');
    setShowSignOutModal(false);
  };

  const handleContactSupport = () => {
    console.log('[Profile] User tapped Contact Support');
    Linking.openURL('mailto:support@seatimetracker.com');
  };

  const handleGeneratePDF = () => {
    console.log('[Profile] User tapped Generate PDF Report');
    router.push('/reports');
  };

  const handleGenerateCSV = () => {
    console.log('[Profile] User tapped Generate CSV Report');
    router.push('/reports');
  };

  const handleSelectPathway = () => {
    console.log('[Profile] User tapped Select Pathway');
    router.push('/select-pathway');
  };

  const convertHoursToDays = (hours: number | null | undefined): number => {
    if (hours === null || hours === undefined) return 0;
    return Math.floor(hours / 4);
  };

  const styles = createStyles(isDark, insets.top);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const userName = profile?.name || user?.name || 'User';
  const userEmail = profile?.email || user?.email || '';
  const avatarLetter = userName.charAt(0).toUpperCase();
  
  const totalDays = summary?.total_days || 0;
  const hasSeaTimeEntries = totalDays > 0;
  const seaTimeSummaryMessage = hasSeaTimeEntries 
    ? `Total Days: ${totalDays}` 
    : 'No confirmed sea time entries yet';

  const pathwayDepartment = profile?.department;
  const pathwayText = pathwayDepartment === 'deck' 
    ? 'Deck Officer' 
    : pathwayDepartment === 'engineering' 
    ? 'Engineering Officer' 
    : 'Not Selected';

  const serviceTypes = [
    { key: 'actual_sea_service', label: 'Actual Sea Service' },
    { key: 'watchkeeping_service', label: 'Watchkeeping Service' },
    { key: 'stand_by_service', label: 'Stand-by Service' },
    { key: 'yard_service', label: 'Yard Service' },
    { key: 'service_in_port', label: 'Service in Port' },
  ];

  const getServiceTypeDays = (serviceTypeKey: string): number => {
    if (!summary?.entries_by_service_type) return 0;
    const entry = summary.entries_by_service_type.find(
      (e) => e.service_type === serviceTypeKey
    );
    if (!entry) return 0;
    return entry.total_days !== undefined
      ? Math.floor(entry.total_days)
      : convertHoursToDays(entry.total_hours);
  };

  return (
    <>
      <ScrollView 
        style={styles.container} 
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
        }
      >
        <View style={styles.greyHeader}>
          <View style={styles.headerRow}>
            <View style={styles.lighthouseIcon}>
              <IconSymbol
                ios_icon_name="lighthouse.fill"
                android_material_icon_name="place"
                size={32}
                color={colors.primary}
              />
            </View>
            <Text style={styles.headerTitle}>Profile</Text>
          </View>

          <View style={styles.avatarContainer}>
            <Text style={styles.avatarText}>{avatarLetter}</Text>
          </View>

          <Text style={styles.userName}>{userName}</Text>
          <Text style={styles.userEmail}>{userEmail}</Text>
        </View>

        <View style={styles.contentSection}>
          <Text style={styles.sectionTitle}>Sea Time Summary</Text>
          <View style={styles.card}>
            <Text style={styles.emptyStateText}>{seaTimeSummaryMessage}</Text>
          </View>

          <Text style={styles.sectionTitle}>Generate Reports</Text>
          <View style={styles.reportButtonsRow}>
            <TouchableOpacity style={styles.reportButton} onPress={handleGeneratePDF}>
              <IconSymbol
                ios_icon_name="doc.fill"
                android_material_icon_name="description"
                size={20}
                color="#FFFFFF"
              />
              <Text style={styles.reportButtonText}>PDF Report</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.reportButton} onPress={handleGenerateCSV}>
              <IconSymbol
                ios_icon_name="tablecells"
                android_material_icon_name="insert-drive-file"
                size={20}
                color="#FFFFFF"
              />
              <Text style={styles.reportButtonText}>CSV Report</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionTitle}>Pathway Badge</Text>
          <TouchableOpacity style={styles.pathwayCard} onPress={handleSelectPathway}>
            <View style={styles.pathwayContent}>
              <IconSymbol
                ios_icon_name="shield.fill"
                android_material_icon_name="verified"
                size={24}
                color={colors.primary}
              />
              <Text style={styles.pathwayText}>{pathwayText}</Text>
            </View>
            <IconSymbol
              ios_icon_name="chevron.right"
              android_material_icon_name="arrow-forward"
              size={20}
              color={isDark ? colors.textSecondary : colors.textSecondaryLight}
            />
          </TouchableOpacity>

          <Text style={styles.sectionTitle}>Sea Time by Service Type</Text>
          <View style={styles.card}>
            {serviceTypes.map((serviceType, index) => {
              const isLast = index === serviceTypes.length - 1;
              const days = getServiceTypeDays(serviceType.key);
              const daysText = days.toString();
              
              return (
                <View
                  key={serviceType.key}
                  style={[styles.serviceTypeRow, isLast && styles.serviceTypeRowLast]}
                >
                  <Text style={styles.serviceTypeLabel}>{serviceType.label}</Text>
                  <Text style={styles.serviceTypeValue}>{daysText}</Text>
                </View>
              );
            })}
          </View>

          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.accountCard}>
            <TouchableOpacity style={styles.accountButton} onPress={handleEditProfile}>
              <View style={styles.accountButtonContent}>
                <IconSymbol
                  ios_icon_name="person.circle"
                  android_material_icon_name="account-circle"
                  size={24}
                  color={colors.primary}
                />
                <Text style={styles.accountButtonText}>Edit Profile</Text>
              </View>
              <IconSymbol
                ios_icon_name="chevron.right"
                android_material_icon_name="arrow-forward"
                size={20}
                color={isDark ? colors.textSecondary : colors.textSecondaryLight}
              />
            </TouchableOpacity>

            <TouchableOpacity style={styles.accountButton} onPress={handleScheduledTasks}>
              <View style={styles.accountButtonContent}>
                <IconSymbol
                  ios_icon_name="clock"
                  android_material_icon_name="schedule"
                  size={24}
                  color={colors.primary}
                />
                <Text style={styles.accountButtonText}>Scheduled Tasks</Text>
              </View>
              <IconSymbol
                ios_icon_name="chevron.right"
                android_material_icon_name="arrow-forward"
                size={20}
                color={isDark ? colors.textSecondary : colors.textSecondaryLight}
              />
            </TouchableOpacity>

            <TouchableOpacity style={[styles.accountButton, styles.accountButtonLast]} onPress={handleNotificationSettings}>
              <View style={styles.accountButtonContent}>
                <IconSymbol
                  ios_icon_name="bell"
                  android_material_icon_name="notifications"
                  size={24}
                  color={colors.primary}
                />
                <Text style={styles.accountButtonText}>Notification Settings</Text>
              </View>
              <IconSymbol
                ios_icon_name="chevron.right"
                android_material_icon_name="arrow-forward"
                size={20}
                color={isDark ? colors.textSecondary : colors.textSecondaryLight}
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
            <Text style={styles.signOutButtonText}>Sign Out</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.contactSupportButton} onPress={handleContactSupport}>
            <Text style={styles.contactSupportButtonText}>Contact Support</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal
        visible={showSignOutModal}
        transparent
        animationType="fade"
        onRequestClose={cancelSignOut}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Sign Out</Text>
            <Text style={styles.modalMessage}>Are you sure you want to sign out?</Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={cancelSignOut}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={confirmSignOut}
              >
                <Text style={[styles.modalButtonText, styles.modalButtonTextConfirm]}>Sign Out</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

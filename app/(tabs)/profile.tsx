
import { IconSymbol } from '@/components/IconSymbol';
import { useAuth } from '@/contexts/AuthContext';
import { colors } from '@/styles/commonStyles';
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  useColorScheme,
  RefreshControl,
  Modal,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as seaTimeApi from '@/utils/seaTimeApi';

interface UserProfile {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
  imageUrl: string | null;
  address: string | null;
  tel_no: string | null;
  date_of_birth: string | null;
  srb_no: string | null;
  nationality: string | null;
  pya_membership_no: string | null;
  department: 'deck' | 'engineering' | null;
  createdAt: string;
  updatedAt: string;
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
  entries_by_service_type: {
    service_type: string;
    total_hours: number;
  }[];
}

function createStyles(isDark: boolean) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? colors.backgroundDark : colors.backgroundLight,
    },
    content: {
      padding: 20,
    },
    header: {
      marginBottom: 30,
    },
    title: {
      fontSize: 32,
      fontWeight: 'bold',
      color: isDark ? colors.textDark : colors.textLight,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 16,
      color: isDark ? colors.textSecondaryDark : colors.textSecondaryLight,
    },
    section: {
      marginBottom: 30,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: isDark ? colors.textDark : colors.textLight,
      marginBottom: 16,
    },
    card: {
      backgroundColor: isDark ? colors.cardDark : colors.cardLight,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    label: {
      fontSize: 14,
      color: isDark ? colors.textSecondaryDark : colors.textSecondaryLight,
    },
    value: {
      fontSize: 16,
      fontWeight: '500',
      color: isDark ? colors.textDark : colors.textLight,
    },
    button: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
      marginBottom: 12,
    },
    buttonSecondary: {
      backgroundColor: isDark ? colors.cardDark : colors.cardLight,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    buttonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },
    buttonTextSecondary: {
      color: colors.primary,
    },
    statCard: {
      backgroundColor: isDark ? colors.cardDark : colors.cardLight,
      borderRadius: 12,
      padding: 20,
      marginBottom: 12,
      alignItems: 'center',
    },
    statValue: {
      fontSize: 36,
      fontWeight: 'bold',
      color: colors.primary,
      marginBottom: 4,
    },
    statLabel: {
      fontSize: 14,
      color: isDark ? colors.textSecondaryDark : colors.textSecondaryLight,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContent: {
      backgroundColor: isDark ? colors.cardDark : colors.cardLight,
      borderRadius: 16,
      padding: 24,
      width: '90%',
      maxWidth: 400,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: isDark ? colors.textDark : colors.textLight,
      marginBottom: 16,
    },
    input: {
      backgroundColor: isDark ? colors.backgroundDark : colors.backgroundLight,
      borderRadius: 8,
      padding: 12,
      marginBottom: 12,
      color: isDark ? colors.textDark : colors.textLight,
      fontSize: 16,
    },
    modalButtons: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 16,
    },
    modalButton: {
      flex: 1,
      padding: 12,
      borderRadius: 8,
      alignItems: 'center',
      marginHorizontal: 6,
    },
    modalButtonCancel: {
      backgroundColor: isDark ? colors.backgroundDark : colors.backgroundLight,
    },
    modalButtonConfirm: {
      backgroundColor: colors.primary,
    },
    modalButtonText: {
      fontSize: 16,
      fontWeight: '600',
    },
    modalButtonTextCancel: {
      color: isDark ? colors.textDark : colors.textLight,
    },
    modalButtonTextConfirm: {
      color: '#FFFFFF',
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: isDark ? colors.backgroundDark : colors.backgroundLight,
    },
    adminSection: {
      marginTop: 20,
      paddingTop: 20,
      borderTopWidth: 1,
      borderTopColor: isDark ? colors.cardDark : colors.cardLight,
    },
    adminButton: {
      backgroundColor: isDark ? '#3a2a1a' : '#fff3cd',
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
      marginBottom: 12,
      borderWidth: 1,
      borderColor: isDark ? '#6a4a2a' : '#ffc107',
    },
    adminButtonText: {
      color: isDark ? '#ffc107' : '#856404',
      fontSize: 16,
      fontWeight: '600',
    },
  });
}

export default function ProfileScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const styles = createStyles(isDark);
  const router = useRouter();
  const { user, signOut } = useAuth();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [summary, setSummary] = useState<SeaTimeSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [signOutModalVisible, setSignOutModalVisible] = useState(false);
  const [editedProfile, setEditedProfile] = useState<Partial<UserProfile>>({});

  const loadData = useCallback(async () => {
    console.log('Loading profile data');
    try {
      const [profileData, summaryData] = await Promise.all([
        seaTimeApi.getUserProfile(),
        seaTimeApi.getSeaTimeSummary(),
      ]);
      console.log('Profile data loaded:', profileData);
      console.log('Summary data loaded:', summaryData);
      setProfile(profileData);
      setSummary(summaryData);
    } catch (error) {
      console.error('Error loading profile data:', error);
      Alert.alert('Error', 'Failed to load profile data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    console.log('User pulled to refresh profile');
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const handleEditProfile = useCallback(() => {
    console.log('User tapped Edit Profile button');
    if (profile) {
      setEditedProfile({
        name: profile.name,
        address: profile.address || '',
        tel_no: profile.tel_no || '',
        nationality: profile.nationality || '',
        pya_membership_no: profile.pya_membership_no || '',
      });
      setEditModalVisible(true);
    }
  }, [profile]);

  const handleSaveProfile = useCallback(async () => {
    console.log('User tapped Save Profile button', editedProfile);
    try {
      await seaTimeApi.updateUserProfile(editedProfile);
      console.log('Profile updated successfully');
      setEditModalVisible(false);
      loadData();
      Alert.alert('Success', 'Profile updated successfully');
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile');
    }
  }, [editedProfile, loadData]);

  const handleSignOut = useCallback(() => {
    console.log('User tapped Sign Out button');
    setSignOutModalVisible(true);
  }, []);

  const confirmSignOut = useCallback(async () => {
    console.log('User confirmed sign out');
    setSignOutModalVisible(false);
    try {
      await signOut();
      console.log('User signed out successfully');
      router.replace('/auth');
    } catch (error) {
      console.error('Error signing out:', error);
      Alert.alert('Error', 'Failed to sign out');
    }
  }, [signOut, router]);

  const cancelSignOut = useCallback(() => {
    console.log('User cancelled sign out');
    setSignOutModalVisible(false);
  }, []);

  const handleViewReports = useCallback(() => {
    console.log('User tapped View Reports button');
    router.push('/reports');
  }, [router]);

  const handleNotificationSettings = useCallback(() => {
    console.log('User tapped Notification Settings button');
    router.push('/notification-settings');
  }, [router]);

  const handleActivateSubscriptions = useCallback(() => {
    console.log('User tapped Activate All Subscriptions button');
    router.push('/admin-activate-subscriptions');
  }, [router]);

  const formatDate = useCallback((dateString: string | null) => {
    if (!dateString) {
      return 'Not set';
    }
    const date = new Date(dateString);
    const day = date.getDate();
    const month = date.toLocaleString('default', { month: 'short' });
    const year = date.getFullYear();
    return `${day} ${month} ${year}`;
  }, []);

  const formatDepartment = useCallback((department: string | null) => {
    if (!department) {
      return 'Not set';
    }
    const departmentText = department.charAt(0).toUpperCase() + department.slice(1);
    return departmentText;
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const totalDaysText = summary?.total_days?.toFixed(0) || '0';
  const totalHoursText = summary?.total_hours?.toFixed(1) || '0';

  return (
    <>
      <ScrollView
        style={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Profile</Text>
            <Text style={styles.subtitle}>{profile?.email}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Sea Time Summary</Text>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{totalDaysText}</Text>
              <Text style={styles.statLabel}>Total Sea Days</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{totalHoursText}</Text>
              <Text style={styles.statLabel}>Total Hours</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Personal Information</Text>
            <View style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.label}>Name</Text>
                <Text style={styles.value}>{profile?.name}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Email</Text>
                <Text style={styles.value}>{profile?.email}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Department</Text>
                <Text style={styles.value}>{formatDepartment(profile?.department || null)}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Address</Text>
                <Text style={styles.value}>{profile?.address || 'Not set'}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Phone</Text>
                <Text style={styles.value}>{profile?.tel_no || 'Not set'}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Nationality</Text>
                <Text style={styles.value}>{profile?.nationality || 'Not set'}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>PYA Membership</Text>
                <Text style={styles.value}>{profile?.pya_membership_no || 'Not set'}</Text>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <TouchableOpacity style={styles.button} onPress={handleEditProfile}>
              <Text style={styles.buttonText}>Edit Profile</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.button} onPress={handleViewReports}>
              <Text style={styles.buttonText}>View Reports</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.button} onPress={handleNotificationSettings}>
              <Text style={styles.buttonText}>Notification Settings</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.buttonSecondary]}
              onPress={handleSignOut}
            >
              <Text style={[styles.buttonText, styles.buttonTextSecondary]}>
                Sign Out
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.adminSection}>
            <Text style={styles.sectionTitle}>Admin Tools</Text>
            <TouchableOpacity
              style={styles.adminButton}
              onPress={handleActivateSubscriptions}
            >
              <Text style={styles.adminButtonText}>
                Activate All Subscriptions (Testing)
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <Modal
        visible={editModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Profile</Text>

            <TextInput
              style={styles.input}
              placeholder="Name"
              placeholderTextColor={isDark ? colors.textSecondaryDark : colors.textSecondaryLight}
              value={editedProfile.name}
              onChangeText={(text) => setEditedProfile({ ...editedProfile, name: text })}
            />

            <TextInput
              style={styles.input}
              placeholder="Address"
              placeholderTextColor={isDark ? colors.textSecondaryDark : colors.textSecondaryLight}
              value={editedProfile.address}
              onChangeText={(text) => setEditedProfile({ ...editedProfile, address: text })}
            />

            <TextInput
              style={styles.input}
              placeholder="Phone"
              placeholderTextColor={isDark ? colors.textSecondaryDark : colors.textSecondaryLight}
              value={editedProfile.tel_no}
              onChangeText={(text) => setEditedProfile({ ...editedProfile, tel_no: text })}
            />

            <TextInput
              style={styles.input}
              placeholder="Nationality"
              placeholderTextColor={isDark ? colors.textSecondaryDark : colors.textSecondaryLight}
              value={editedProfile.nationality}
              onChangeText={(text) => setEditedProfile({ ...editedProfile, nationality: text })}
            />

            <TextInput
              style={styles.input}
              placeholder="PYA Membership No"
              placeholderTextColor={isDark ? colors.textSecondaryDark : colors.textSecondaryLight}
              value={editedProfile.pya_membership_no}
              onChangeText={(text) => setEditedProfile({ ...editedProfile, pya_membership_no: text })}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setEditModalVisible(false)}
              >
                <Text style={[styles.modalButtonText, styles.modalButtonTextCancel]}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={handleSaveProfile}
              >
                <Text style={[styles.modalButtonText, styles.modalButtonTextConfirm]}>
                  Save
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={signOutModalVisible}
        transparent
        animationType="fade"
        onRequestClose={cancelSignOut}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Sign Out</Text>
            <Text style={styles.subtitle}>
              Are you sure you want to sign out?
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={cancelSignOut}
              >
                <Text style={[styles.modalButtonText, styles.modalButtonTextCancel]}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={confirmSignOut}
              >
                <Text style={[styles.modalButtonText, styles.modalButtonTextConfirm]}>
                  Sign Out
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

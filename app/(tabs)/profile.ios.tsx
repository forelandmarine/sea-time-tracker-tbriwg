
import { IconSymbol } from '@/components/IconSymbol';
import React, { useState, useEffect } from 'react';
import * as seaTimeApi from '@/utils/seaTimeApi';
import { useAuth } from '@/contexts/AuthContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
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
} from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '@/styles/commonStyles';

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

const createStyles = (isDark: boolean, topInset: number) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? colors.background : colors.backgroundLight,
    },
    scrollView: {
      flex: 1,
    },
    pageHeader: {
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
    content: {
      padding: 20,
    },
    profileSection: {
      alignItems: 'center',
      marginBottom: 30,
      paddingTop: 20,
    },
    profileImageContainer: {
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 15,
      overflow: 'hidden',
    },
    profileImage: {
      width: 100,
      height: 100,
    },
    profileInitials: {
      fontSize: 36,
      fontWeight: 'bold',
      color: '#ffffff',
    },
    profileName: {
      fontSize: 24,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 5,
    },
    profileEmail: {
      fontSize: 16,
      color: colors.textSecondary,
    },
    section: {
      marginBottom: 20,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 10,
    },
    card: {
      backgroundColor: isDark ? colors.cardBackground : colors.card,
      borderRadius: 12,
      padding: 15,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
    },
    summaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
    },
    summaryRowLast: {
      borderBottomWidth: 0,
    },
    summaryLabel: {
      fontSize: 15,
      color: isDark ? colors.text : colors.textLight,
      flex: 1,
    },
    summaryValue: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.primary,
    },
    totalRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12,
      backgroundColor: isDark ? colors.background : colors.backgroundLight,
      borderRadius: 8,
      paddingHorizontal: 12,
      marginTop: 8,
    },
    totalLabel: {
      fontSize: 16,
      fontWeight: '700',
      color: isDark ? colors.text : colors.textLight,
    },
    totalValue: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.primary,
    },
    loadingText: {
      fontSize: 14,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
      textAlign: 'center',
      paddingVertical: 10,
    },
    menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 15,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
    },
    menuItemLast: {
      borderBottomWidth: 0,
    },
    menuItemIcon: {
      marginRight: 15,
    },
    menuItemText: {
      flex: 1,
      fontSize: 16,
      color: isDark ? colors.text : colors.textLight,
    },
    menuItemChevron: {
      marginLeft: 10,
    },
    reportButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      borderRadius: 12,
      padding: 15,
      marginBottom: 10,
    },
    reportButtonText: {
      color: '#ffffff',
      fontSize: 16,
      fontWeight: '600',
      marginLeft: 10,
    },
    signOutButton: {
      backgroundColor: '#ff4444',
      borderRadius: 12,
      padding: 15,
      alignItems: 'center',
      marginTop: 20,
    },
    signOutButtonText: {
      color: '#ffffff',
      fontSize: 16,
      fontWeight: '600',
    },
    departmentBadge: {
      backgroundColor: colors.primary + '20',
      borderRadius: 20,
      paddingHorizontal: 16,
      paddingVertical: 8,
      marginTop: 8,
      alignSelf: 'center',
    },
    departmentBadgeText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.primary,
    },
  });

export default function ProfileScreen() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [summary, setSummary] = useState<SeaTimeSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();
  const styles = createStyles(isDark, insets.top);
  const router = useRouter();
  const { signOut } = useAuth();

  console.log('ProfileScreen rendered (iOS)');

  useEffect(() => {
    loadProfile();
    loadSummary();
  }, []);

  const loadProfile = async () => {
    console.log('Loading user profile');
    try {
      const data = await seaTimeApi.getUserProfile();
      console.log('User profile loaded:', data);
      setProfile(data);
    } catch (error) {
      console.error('Failed to load profile:', error);
      Alert.alert('Error', 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const loadSummary = async () => {
    console.log('Loading sea time summary');
    try {
      const data = await seaTimeApi.getReportSummary();
      console.log('Sea time summary loaded:', data);
      setSummary(data);
    } catch (error) {
      console.error('Failed to load sea time summary:', error);
    } finally {
      setLoadingSummary(false);
    }
  };

  const handleEditProfile = () => {
    console.log('User tapped Edit Profile');
    router.push('/user-profile');
  };

  const handleScheduledTasks = () => {
    console.log('User tapped Scheduled Tasks');
    router.push('/scheduled-tasks');
  };

  const handleMCARequirements = () => {
    console.log('User tapped MCA Requirements');
    router.push('/mca-requirements');
  };

  const handleViewReports = () => {
    console.log('User tapped View Detailed Reports');
    router.push('/reports');
  };

  const formatServiceType = (serviceType: string): string => {
    const typeMap: { [key: string]: string } = {
      'actual_sea_service': 'Actual Sea Service',
      'watchkeeping_service': 'Watchkeeping Service',
      'standby_service': 'Stand-by Service',
      'yard_service': 'Yard Service',
      'service_in_port': 'Service in Port',
    };
    return typeMap[serviceType] || serviceType;
  };

  const formatServiceType = (serviceType: string): string => {
    const typeMap: { [key: string]: string } = {
      'actual_sea_service': 'Actual Sea Service',
      'watchkeeping_service': 'Watchkeeping Service',
      'standby_service': 'Stand-by Service',
      'yard_service': 'Yard Service',
      'service_in_port': 'Service in Port',
    };
    return typeMap[serviceType] || serviceType;
  };

  const handleSignOut = async () => {
    console.log('User tapped Sign Out');
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            console.log('User confirmed sign out');
            try {
              await signOut();
              console.log('Sign out successful');
            } catch (error) {
              console.error('Sign out error:', error);
              Alert.alert('Error', 'Failed to sign out');
            }
          },
        },
      ]
    );
  };

  const getInitials = (name: string | null | undefined) => {
    if (!name || typeof name !== 'string') {
      return '?';
    }
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: colors.text }}>Loading...</Text>
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: colors.text }}>Failed to load profile</Text>
      </View>
    );
  }

  const imageUrl = profile.imageUrl || (profile.image ? `${seaTimeApi.API_BASE_URL}/${profile.image}` : null);
  const displayName = profile.name || 'User';
  const initials = getInitials(profile.name);
  const totalDaysDisplay = summary?.total_days.toFixed(2) || '0.00';

  console.log('Profile image URL:', imageUrl);

  return (
    <View style={styles.container}>
      <View style={styles.pageHeader}>
        <View style={styles.headerTitleContainer}>
          <Image
            source={require('@/assets/images/c13cbd51-c2f7-489f-bbbb-6b28094d9b2b.png')}
            style={styles.appIcon}
            resizeMode="contain"
          />
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle} numberOfLines={1} ellipsizeMode="tail">
              Profile
            </Text>
            <Text style={styles.headerSubtitle}>Your Sea Time Profile & Reports</Text>
          </View>
        </View>
      </View>

      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          <View style={styles.profileSection}>
            <View style={styles.profileImageContainer}>
              {imageUrl ? (
                <Image source={{ uri: imageUrl }} style={styles.profileImage} />
              ) : (
                <Text style={styles.profileInitials}>{initials}</Text>
              )}
            </View>
            <Text style={styles.profileName}>{displayName}</Text>
            <Text style={styles.profileEmail}>{profile.email}</Text>
            {profile.department && (
              <View style={styles.departmentBadge}>
                <Text style={styles.departmentBadgeText}>
                  {profile.department === 'Deck' ? '⚓ Deck Department' : '⚙️ Engineering Department'}
                </Text>
              </View>
            )}
          </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sea Time Summary</Text>
          <View style={styles.card}>
            {loadingSummary ? (
              <Text style={styles.loadingText}>Loading summary...</Text>
            ) : summary ? (
              <>
                {summary.entries_by_vessel.length === 0 && (
                  <Text style={styles.loadingText}>No confirmed sea time entries yet</Text>
                )}

                {summary.entries_by_vessel.length > 0 && (
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Total Sea Time</Text>
                    <Text style={styles.totalValue}>{totalDaysDisplay} days</Text>
                  </View>
                )}
              </>
            ) : (
              <Text style={styles.loadingText}>Unable to load summary</Text>
            )}
          </View>
          
          {summary && summary.entries_by_vessel.length > 0 && (
            <TouchableOpacity style={styles.reportButton} onPress={handleViewReports}>
              <IconSymbol
                ios_icon_name="chart.bar.fill"
                android_material_icon_name="assessment"
                size={24}
                color="#ffffff"
              />
              <Text style={styles.reportButtonText}>View Detailed Reports</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.card}>
            <TouchableOpacity style={styles.menuItem} onPress={handleEditProfile}>
              <IconSymbol
                ios_icon_name="person.circle"
                android_material_icon_name="person"
                size={24}
                color={colors.primary}
                style={styles.menuItemIcon}
              />
              <Text style={styles.menuItemText}>Edit Profile</Text>
              <IconSymbol
                ios_icon_name="chevron.right"
                android_material_icon_name="arrow-forward"
                size={20}
                color={colors.textSecondary}
                style={styles.menuItemChevron}
              />
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={handleScheduledTasks}>
              <IconSymbol
                ios_icon_name="clock"
                android_material_icon_name="schedule"
                size={24}
                color={colors.primary}
                style={styles.menuItemIcon}
              />
              <Text style={styles.menuItemText}>Scheduled Tasks</Text>
              <IconSymbol
                ios_icon_name="chevron.right"
                android_material_icon_name="arrow-forward"
                size={20}
                color={colors.textSecondary}
                style={styles.menuItemChevron}
              />
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/notification-settings')}>
              <IconSymbol
                ios_icon_name="bell"
                android_material_icon_name="notifications"
                size={24}
                color={colors.primary}
                style={styles.menuItemIcon}
              />
              <Text style={styles.menuItemText}>Notification Settings</Text>
              <IconSymbol
                ios_icon_name="chevron.right"
                android_material_icon_name="arrow-forward"
                size={20}
                color={colors.textSecondary}
                style={styles.menuItemChevron}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.menuItem, styles.menuItemLast]}
              onPress={handleMCARequirements}
            >
              <IconSymbol
                ios_icon_name="doc.text"
                android_material_icon_name="description"
                size={24}
                color={colors.primary}
                style={styles.menuItemIcon}
              />
              <Text style={styles.menuItemText}>MCA Requirements</Text>
              <IconSymbol
                ios_icon_name="chevron.right"
                android_material_icon_name="arrow-forward"
                size={20}
                color={colors.textSecondary}
                style={styles.menuItemChevron}
              />
            </TouchableOpacity>
          </View>
        </View>

          <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
            <Text style={styles.signOutButtonText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

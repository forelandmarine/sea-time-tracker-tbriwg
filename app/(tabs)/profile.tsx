
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
  useColorScheme,
  RefreshControl,
  ActivityIndicator,
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

function createStyles(isDark: boolean) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? colors.background : colors.backgroundLight,
    },
    scrollContent: {
      padding: 16,
      paddingTop: 64,
      paddingBottom: 100,
    },
    header: {
      marginBottom: 24,
    },
    headerTitle: {
      fontSize: 32,
      fontWeight: 'bold',
      color: isDark ? colors.text : colors.textLight,
      marginBottom: 4,
    },
    headerSubtitle: {
      fontSize: 16,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
    },
    profileSection: {
      alignItems: 'center',
      marginBottom: 32,
      paddingVertical: 24,
    },
    avatar: {
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
    },
    avatarText: {
      fontSize: 48,
      fontWeight: 'bold',
      color: '#FFFFFF',
    },
    userName: {
      fontSize: 24,
      fontWeight: '600',
      color: isDark ? colors.text : colors.textLight,
      marginBottom: 4,
    },
    userEmail: {
      fontSize: 16,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: isDark ? colors.text : colors.textLight,
      marginBottom: 12,
    },
    card: {
      backgroundColor: isDark ? colors.cardBackground : colors.card,
      borderRadius: 12,
      padding: 20,
      marginBottom: 16,
    },
    emptyCard: {
      backgroundColor: isDark ? colors.cardBackground : colors.card,
      borderRadius: 12,
      padding: 24,
      marginBottom: 16,
      alignItems: 'center',
    },
    emptyText: {
      fontSize: 16,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
      textAlign: 'center',
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
    accountSection: {
      marginTop: 8,
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
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
  });
}

export default function ProfileScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const styles = createStyles(isDark);
  const router = useRouter();
  const { user } = useAuth();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [summary, setSummary] = useState<SeaTimeSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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

  const handleEditProfile = () => {
    console.log('User tapped Edit Profile');
    router.push('/user-profile');
  };

  const formatServiceType = (serviceType: string): string => {
    return serviceType
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const convertHoursToDays = (hours: number | null | undefined): number => {
    if (hours === null || hours === undefined) return 0;
    return Math.floor(hours / 4);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const userName = profile?.name || 'User';
  const userEmail = profile?.email || user?.email || '';
  const avatarLetter = userName.charAt(0).toUpperCase();

  const hasConfirmedEntries = summary && summary.total_days > 0;

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
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
        <Text style={styles.headerSubtitle}>Your Sea Time Profile &amp; Reports</Text>
      </View>

      <View style={styles.profileSection}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{avatarLetter}</Text>
        </View>
        <Text style={styles.userName}>{userName}</Text>
        <Text style={styles.userEmail}>{userEmail}</Text>
      </View>

      <Text style={styles.sectionTitle}>Sea Time Summary</Text>
      {hasConfirmedEntries ? (
        <View style={styles.card}>
          <Text style={styles.emptyText}>Summary data available</Text>
        </View>
      ) : (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No confirmed sea time entries yet</Text>
        </View>
      )}

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

      <View style={styles.accountSection}>
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
        </View>
      </View>
    </ScrollView>
  );
}


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
    totalDaysCard: {
      backgroundColor: isDark ? colors.cardBackground : colors.card,
      borderRadius: 12,
      padding: 20,
      marginBottom: 16,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    totalDaysLabel: {
      fontSize: 18,
      fontWeight: '600',
      color: isDark ? colors.text : colors.textLight,
    },
    totalDaysValue: {
      fontSize: 32,
      fontWeight: 'bold',
      color: colors.primary,
    },
    vesselItem: {
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? colors.border : colors.borderLight,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    vesselItemLast: {
      borderBottomWidth: 0,
    },
    vesselName: {
      fontSize: 16,
      fontWeight: '500',
      color: isDark ? colors.text : colors.textLight,
    },
    vesselDays: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.primary,
    },
    serviceTypeItem: {
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? colors.border : colors.borderLight,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    serviceTypeItemLast: {
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
    infoCard: {
      backgroundColor: isDark ? '#1a2332' : '#e3f2fd',
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      borderLeftWidth: 4,
      borderLeftColor: colors.primary,
    },
    infoTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: isDark ? colors.text : colors.textLight,
      marginBottom: 8,
    },
    infoText: {
      fontSize: 14,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
      lineHeight: 20,
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
      paddingVertical: 20,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [(global as any).__GLOBAL_REFRESH_TRIGGER__]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadProfile(), loadSummary(), loadVessels()]);
    setRefreshing(false);
  }, [loadProfile, loadSummary, loadVessels]);

  const formatServiceType = (serviceType: string): string => {
    return serviceType
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const convertHoursToDays = (hours: number): number => {
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

  const totalDays = summary?.total_days || 0;
  const totalDaysText = Math.floor(totalDays).toString();

  const vesselsBySeaTime = summary?.entries_by_vessel || [];
  const serviceTypesBySeaTime = summary?.entries_by_service_type || [];

  return (
    <ScrollView 
      style={styles.container} 
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
      }
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
        <Text style={styles.headerSubtitle}>Your Sea Time Profile &amp; Reports</Text>
      </View>

      <View style={styles.totalDaysCard}>
        <Text style={styles.totalDaysLabel}>Total Days</Text>
        <Text style={styles.totalDaysValue}>{totalDaysText}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Sea Time by Vessel</Text>
        {vesselsBySeaTime.length > 0 ? (
          vesselsBySeaTime.map((vessel, index) => {
            const isLast = index === vesselsBySeaTime.length - 1;
            const vesselName = vessel.vessel_name;
            const days = vessel.total_days !== undefined 
              ? Math.floor(vessel.total_days) 
              : convertHoursToDays(vessel.total_hours);
            const daysText = `${days} days`;
            
            return (
              <View key={index} style={[styles.vesselItem, isLast && styles.vesselItemLast]}>
                <Text style={styles.vesselName}>{vesselName}</Text>
                <Text style={styles.vesselDays}>{daysText}</Text>
              </View>
            );
          })
        ) : (
          <Text style={styles.emptyText}>No vessel data available</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Sea Time by Service Type</Text>
        {serviceTypesBySeaTime.length > 0 ? (
          serviceTypesBySeaTime.map((entry, index) => {
            const isLast = index === serviceTypesBySeaTime.length - 1;
            const serviceTypeLabel = formatServiceType(entry.service_type);
            const value = entry.total_days !== undefined 
              ? Math.floor(entry.total_days) 
              : convertHoursToDays(entry.total_hours);
            const valueText = value.toString();
            
            return (
              <View key={entry.service_type} style={[styles.serviceTypeItem, isLast && styles.serviceTypeItemLast]}>
                <Text style={styles.serviceTypeLabel}>{serviceTypeLabel}</Text>
                <Text style={styles.serviceTypeValue}>{valueText}</Text>
              </View>
            );
          })
        ) : (
          <Text style={styles.emptyText}>No service type data available</Text>
        )}
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>Engineering Department - Sea Service Definitions (MSN 1904)</Text>
        <Text style={styles.infoText}>
          These definitions ensure your sea time records are compliant with MCA regulations for Engineering officers. All data capture in this app follows these standards.
        </Text>
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>Onboard Yacht Service</Text>
        <Text style={styles.infoText}>
          Service on yachts is recognized for MCA certification purposes when properly documented and verified.
        </Text>
      </View>
    </ScrollView>
  );
}

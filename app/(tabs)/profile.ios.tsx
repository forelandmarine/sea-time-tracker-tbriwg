
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
}

interface SeaTimeSummary {
  total_hours: number;
  total_days: number;
  entries_by_vessel: Array<{
    vessel_name: string;
    total_hours: number;
  }>;
  entries_by_month: Array<{
    month: string;
    total_hours: number;
  }>;
  entries_by_service_type?: Array<{
    service_type: string;
    total_hours: number;
  }>;
}

const createStyles = (isDark: boolean, topInset: number) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? colors.background : '#f5f5f5',
      paddingTop: topInset,
    },
    content: {
      padding: 20,
    },
    header: {
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
      backgroundColor: isDark ? '#2a2a2a' : '#ffffff',
      borderRadius: 12,
      padding: 15,
      marginBottom: 10,
    },
    summaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? '#444' : '#e0e0e0',
    },
    summaryRowLast: {
      borderBottomWidth: 0,
    },
    summaryLabel: {
      fontSize: 15,
      color: colors.text,
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
      backgroundColor: isDark ? '#333' : '#f0f0f0',
      borderRadius: 8,
      paddingHorizontal: 12,
      marginTop: 8,
    },
    totalLabel: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
    },
    totalValue: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.primary,
    },
    loadingText: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      paddingVertical: 10,
    },
    menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 15,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? '#444' : '#e0e0e0',
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
      color: colors.text,
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
  });

export default function ProfileScreen() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [summary, setSummary] = useState<SeaTimeSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [downloadingPDF, setDownloadingPDF] = useState(false);
  const [downloadingCSV, setDownloadingCSV] = useState(false);
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

  const handleDownloadPDF = async () => {
    console.log('User tapped Download PDF Report');
    setDownloadingPDF(true);
    try {
      const pdfBlob = await seaTimeApi.downloadPDFReport();
      console.log('PDF report downloaded, blob size:', pdfBlob.size);

      // For native, save to file system and share
      const fileUri = `${FileSystem.documentDirectory}SeaTime_Report_${new Date().toISOString().split('T')[0]}.pdf`;
      
      // Convert blob to base64
      const reader = new FileReader();
      reader.readAsDataURL(pdfBlob);
      reader.onloadend = async () => {
        const base64data = reader.result as string;
        const base64 = base64data.split(',')[1];
        
        await FileSystem.writeAsStringAsync(fileUri, base64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        
        console.log('PDF saved to:', fileUri);
        
        // Share the file
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri);
        } else {
          Alert.alert('Success', 'PDF report saved to device');
        }
      };
    } catch (error) {
      console.error('Failed to download PDF report:', error);
      Alert.alert('Error', 'Failed to download PDF report. Please try again.');
    } finally {
      setDownloadingPDF(false);
    }
  };

  const handleDownloadCSV = async () => {
    console.log('User tapped Download CSV Report');
    setDownloadingCSV(true);
    try {
      const csvData = await seaTimeApi.downloadCSVReport();
      console.log('CSV report downloaded, size:', csvData.length);

      // For native, save to file system and share
      const fileUri = `${FileSystem.documentDirectory}SeaTime_Report_${new Date().toISOString().split('T')[0]}.csv`;
      
      await FileSystem.writeAsStringAsync(fileUri, csvData, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      
      console.log('CSV saved to:', fileUri);
      
      // Share the file
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri);
      } else {
        Alert.alert('Success', 'CSV report saved to device');
      }
    } catch (error) {
      console.error('Failed to download CSV report:', error);
      Alert.alert('Error', 'Failed to download CSV report. Please try again.');
    } finally {
      setDownloadingCSV(false);
    }
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

  const getInitials = (name: string) => {
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

  const imageUrl = profile.imageUrl || profile.image;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.profileImageContainer}>
            {imageUrl ? (
              <Image source={{ uri: imageUrl }} style={styles.profileImage} />
            ) : (
              <Text style={styles.profileInitials}>{getInitials(profile.name)}</Text>
            )}
          </View>
          <Text style={styles.profileName}>{profile.name}</Text>
          <Text style={styles.profileEmail}>{profile.email}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sea Time Summary</Text>
          <View style={styles.card}>
            {loadingSummary ? (
              <Text style={styles.loadingText}>Loading summary...</Text>
            ) : summary ? (
              <>
                {summary.entries_by_vessel.map((vessel, index) => (
                  <View 
                    key={index} 
                    style={[
                      styles.summaryRow,
                      index === summary.entries_by_vessel.length - 1 && styles.summaryRowLast
                    ]}
                  >
                    <Text style={styles.summaryLabel}>{vessel.vessel_name}</Text>
                    <Text style={styles.summaryValue}>
                      {(vessel.total_hours / 24).toFixed(2)} days
                    </Text>
                  </View>
                ))}
                
                {summary.entries_by_vessel.length === 0 && (
                  <Text style={styles.loadingText}>No confirmed sea time entries yet</Text>
                )}

                {summary.entries_by_vessel.length > 0 && (
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Total Sea Time</Text>
                    <Text style={styles.totalValue}>{summary.total_days.toFixed(2)} days</Text>
                  </View>
                )}
              </>
            ) : (
              <Text style={styles.loadingText}>Unable to load summary</Text>
            )}
          </View>
        </View>

        {/* Service Type Breakdown */}
        {!loadingSummary && summary && summary.entries_by_service_type && summary.entries_by_service_type.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Sea Time by Service Type</Text>
            <View style={styles.card}>
              {summary.entries_by_service_type.map((serviceEntry, index) => (
                <View 
                  key={index} 
                  style={[
                    styles.summaryRow,
                    index === summary.entries_by_service_type!.length - 1 && styles.summaryRowLast
                  ]}
                >
                  <Text style={styles.summaryLabel}>{formatServiceType(serviceEntry.service_type)}</Text>
                  <Text style={styles.summaryValue}>
                    {(serviceEntry.total_hours / 24).toFixed(2)} days
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Reports</Text>
          <View style={styles.card}>
            <TouchableOpacity 
              style={styles.reportButton} 
              onPress={handleDownloadPDF}
              disabled={downloadingPDF}
            >
              {downloadingPDF ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <>
                  <IconSymbol
                    ios_icon_name="doc.fill"
                    android_material_icon_name="description"
                    size={24}
                    color="#ffffff"
                  />
                  <Text style={styles.reportButtonText}>Download PDF Report</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.reportButton} 
              onPress={handleDownloadCSV}
              disabled={downloadingCSV}
            >
              {downloadingCSV ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <>
                  <IconSymbol
                    ios_icon_name="tablecells"
                    android_material_icon_name="grid-on"
                    size={24}
                    color="#ffffff"
                  />
                  <Text style={styles.reportButtonText}>Download CSV Report</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
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
  );
}

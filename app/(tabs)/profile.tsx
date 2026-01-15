
import { IconSymbol } from '@/components/IconSymbol';
import * as seaTimeApi from '@/utils/seaTimeApi';
import React, { useState, useEffect } from 'react';
import { colors } from '@/styles/commonStyles';
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
} from 'react-native';
import * as Sharing from 'expo-sharing';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'expo-router';

interface ReportSummary {
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
}

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

function createStyles(isDark: boolean) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? colors.background : colors.backgroundLight,
    },
    scrollContent: {
      padding: 16,
      paddingTop: Platform.OS === 'android' ? 48 : 16,
      paddingBottom: 100,
    },
    userCard: {
      backgroundColor: isDark ? colors.cardBackground : colors.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 20,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
      flexDirection: 'row',
      alignItems: 'center',
    },
    profileImage: {
      width: 50,
      height: 50,
      borderRadius: 25,
      backgroundColor: isDark ? colors.background : colors.backgroundLight,
      marginRight: 12,
    },
    profileImagePlaceholder: {
      width: 50,
      height: 50,
      borderRadius: 25,
      backgroundColor: isDark ? colors.background : colors.backgroundLight,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    userInfo: {
      flex: 1,
    },
    userName: {
      fontSize: 16,
      fontWeight: '600',
      color: isDark ? colors.text : colors.textLight,
      marginBottom: 2,
    },
    userEmail: {
      fontSize: 14,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
    },
    chevron: {
      marginLeft: 8,
    },
    title: {
      fontSize: 28,
      fontWeight: 'bold',
      color: isDark ? colors.text : colors.textLight,
      marginBottom: 20,
    },
    summaryCard: {
      backgroundColor: isDark ? colors.cardBackground : colors.card,
      borderRadius: 12,
      padding: 20,
      marginBottom: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    summaryTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: isDark ? colors.text : colors.textLight,
      marginBottom: 16,
    },
    summaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12,
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
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.primary,
    },
    button: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
      marginBottom: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    buttonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
    },
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 40,
    },
    emptyStateText: {
      fontSize: 16,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
      textAlign: 'center',
      marginTop: 12,
    },
    loadingContainer: {
      padding: 20,
      alignItems: 'center',
    },
  });
}

export default function ReportsScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const styles = createStyles(isDark);
  const router = useRouter();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    console.log('User viewing Reports screen');
    try {
      setLoading(true);
      
      // Load profile and summary in parallel
      const [profileData, summaryData] = await Promise.all([
        seaTimeApi.getUserProfile(),
        seaTimeApi.getReportSummary(),
      ]);
      
      console.log('Profile loaded:', profileData.email);
      console.log('Report summary loaded:', summaryData);
      
      setProfile(profileData);
      setSummary(summaryData);
    } catch (error) {
      console.error('Failed to load reports data:', error);
      Alert.alert('Error', 'Failed to load reports data');
    } finally {
      setLoading(false);
    }
  };

  const handleUserCardPress = () => {
    console.log('User tapped user profile card, navigating to user-profile page');
    router.push('/user-profile');
  };

  const handleExportPDF = async () => {
    console.log('User tapped Export PDF button');
    try {
      const pdfBlob = await seaTimeApi.downloadPDFReport();
      const fileName = `seatime_report_${new Date().toISOString().split('T')[0]}.pdf`;
      
      if (Platform.OS === 'web') {
        console.log('Web platform: Triggering browser download for PDF');
        const url = URL.createObjectURL(pdfBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        Alert.alert('Success', 'PDF report downloaded successfully');
      } else {
        console.log('Native platform: Saving PDF to file system');
        const fileUri = `${FileSystem.documentDirectory}${fileName}`;
        
        const reader = new FileReader();
        reader.readAsDataURL(pdfBlob);
        reader.onloadend = async () => {
          const base64data = reader.result as string;
          const base64 = base64data.split(',')[1];
          
          await FileSystem.writeAsStringAsync(fileUri, base64, {
            encoding: FileSystem.EncodingType.Base64,
          });
          
          console.log('PDF file saved:', fileUri);
          
          const canShare = await Sharing.isAvailableAsync();
          if (canShare) {
            await Sharing.shareAsync(fileUri, {
              mimeType: 'application/pdf',
              dialogTitle: 'Export Sea Time PDF Report',
            });
          } else {
            Alert.alert('Success', `PDF report saved to: ${fileUri}`);
          }
        };
        
        reader.onerror = () => {
          console.error('Failed to read PDF blob');
          Alert.alert('Error', 'Failed to process PDF file');
        };
      }
    } catch (error) {
      console.error('Failed to export PDF:', error);
      Alert.alert('Error', 'Failed to export PDF report');
    }
  };

  const handleExportCSV = async () => {
    console.log('User tapped Export CSV button');
    try {
      const csvData = await seaTimeApi.downloadCSVReport();
      const fileName = `seatime_report_${new Date().toISOString().split('T')[0]}.csv`;
      
      if (Platform.OS === 'web') {
        console.log('Web platform: Triggering browser download for CSV');
        const blob = new Blob([csvData], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        Alert.alert('Success', 'CSV report downloaded successfully');
      } else {
        console.log('Native platform: Saving CSV to file system');
        const fileUri = `${FileSystem.documentDirectory}${fileName}`;
        
        await FileSystem.writeAsStringAsync(fileUri, csvData, {
          encoding: FileSystem.EncodingType.UTF8,
        });
        
        console.log('CSV file saved:', fileUri);
        
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'text/csv',
            dialogTitle: 'Export Sea Time Report',
          });
        } else {
          Alert.alert('Success', `Report saved to: ${fileUri}`);
        }
      }
    } catch (error) {
      console.error('Failed to export CSV:', error);
      Alert.alert('Error', 'Failed to export report');
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.emptyStateText}>Loading reports...</Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* Small User Card */}
      {profile && (
        <TouchableOpacity style={styles.userCard} onPress={handleUserCardPress}>
          {profile?.imageUrl || profile?.image ? (
            <Image source={{ uri: profile.imageUrl || profile.image || '' }} style={styles.profileImage} />
          ) : (
            <View style={styles.profileImagePlaceholder}>
              <IconSymbol
                ios_icon_name="person.circle.fill"
                android_material_icon_name="account-circle"
                size={40}
                color={colors.primary}
              />
            </View>
          )}
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{profile.name}</Text>
            <Text style={styles.userEmail}>{profile.email}</Text>
          </View>
          <IconSymbol
            ios_icon_name="chevron.right"
            android_material_icon_name="arrow-forward"
            size={20}
            color={isDark ? colors.textSecondary : colors.textSecondaryLight}
            style={styles.chevron}
          />
        </TouchableOpacity>
      )}

      <Text style={styles.title}>Sea Time Reports</Text>

      {summary && (
        <>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Sea Time Summary</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Hours</Text>
              <Text style={styles.summaryValue}>{summary.total_hours.toFixed(1)} hrs</Text>
            </View>
            <View style={[styles.summaryRow, styles.summaryRowLast]}>
              <Text style={styles.summaryLabel}>Total Days</Text>
              <Text style={styles.summaryValue}>{summary.total_days.toFixed(1)} days</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.button} onPress={handleExportPDF}>
            <Text style={styles.buttonText}>📄 Export PDF Report</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.button} onPress={handleExportCSV}>
            <Text style={styles.buttonText}>📊 Export CSV Report</Text>
          </TouchableOpacity>
        </>
      )}

      {!summary && (
        <View style={styles.emptyState}>
          <IconSymbol
            ios_icon_name="doc.text"
            android_material_icon_name="description"
            size={64}
            color={isDark ? colors.textSecondary : colors.textSecondaryLight}
          />
          <Text style={styles.emptyStateText}>No sea time data available yet</Text>
        </View>
      )}
    </ScrollView>
  );
}

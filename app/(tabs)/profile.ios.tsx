
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
  Share,
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

function createStyles(isDark: boolean) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? colors.background : colors.backgroundLight,
    },
    scrollContent: {
      padding: 16,
    },
    header: {
      marginBottom: 24,
      alignItems: 'center',
    },
    headerIcon: {
      marginBottom: 12,
    },
    title: {
      fontSize: 28,
      fontWeight: 'bold',
      color: isDark ? colors.text : colors.textLight,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 16,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
      textAlign: 'center',
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
    sectionCard: {
      backgroundColor: isDark ? colors.cardBackground : colors.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: isDark ? colors.text : colors.textLight,
      marginBottom: 12,
    },
    listItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 8,
    },
    listItemText: {
      fontSize: 14,
      color: isDark ? colors.text : colors.textLight,
      flex: 1,
    },
    listItemValue: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.primary,
      marginLeft: 12,
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
    infoCard: {
      backgroundColor: isDark ? colors.cardBackground : colors.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      borderLeftWidth: 4,
      borderLeftColor: colors.success,
    },
    infoText: {
      fontSize: 14,
      color: isDark ? colors.text : colors.textLight,
      lineHeight: 20,
    },
    userCard: {
      backgroundColor: isDark ? colors.cardBackground : colors.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      flexDirection: 'row',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    userInfo: {
      flex: 1,
      marginLeft: 12,
    },
    userName: {
      fontSize: 18,
      fontWeight: '600',
      color: isDark ? colors.text : colors.textLight,
      marginBottom: 4,
    },
    userEmail: {
      fontSize: 14,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
    },
    signOutButton: {
      backgroundColor: isDark ? colors.cardBackground : colors.card,
      borderWidth: 1,
      borderColor: colors.error,
    },
    signOutButtonText: {
      color: colors.error,
    },
  });
}

export default function ReportsScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const styles = createStyles(isDark);
  const { user, signOut } = useAuth();
  const router = useRouter();

  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSummary();
  }, []);

  const loadSummary = async () => {
    console.log('User viewing Reports screen');
    try {
      setLoading(true);
      const data = await seaTimeApi.getReportSummary();
      console.log('Report summary loaded:', data);
      setSummary(data);
    } catch (error) {
      console.error('Failed to load report summary:', error);
      Alert.alert('Error', 'Failed to load report summary');
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = async () => {
    console.log('User tapped Export CSV button');
    try {
      const csvData = await seaTimeApi.downloadCSVReport();
      
      const fileName = `seatime_report_${new Date().toISOString().split('T')[0]}.csv`;
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;
      
      await FileSystem.writeAsStringAsync(fileUri, csvData, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      
      console.log('CSV file saved:', fileUri);
      
      if (Platform.OS === 'ios' || Platform.OS === 'android') {
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'text/csv',
            dialogTitle: 'Export Sea Time Report',
          });
        } else {
          Alert.alert('Success', `Report saved to: ${fileUri}`);
        }
      } else {
        Alert.alert('Success', `Report saved to: ${fileUri}`);
      }
    } catch (error) {
      console.error('Failed to export CSV:', error);
      Alert.alert('Error', 'Failed to export report');
    }
  };

  const handleShareReport = async () => {
    console.log('User tapped Share Report button');
    if (!summary) return;

    const message = `Sea Time Report\n\nTotal Hours: ${summary.total_hours.toFixed(1)}\nTotal Days: ${summary.total_days.toFixed(1)}\n\nGenerated by SeaTime Tracker`;

    try {
      await Share.share({
        message,
        title: 'Sea Time Report',
      });
    } catch (error) {
      console.error('Failed to share report:', error);
    }
  };

  const handleSignOut = async () => {
    console.log('User tapped Sign Out button');
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
            try {
              await signOut();
              console.log('User signed out, navigating to auth screen');
              router.replace('/auth');
            } catch (error) {
              console.error('Sign out failed:', error);
              Alert.alert('Error', 'Failed to sign out');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>Loading report...</Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <IconSymbol
            ios_icon_name="chart.bar.fill"
            android_material_icon_name="assessment"
            size={48}
            color={colors.primary}
          />
        </View>
        <Text style={styles.title}>Reports & Export</Text>
        <Text style={styles.subtitle}>
          View your sea time summary and export records
        </Text>
      </View>

      {user && (
        <View style={styles.userCard}>
          <IconSymbol
            ios_icon_name="person.circle.fill"
            android_material_icon_name="account-circle"
            size={48}
            color={colors.primary}
          />
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{user.name || 'Seafarer'}</Text>
            <Text style={styles.userEmail}>{user.email}</Text>
          </View>
        </View>
      )}

      <View style={styles.infoCard}>
        <Text style={styles.infoText}>
          🔒 Your data is private and secure. All sea time records are tied to your account and protected by iOS-compliant authentication.
        </Text>
      </View>

      {summary && (
        <>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Total Sea Time</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Hours</Text>
              <Text style={styles.summaryValue}>{summary.total_hours.toFixed(1)} hrs</Text>
            </View>
            <View style={[styles.summaryRow, styles.summaryRowLast]}>
              <Text style={styles.summaryLabel}>Total Days</Text>
              <Text style={styles.summaryValue}>{summary.total_days.toFixed(1)} days</Text>
            </View>
          </View>

          {summary.entries_by_vessel.length > 0 && (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>By Vessel</Text>
              {summary.entries_by_vessel.map((vessel, index) => (
                <View key={index} style={styles.listItem}>
                  <Text style={styles.listItemText}>{vessel.vessel_name}</Text>
                  <Text style={styles.listItemValue}>{vessel.total_hours.toFixed(1)} hrs</Text>
                </View>
              ))}
            </View>
          )}

          {summary.entries_by_month.length > 0 && (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>By Month</Text>
              {summary.entries_by_month.map((month, index) => (
                <View key={index} style={styles.listItem}>
                  <Text style={styles.listItemText}>{month.month}</Text>
                  <Text style={styles.listItemValue}>{month.total_hours.toFixed(1)} hrs</Text>
                </View>
              ))}
            </View>
          )}

          <TouchableOpacity style={styles.button} onPress={handleExportCSV}>
            <Text style={styles.buttonText}>📄 Export CSV Report</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.button} onPress={handleShareReport}>
            <Text style={styles.buttonText}>📤 Share Report Summary</Text>
          </TouchableOpacity>
        </>
      )}

      {!summary && (
        <View style={styles.emptyState}>
          <IconSymbol
            ios_icon_name="chart.bar"
            android_material_icon_name="assessment"
            size={64}
            color={isDark ? colors.textSecondary : colors.textSecondaryLight}
          />
          <Text style={styles.emptyStateText}>
            No sea time entries yet.{'\n'}Start tracking vessels to generate reports.
          </Text>
        </View>
      )}

      <TouchableOpacity 
        style={[styles.button, styles.signOutButton]} 
        onPress={handleSignOut}
      >
        <Text style={[styles.buttonText, styles.signOutButtonText]}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

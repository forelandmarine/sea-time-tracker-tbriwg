
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  useColorScheme,
  RefreshControl,
  Switch,
  Platform,
} from 'react-native';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import * as seaTimeApi from '@/utils/seaTimeApi';

interface ScheduledTask {
  id: string;
  task_type: string;
  vessel_id: string | null;
  interval_hours: number;
  last_run: string | null;
  next_run: string | null;
  is_active: boolean;
  created_at: string;
}

function createStyles(isDark: boolean) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? colors.background : colors.backgroundLight,
    },
    header: {
      padding: 20,
      paddingTop: Platform.OS === 'ios' ? 60 : Platform.OS === 'android' ? 48 : 20,
      backgroundColor: isDark ? colors.cardBackground : colors.card,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? colors.border : colors.borderLight,
    },
    headerTitle: {
      fontSize: 28,
      fontWeight: '700',
      color: isDark ? colors.text : colors.textLight,
    },
    headerSubtitle: {
      fontSize: 14,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
      marginTop: 4,
    },
    scrollContent: {
      padding: 20,
      paddingBottom: 100,
    },
    section: {
      marginBottom: 32,
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
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: isDark ? colors.border : colors.borderLight,
      boxShadow: '0px 2px 8px rgba(0, 119, 190, 0.1)',
      elevation: 3,
    },
    taskHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    taskType: {
      fontSize: 16,
      fontWeight: '600',
      color: isDark ? colors.text : colors.textLight,
    },
    taskInfo: {
      fontSize: 14,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
      marginBottom: 4,
    },
    button: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
      marginBottom: 12,
    },
    buttonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },
    emptyState: {
      alignItems: 'center',
      padding: 32,
    },
    emptyText: {
      fontSize: 16,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
      textAlign: 'center',
      marginTop: 12,
    },
    statusBadge: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 12,
      alignSelf: 'flex-start',
      marginTop: 8,
    },
    statusText: {
      fontSize: 12,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    infoBox: {
      backgroundColor: isDark ? 'rgba(0, 119, 190, 0.15)' : 'rgba(0, 119, 190, 0.1)',
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      borderLeftWidth: 4,
      borderLeftColor: colors.primary,
    },
    infoText: {
      fontSize: 14,
      color: isDark ? colors.text : colors.textLight,
      lineHeight: 20,
    },
  });
}

export default function SettingsScreen() {
  const [scheduledTasks, setScheduledTasks] = useState<ScheduledTask[]>([]);
  const [vessels, setVessels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const styles = createStyles(isDark);

  useEffect(() => {
    console.log('[SettingsScreen] Component mounted');
    loadData();
  }, []);

  const loadData = async () => {
    console.log('[SettingsScreen] Loading scheduled tasks and vessels');
    try {
      const [tasks, vesselsData] = await Promise.all([
        seaTimeApi.getScheduledTasks(),
        seaTimeApi.getVessels(),
      ]);
      console.log('[SettingsScreen] Scheduled tasks loaded:', tasks.length);
      console.log('[SettingsScreen] Vessels loaded:', vesselsData.length);
      setScheduledTasks(tasks);
      setVessels(vesselsData);
    } catch (error) {
      console.error('[SettingsScreen] Error loading data:', error);
      Alert.alert('Error', 'Failed to load data. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    console.log('[SettingsScreen] User initiated refresh');
    setRefreshing(true);
    loadData();
  };

  const handleScheduleAISChecks = async () => {
    console.log('[SettingsScreen] User tapped Schedule AIS Checks button');
    
    // Find active vessel
    const activeVessel = vessels.find(v => v.is_active);
    
    if (!activeVessel) {
      Alert.alert(
        'No Active Vessel',
        'Please set an active vessel first before scheduling AIS checks.',
        [{ text: 'OK' }]
      );
      return;
    }
    
    Alert.alert(
      'Schedule AIS Checks',
      `This will automatically check AIS data for "${activeVessel.vessel_name}" every 4 hours.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Schedule',
          onPress: async () => {
            try {
              console.log('[SettingsScreen] Scheduling AIS checks for vessel:', activeVessel.id);
              await seaTimeApi.scheduleAISChecks(activeVessel.id, 4);
              Alert.alert('Success', `AIS checks scheduled successfully! The system will check "${activeVessel.vessel_name}" every 4 hours.`);
              loadData();
            } catch (error) {
              console.error('[SettingsScreen] Error scheduling AIS checks:', error);
              Alert.alert('Error', 'Failed to schedule AIS checks. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleToggleTask = async (taskId: string, currentStatus: boolean) => {
    console.log('[SettingsScreen] User toggled task:', taskId, 'to', !currentStatus);
    try {
      await seaTimeApi.toggleScheduledTask(taskId, !currentStatus);
      Alert.alert('Success', `Task ${!currentStatus ? 'enabled' : 'disabled'} successfully`);
      loadData();
    } catch (error) {
      console.error('[SettingsScreen] Error toggling task:', error);
      Alert.alert('Error', 'Failed to toggle task. Please try again.');
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Settings</Text>
          <Text style={styles.headerSubtitle}>Loading...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
        <Text style={styles.headerSubtitle}>Manage scheduled tasks and system configuration</Text>
      </View>
      
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            🔐 Security: All API calls to MyShipTracking are authenticated with a secure API key stored on the backend.
            {'\n\n'}
            ⏰ Scheduled Tasks: The system automatically checks AIS data every 4 hours for all active vessels.
            {'\n\n'}
            🐛 Debugging: Full request/response logging is enabled for troubleshooting.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Scheduled Tasks</Text>
          
          {scheduledTasks.length === 0 ? (
            <View style={styles.card}>
              <View style={styles.emptyState}>
                <IconSymbol
                  ios_icon_name="clock"
                  android_material_icon_name="schedule"
                  size={48}
                  color={isDark ? colors.textSecondary : colors.textSecondaryLight}
                />
                <Text style={styles.emptyText}>
                  No scheduled tasks configured.
                  {'\n\n'}
                  Set up automatic AIS checks to track vessel movements every 4 hours.
                </Text>
              </View>
            </View>
          ) : (
            scheduledTasks.map((task) => (
              <View key={task.id} style={styles.card}>
                <View style={styles.taskHeader}>
                  <Text style={styles.taskType}>
                    {task.task_type === 'ais_check' ? '📡 AIS Check' : task.task_type}
                  </Text>
                  <Switch
                    value={task.is_active}
                    onValueChange={() => handleToggleTask(task.id, task.is_active)}
                    trackColor={{ false: '#767577', true: colors.primary }}
                    thumbColor={task.is_active ? '#FFFFFF' : '#f4f3f4'}
                  />
                </View>
                
                <Text style={styles.taskInfo}>
                  ⏱️ Interval: Every {task.interval_hours} hours
                </Text>
                <Text style={styles.taskInfo}>
                  🕐 Last Run: {formatDate(task.last_run)}
                </Text>
                <Text style={styles.taskInfo}>
                  ⏭️ Next Run: {formatDate(task.next_run)}
                </Text>
                
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: task.is_active ? colors.success : colors.error },
                  ]}
                >
                  <Text style={styles.statusText}>
                    {task.is_active ? 'Active' : 'Inactive'}
                  </Text>
                </View>
              </View>
            ))
          )}

          <TouchableOpacity style={styles.button} onPress={handleScheduleAISChecks}>
            <Text style={styles.buttonText}>
              {scheduledTasks.length === 0 ? '⏰ Schedule AIS Checks' : '➕ Add New Schedule'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>System Information</Text>
          <View style={styles.card}>
            <Text style={styles.taskInfo}>
              🔐 Authentication: Secure API key (backend)
            </Text>
            <Text style={styles.taskInfo}>
              🌐 API Provider: MyShipTracking v2
            </Text>
            <Text style={styles.taskInfo}>
              📊 Logging: Full debug logging enabled
            </Text>
            <Text style={styles.taskInfo}>
              ⚡ Status: All systems operational
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

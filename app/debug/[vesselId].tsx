
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  useColorScheme,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import * as seaTimeApi from '@/utils/seaTimeApi';

interface AISDebugLog {
  timestamp: string;
  mmsi: string;
  url: string;
  status: number;
  response: any;
  error: string | null;
}

function createStyles(isDark: boolean) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? colors.backgroundDark : colors.backgroundLight,
    },
    scrollContent: {
      padding: 20,
      paddingBottom: 100,
    },
    header: {
      fontSize: 24,
      fontWeight: 'bold',
      color: isDark ? colors.textDark : colors.textLight,
      marginBottom: 16,
    },
    logCard: {
      backgroundColor: isDark ? colors.cardDark : colors.cardLight,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderLeftWidth: 4,
    },
    logTimestamp: {
      fontSize: 12,
      color: isDark ? colors.textSecondaryDark : colors.textSecondaryLight,
      marginBottom: 8,
    },
    logRow: {
      flexDirection: 'row',
      marginBottom: 4,
    },
    logLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: isDark ? colors.textDark : colors.textLight,
      width: 80,
    },
    logValue: {
      fontSize: 14,
      color: isDark ? colors.textDark : colors.textLight,
      flex: 1,
    },
    codeBlock: {
      backgroundColor: isDark ? '#1e1e1e' : '#f5f5f5',
      borderRadius: 8,
      padding: 12,
      marginTop: 8,
    },
    codeText: {
      fontSize: 12,
      fontFamily: 'monospace',
      color: isDark ? '#d4d4d4' : '#333333',
    },
    emptyState: {
      alignItems: 'center',
      padding: 32,
    },
    emptyText: {
      fontSize: 16,
      color: isDark ? colors.textSecondaryDark : colors.textSecondaryLight,
      textAlign: 'center',
      marginTop: 12,
    },
    backButton: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      marginBottom: 16,
    },
    backButtonText: {
      fontSize: 16,
      color: colors.primary,
      marginLeft: 8,
    },
  });
}

export default function DebugScreen() {
  const { vesselId } = useLocalSearchParams<{ vesselId: string }>();
  const [logs, setLogs] = useState<AISDebugLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const styles = createStyles(isDark);
  const router = useRouter();

  useEffect(() => {
    console.log('[DebugScreen] Loading debug logs for vessel:', vesselId);
    loadLogs();
  }, [vesselId]);

  const loadLogs = async () => {
    try {
      const debugLogs = await seaTimeApi.getAISDebugLogs(vesselId);
      console.log('[DebugScreen] Debug logs loaded:', debugLogs.length);
      setLogs(debugLogs);
    } catch (error) {
      console.error('[DebugScreen] Error loading debug logs:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    console.log('[DebugScreen] User initiated refresh');
    setRefreshing(true);
    loadLogs();
  };

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return colors.success;
    if (status >= 400 && status < 500) return colors.warning;
    if (status >= 500) return colors.error;
    return colors.primary;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'AIS Debug Logs',
          headerBackTitle: 'Back',
        }}
      />
      
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <Text style={styles.header}>🐛 AIS API Debug Logs</Text>

        {loading ? (
          <Text style={styles.emptyText}>Loading debug logs...</Text>
        ) : logs.length === 0 ? (
          <View style={styles.emptyState}>
            <IconSymbol
              ios_icon_name="exclamationmark.triangle"
              android_material_icon_name="warning"
              size={48}
              color={isDark ? colors.textSecondaryDark : colors.textSecondaryLight}
            />
            <Text style={styles.emptyText}>
              No debug logs available for this vessel yet.
              {'\n\n'}
              Check AIS data to generate logs.
            </Text>
          </View>
        ) : (
          logs.map((log, index) => (
            <View
              key={index}
              style={[
                styles.logCard,
                { borderLeftColor: getStatusColor(log.status) },
              ]}
            >
              <Text style={styles.logTimestamp}>
                {formatDate(log.timestamp)}
              </Text>

              <View style={styles.logRow}>
                <Text style={styles.logLabel}>MMSI:</Text>
                <Text style={styles.logValue}>{log.mmsi}</Text>
              </View>

              <View style={styles.logRow}>
                <Text style={styles.logLabel}>Status:</Text>
                <Text
                  style={[
                    styles.logValue,
                    { color: getStatusColor(log.status), fontWeight: '600' },
                  ]}
                >
                  {log.status}
                </Text>
              </View>

              <View style={styles.logRow}>
                <Text style={styles.logLabel}>URL:</Text>
                <Text style={[styles.logValue, { fontSize: 12 }]} numberOfLines={2}>
                  {log.url}
                </Text>
              </View>

              {log.error && (
                <View style={styles.logRow}>
                  <Text style={styles.logLabel}>Error:</Text>
                  <Text style={[styles.logValue, { color: colors.error }]}>
                    {log.error}
                  </Text>
                </View>
              )}

              {log.response && (
                <View style={styles.codeBlock}>
                  <Text style={styles.codeText}>
                    {JSON.stringify(log.response, null, 2)}
                  </Text>
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

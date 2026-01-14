
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  useColorScheme,
  RefreshControl,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import * as seaTimeApi from '@/utils/seaTimeApi';
import { colors } from '@/styles/commonStyles';

interface AISDebugLog {
  id: string;
  mmsi: string;
  api_url: string;
  request_time: string;
  response_status: string;
  response_body: string | null;
  authentication_status: string;
  error_message: string | null;
  created_at: string;
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
      marginBottom: 16,
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      color: isDark ? colors.text : colors.textLight,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 14,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
    },
    logCard: {
      backgroundColor: isDark ? colors.cardBackground : colors.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: isDark ? colors.border : colors.borderLight,
    },
    logHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    logTime: {
      fontSize: 12,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
    },
    statusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 4,
    },
    statusText: {
      fontSize: 12,
      fontWeight: '600',
      color: '#fff',
    },
    logRow: {
      flexDirection: 'row',
      marginBottom: 8,
    },
    logLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: isDark ? colors.text : colors.textLight,
      width: 100,
    },
    logValue: {
      fontSize: 13,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
      flex: 1,
    },
    expandButton: {
      marginTop: 8,
      paddingVertical: 8,
      alignItems: 'center',
    },
    expandButtonText: {
      fontSize: 13,
      color: colors.primary,
      fontWeight: '600',
    },
    responseBody: {
      marginTop: 12,
      padding: 12,
      backgroundColor: isDark ? '#1a1a1a' : '#f5f5f5',
      borderRadius: 8,
    },
    responseBodyText: {
      fontSize: 12,
      fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
      color: isDark ? colors.text : colors.textLight,
    },
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 48,
    },
    emptyStateText: {
      fontSize: 16,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
      textAlign: 'center',
      marginTop: 16,
    },
    coordinatesContainer: {
      marginTop: 8,
      padding: 12,
      backgroundColor: isDark ? '#1a3a1a' : '#e8f5e9',
      borderRadius: 8,
      borderWidth: 1,
      borderColor: isDark ? '#2e7d32' : '#4caf50',
    },
    coordinatesTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: isDark ? '#81c784' : '#2e7d32',
      marginBottom: 8,
    },
    coordinatesText: {
      fontSize: 12,
      color: isDark ? '#a5d6a7' : '#388e3c',
      marginBottom: 4,
    },
  });
}

export default function DebugScreen() {
  const { vesselId } = useLocalSearchParams<{ vesselId: string }>();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const styles = createStyles(isDark);

  const [logs, setLogs] = useState<AISDebugLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());

  const loadLogs = useCallback(async () => {
    console.log('Loading AIS debug logs for vessel:', vesselId);
    try {
      setLoading(true);
      const data = await seaTimeApi.getAISDebugLogs(vesselId);
      console.log('Loaded', data.length, 'debug logs');
      setLogs(data);
    } catch (error) {
      console.error('Failed to load debug logs:', error);
    } finally {
      setLoading(false);
    }
  }, [vesselId]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const onRefresh = () => {
    console.log('User pulled to refresh debug logs');
    loadLogs();
  };

  const toggleExpanded = (logId: string) => {
    console.log('User toggled log expansion:', logId);
    setExpandedLogs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(logId)) {
        newSet.delete(logId);
      } else {
        newSet.add(logId);
      }
      return newSet;
    });
  };

  const getStatusColor = (statusString: string): string => {
    const status = parseInt(statusString);
    if (status >= 200 && status < 300) return colors.success;
    if (status >= 400 && status < 500) return colors.warning;
    if (status >= 500) return colors.error;
    return '#9e9e9e';
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const formatAuthStatus = (status: string): string => {
    if (status === 'authenticated') return '✅ Authenticated';
    if (status === 'unauthenticated') return '❌ Unauthenticated';
    if (status === 'api_key_masked') return '🔒 API Key Masked';
    return status;
  };

  const parseResponseBody = (body: string | null): any => {
    if (!body) return null;
    try {
      return JSON.parse(body);
    } catch {
      return body;
    }
  };

  const extractCoordinates = (body: string | null): { lat: number; lon: number } | null => {
    if (!body) return null;
    try {
      const data = JSON.parse(body);
      const lat = data.latitude || data.lat || data.position?.latitude;
      const lon = data.longitude || data.lng || data.position?.longitude;
      if (lat && lon) {
        return { lat, lon };
      }
    } catch {
      // Ignore parse errors
    }
    return null;
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'AIS Debug Logs',
          headerStyle: {
            backgroundColor: isDark ? colors.background : colors.backgroundLight,
          },
          headerTintColor: isDark ? colors.text : colors.textLight,
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => {
                console.log('User tapped back button');
                router.back();
              }}
              style={{ marginLeft: 8 }}
            >
              <IconSymbol
                ios_icon_name="chevron.left"
                android_material_icon_name="arrow-back"
                size={24}
                color={isDark ? colors.text : colors.textLight}
              />
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={onRefresh} />
        }
      >
        <View style={styles.header}>
          <Text style={styles.title}>AIS API Debug Logs</Text>
          <Text style={styles.subtitle}>
            Showing API calls and responses for vessel {vesselId}
          </Text>
        </View>

        {logs.length === 0 && !loading ? (
          <View style={styles.emptyState}>
            <IconSymbol
              ios_icon_name="doc.text.magnifyingglass"
              android_material_icon_name="search"
              size={64}
              color={isDark ? colors.textSecondary : colors.textSecondaryLight}
            />
            <Text style={styles.emptyStateText}>
              No debug logs found for this vessel.{'\n'}
              Try checking the vessel's AIS data to generate logs.
            </Text>
          </View>
        ) : (
          logs.map((log) => {
            const isExpanded = expandedLogs.has(log.id);
            const coordinates = extractCoordinates(log.response_body);

            return (
              <View key={log.id} style={styles.logCard}>
                <View style={styles.logHeader}>
                  <Text style={styles.logTime}>{formatDate(log.request_time)}</Text>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: getStatusColor(log.response_status) },
                    ]}
                  >
                    <Text style={styles.statusText}>{log.response_status}</Text>
                  </View>
                </View>

                <View style={styles.logRow}>
                  <Text style={styles.logLabel}>MMSI:</Text>
                  <Text style={styles.logValue}>{log.mmsi}</Text>
                </View>

                <View style={styles.logRow}>
                  <Text style={styles.logLabel}>Auth Status:</Text>
                  <Text style={styles.logValue}>{formatAuthStatus(log.authentication_status)}</Text>
                </View>

                {log.error_message && (
                  <View style={styles.logRow}>
                    <Text style={styles.logLabel}>Error:</Text>
                    <Text style={[styles.logValue, { color: colors.error }]}>
                      {log.error_message}
                    </Text>
                  </View>
                )}

                {coordinates && (
                  <View style={styles.coordinatesContainer}>
                    <Text style={styles.coordinatesTitle}>📍 Vessel Position</Text>
                    <Text style={styles.coordinatesText}>
                      Latitude: {coordinates.lat.toFixed(6)}°
                    </Text>
                    <Text style={styles.coordinatesText}>
                      Longitude: {coordinates.lon.toFixed(6)}°
                    </Text>
                  </View>
                )}

                <TouchableOpacity
                  style={styles.expandButton}
                  onPress={() => toggleExpanded(log.id)}
                >
                  <Text style={styles.expandButtonText}>
                    {isExpanded ? '▼ Hide Details' : '▶ Show Details'}
                  </Text>
                </TouchableOpacity>

                {isExpanded && (
                  <>
                    <View style={styles.logRow}>
                      <Text style={styles.logLabel}>API URL:</Text>
                      <Text style={[styles.logValue, { fontSize: 11 }]}>{log.api_url}</Text>
                    </View>

                    {log.response_body && (
                      <View style={styles.responseBody}>
                        <Text style={styles.responseBodyText}>
                          {JSON.stringify(parseResponseBody(log.response_body), null, 2)}
                        </Text>
                      </View>
                    )}
                  </>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

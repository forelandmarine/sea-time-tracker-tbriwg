
import React, { useState, useEffect } from 'react';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
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
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import * as seaTimeApi from '@/utils/seaTimeApi';

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
      paddingTop: Platform.OS === 'android' ? 0 : 0,
    },
    scrollContent: {
      padding: 20,
      paddingBottom: 100,
    },
    header: {
      fontSize: 28,
      fontWeight: 'bold',
      color: isDark ? colors.text : colors.textLight,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 14,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
      marginBottom: 24,
    },
    logCard: {
      backgroundColor: isDark ? colors.cardBackground : colors.card,
      borderRadius: 16,
      padding: 18,
      marginBottom: 16,
      borderLeftWidth: 4,
      borderColor: isDark ? colors.border : colors.borderLight,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 3,
    },
    logHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? colors.border : colors.borderLight,
    },
    logTimestamp: {
      fontSize: 13,
      fontWeight: '600',
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
    },
    statusBadge: {
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 12,
      backgroundColor: colors.primary,
    },
    statusText: {
      fontSize: 12,
      fontWeight: 'bold',
      color: '#FFFFFF',
    },
    logRow: {
      flexDirection: 'row',
      marginBottom: 8,
      alignItems: 'flex-start',
    },
    logLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.primary,
      width: 90,
      marginRight: 8,
    },
    logValue: {
      fontSize: 14,
      color: isDark ? colors.text : colors.textLight,
      flex: 1,
      lineHeight: 20,
    },
    authBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? 'rgba(76, 175, 80, 0.1)' : 'rgba(76, 175, 80, 0.05)',
      borderRadius: 8,
      padding: 8,
      marginTop: 8,
      borderLeftWidth: 3,
      borderLeftColor: colors.success,
    },
    authBadgeError: {
      backgroundColor: isDark ? 'rgba(211, 47, 47, 0.1)' : 'rgba(211, 47, 47, 0.05)',
      borderLeftColor: colors.error,
    },
    authLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.success,
      marginRight: 6,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    authLabelError: {
      color: colors.error,
    },
    authText: {
      fontSize: 12,
      color: isDark ? colors.text : colors.textLight,
      flex: 1,
    },
    errorContainer: {
      backgroundColor: isDark ? 'rgba(211, 47, 47, 0.1)' : 'rgba(211, 47, 47, 0.05)',
      borderRadius: 8,
      padding: 12,
      marginTop: 8,
      borderLeftWidth: 3,
      borderLeftColor: colors.error,
    },
    errorLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.error,
      marginBottom: 4,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    errorText: {
      fontSize: 13,
      color: colors.error,
      lineHeight: 18,
    },
    expandButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: isDark ? 'rgba(0, 122, 255, 0.1)' : 'rgba(0, 122, 255, 0.05)',
      borderRadius: 8,
      padding: 12,
      marginTop: 12,
      borderWidth: 1,
      borderColor: isDark ? colors.border : colors.borderLight,
    },
    expandButtonText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.primary,
      flex: 1,
    },
    codeBlock: {
      backgroundColor: isDark ? '#0D1B2A' : '#F5F9FC',
      borderRadius: 8,
      padding: 12,
      marginTop: 8,
      borderWidth: 1,
      borderColor: isDark ? colors.border : colors.borderLight,
      maxHeight: 300,
    },
    codeText: {
      fontSize: 11,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
      lineHeight: 16,
    },
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      padding: 48,
      marginTop: 60,
    },
    emptyIconContainer: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: isDark ? colors.cardBackground : colors.card,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 20,
      borderWidth: 2,
      borderColor: isDark ? colors.border : colors.borderLight,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: isDark ? colors.text : colors.textLight,
      textAlign: 'center',
      marginBottom: 8,
    },
    emptyText: {
      fontSize: 14,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
      textAlign: 'center',
      lineHeight: 20,
      maxWidth: 280,
    },
    loadingContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      padding: 48,
      marginTop: 60,
    },
    loadingText: {
      fontSize: 16,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
      marginTop: 16,
    },
  });
}

export default function DebugScreen() {
  const { vesselId } = useLocalSearchParams<{ vesselId: string }>();
  const [logs, setLogs] = useState<AISDebugLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());
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
      console.log('[DebugScreen] First log sample:', debugLogs[0]);
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

  const toggleExpanded = (logId: string) => {
    console.log('[DebugScreen] User toggled expand for log:', logId);
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

  const getStatusColor = (statusString: string) => {
    const status = parseInt(statusString);
    if (isNaN(status)) {
      // Handle non-numeric status strings like "connection_error"
      if (statusString.includes('error') || statusString.includes('failed')) {
        return colors.error;
      }
      return colors.textSecondary;
    }
    if (status >= 200 && status < 300) return colors.success;
    if (status >= 400 && status < 500) return colors.warning;
    if (status >= 500) return colors.error;
    return colors.primary;
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return 'Invalid Date';
      }
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      
      return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (error) {
      console.error('[DebugScreen] Error formatting date:', dateString, error);
      return 'Invalid Date';
    }
  };

  const formatAuthStatus = (status: string) => {
    switch (status) {
      case 'success':
        return '✓ Authenticated';
      case 'authentication_failed':
        return '✗ Auth Failed';
      case 'connection_error':
        return '✗ Connection Error';
      case 'rate_limited':
        return '⚠ Rate Limited';
      default:
        return status;
    }
  };

  const parseResponseBody = (body: string | null) => {
    if (!body) return null;
    try {
      const parsed = JSON.parse(body);
      return JSON.stringify(parsed, null, 2);
    } catch (error) {
      return body;
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'AIS Debug Logs',
          headerBackTitle: 'Back',
          headerStyle: {
            backgroundColor: isDark ? colors.background : colors.backgroundLight,
          },
          headerTintColor: colors.primary,
          headerTitleStyle: {
            color: isDark ? colors.text : colors.textLight,
          },
        }}
      />
      
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        <Text style={styles.header}>🐛 Debug Logs</Text>
        <Text style={styles.subtitle}>
          API call history and diagnostic information
        </Text>

        {loading ? (
          <View style={styles.loadingContainer}>
            <IconSymbol
              ios_icon_name="arrow.clockwise"
              android_material_icon_name="refresh"
              size={48}
              color={colors.primary}
            />
            <Text style={styles.loadingText}>Loading debug logs...</Text>
          </View>
        ) : logs.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <IconSymbol
                ios_icon_name="doc.text.magnifyingglass"
                android_material_icon_name="search"
                size={40}
                color={isDark ? colors.textSecondary : colors.textSecondaryLight}
              />
            </View>
            <Text style={styles.emptyTitle}>No Debug Logs Yet</Text>
            <Text style={styles.emptyText}>
              Debug logs will appear here after AIS data checks are performed. Pull down to refresh.
            </Text>
          </View>
        ) : (
          logs.map((log, index) => {
            const isExpanded = expandedLogs.has(log.id);
            return (
              <View
                key={log.id || index}
                style={[
                  styles.logCard,
                  { borderLeftColor: getStatusColor(log.response_status) },
                ]}
              >
                <View style={styles.logHeader}>
                  <Text style={styles.logTimestamp}>
                    {formatDate(log.request_time)}
                  </Text>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(log.response_status) }]}>
                    <Text style={styles.statusText}>{log.response_status}</Text>
                  </View>
                </View>

                <View style={styles.logRow}>
                  <Text style={styles.logLabel}>MMSI</Text>
                  <Text style={styles.logValue}>{log.mmsi}</Text>
                </View>

                <View style={[
                  styles.authBadge,
                  log.authentication_status !== 'success' && styles.authBadgeError
                ]}>
                  <Text style={[
                    styles.authLabel,
                    log.authentication_status !== 'success' && styles.authLabelError
                  ]}>
                    AUTH:
                  </Text>
                  <Text style={styles.authText}>
                    {formatAuthStatus(log.authentication_status)}
                  </Text>
                </View>

                {log.error_message && (
                  <View style={styles.errorContainer}>
                    <Text style={styles.errorLabel}>⚠️ Error</Text>
                    <Text style={styles.errorText}>{log.error_message}</Text>
                  </View>
                )}

                {log.response_body && (
                  <>
                    <TouchableOpacity
                      style={styles.expandButton}
                      onPress={() => toggleExpanded(log.id)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.expandButtonText}>
                        {isExpanded ? 'Hide Response Data' : 'Show Response Data'}
                      </Text>
                      <IconSymbol
                        ios_icon_name={isExpanded ? "chevron.up" : "chevron.down"}
                        android_material_icon_name={isExpanded ? "expand-less" : "expand-more"}
                        size={20}
                        color={colors.primary}
                      />
                    </TouchableOpacity>

                    {isExpanded && (
                      <ScrollView 
                        style={styles.codeBlock}
                        nestedScrollEnabled
                        showsVerticalScrollIndicator={true}
                      >
                        <Text style={styles.codeText}>
                          {parseResponseBody(log.response_body)}
                        </Text>
                      </ScrollView>
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

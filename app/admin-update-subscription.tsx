
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  useColorScheme,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Stack } from 'expo-router';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { authenticatedPost } from '@/utils/api';

const TARGET_EMAILS = [
  'maud.collette@gmail.com',
  'info@forelandmarine.com',
  'test@seatime.com',
  'jimmy.milne44@outlook.com',
  'cjbrowning23@hotmail.com',
  'jack@forelandmarine.com',
  'macnally@me.com',
  'dan@forelandmarine.com',
];

function createStyles(isDark: boolean) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? colors.backgroundDark : colors.backgroundLight,
    },
    scrollContent: {
      padding: 20,
    },
    header: {
      marginBottom: 24,
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      color: isDark ? colors.textDark : colors.textLight,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 14,
      color: isDark ? colors.textSecondaryDark : colors.textSecondaryLight,
      lineHeight: 20,
    },
    section: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: isDark ? colors.textDark : colors.textLight,
      marginBottom: 12,
    },
    emailList: {
      backgroundColor: isDark ? colors.cardDark : colors.cardLight,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
    },
    emailItem: {
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
    },
    emailItemLast: {
      borderBottomWidth: 0,
    },
    emailText: {
      fontSize: 14,
      color: isDark ? colors.textDark : colors.textLight,
      fontFamily: 'monospace',
    },
    statusSelector: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 16,
    },
    statusButton: {
      flex: 1,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 8,
      borderWidth: 2,
      borderColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)',
      alignItems: 'center',
    },
    statusButtonActive: {
      borderColor: colors.primary,
      backgroundColor: isDark ? 'rgba(0,122,255,0.2)' : 'rgba(0,122,255,0.1)',
    },
    statusButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: isDark ? colors.textDark : colors.textLight,
    },
    statusButtonTextActive: {
      color: colors.primary,
    },
    updateButton: {
      backgroundColor: colors.primary,
      paddingVertical: 16,
      borderRadius: 12,
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 8,
    },
    updateButtonDisabled: {
      opacity: 0.5,
    },
    updateButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },
    resultCard: {
      backgroundColor: isDark ? colors.cardDark : colors.cardLight,
      borderRadius: 12,
      padding: 16,
      marginTop: 16,
    },
    resultTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: isDark ? colors.textDark : colors.textLight,
      marginBottom: 12,
    },
    resultText: {
      fontSize: 14,
      color: isDark ? colors.textDark : colors.textLight,
      marginBottom: 8,
    },
    successText: {
      color: '#34C759',
    },
    errorText: {
      color: '#FF3B30',
    },
    warningCard: {
      backgroundColor: isDark ? 'rgba(255,149,0,0.2)' : 'rgba(255,149,0,0.1)',
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      borderLeftWidth: 4,
      borderLeftColor: '#FF9500',
    },
    warningText: {
      fontSize: 14,
      color: isDark ? colors.textDark : colors.textLight,
      lineHeight: 20,
    },
  });
}

export default function AdminUpdateSubscriptionScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const styles = createStyles(isDark);

  const [selectedStatus, setSelectedStatus] = useState<'active' | 'inactive'>('active');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    updated_count?: number;
    updated_emails?: string[];
    not_found_emails?: string[];
    error?: string;
  } | null>(null);

  const handleUpdateSubscriptions = async () => {
    console.log('Admin: Updating subscription status to:', selectedStatus);
    console.log('Admin: Target emails:', TARGET_EMAILS);

    setLoading(true);
    setResult(null);

    try {
      const response = await authenticatedPost('/api/admin/update-subscription-status', {
        emails: TARGET_EMAILS,
        subscription_status: selectedStatus,
      });

      console.log('Admin: Subscription update response:', response);
      setResult(response);

      if (response.success) {
        const updatedCount = response.updated_count || 0;
        const successMessage = `Successfully updated ${updatedCount} user${updatedCount !== 1 ? 's' : ''} to ${selectedStatus} status.`;
        Alert.alert('Success', successMessage);
      }
    } catch (error: any) {
      console.error('Admin: Error updating subscriptions:', error);
      const errorMessage = error.message || 'Failed to update subscriptions';
      setResult({
        success: false,
        error: errorMessage,
      });
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const updatedCount = result?.updated_count || 0;
  const notFoundCount = result?.not_found_emails?.length || 0;

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Update Subscriptions',
          headerStyle: {
            backgroundColor: isDark ? colors.backgroundDark : colors.backgroundLight,
          },
          headerTintColor: isDark ? colors.textDark : colors.textLight,
        }}
      />

      <ScrollView style={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Admin: Update Subscription Status</Text>
          <Text style={styles.subtitle}>
            Update subscription status for multiple users directly in the database.
          </Text>
        </View>

        <View style={styles.warningCard}>
          <Text style={styles.warningText}>
            ⚠️ This is an admin operation. You must be logged in as an admin user to perform this action.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Target Users ({TARGET_EMAILS.length})</Text>
          <View style={styles.emailList}>
            {TARGET_EMAILS.map((email, index) => (
              <View
                key={index}
                style={[
                  styles.emailItem,
                  index === TARGET_EMAILS.length - 1 && styles.emailItemLast,
                ]}
              >
                <Text style={styles.emailText}>{email}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Subscription Status</Text>
          <View style={styles.statusSelector}>
            <TouchableOpacity
              style={[
                styles.statusButton,
                selectedStatus === 'active' && styles.statusButtonActive,
              ]}
              onPress={() => setSelectedStatus('active')}
            >
              <Text
                style={[
                  styles.statusButtonText,
                  selectedStatus === 'active' && styles.statusButtonTextActive,
                ]}
              >
                Active
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.statusButton,
                selectedStatus === 'inactive' && styles.statusButtonActive,
              ]}
              onPress={() => setSelectedStatus('inactive')}
            >
              <Text
                style={[
                  styles.statusButtonText,
                  selectedStatus === 'inactive' && styles.statusButtonTextActive,
                ]}
              >
                Inactive
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.updateButton, loading && styles.updateButtonDisabled]}
            onPress={handleUpdateSubscriptions}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <IconSymbol
                  ios_icon_name="checkmark.circle.fill"
                  android_material_icon_name="check-circle"
                  size={20}
                  color="#FFFFFF"
                />
                <Text style={styles.updateButtonText}>
                  Update to {selectedStatus === 'active' ? 'Active' : 'Inactive'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {result && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Result</Text>
            <View style={styles.resultCard}>
              {result.success ? (
                <>
                  <Text style={[styles.resultTitle, styles.successText]}>
                    ✓ Success
                  </Text>
                  <Text style={styles.resultText}>
                    Updated: {updatedCount} user{updatedCount !== 1 ? 's' : ''}
                  </Text>
                  {notFoundCount > 0 && (
                    <Text style={[styles.resultText, styles.errorText]}>
                      Not found: {notFoundCount} user{notFoundCount !== 1 ? 's' : ''}
                    </Text>
                  )}
                  {result.updated_emails && result.updated_emails.length > 0 && (
                    <View style={{ marginTop: 12 }}>
                      <Text style={[styles.resultText, { fontWeight: '600' }]}>
                        Updated emails:
                      </Text>
                      {result.updated_emails.map((email, index) => (
                        <Text key={index} style={[styles.emailText, { marginTop: 4 }]}>
                          • {email}
                        </Text>
                      ))}
                    </View>
                  )}
                  {result.not_found_emails && result.not_found_emails.length > 0 && (
                    <View style={{ marginTop: 12 }}>
                      <Text style={[styles.resultText, { fontWeight: '600' }]}>
                        Not found:
                      </Text>
                      {result.not_found_emails.map((email, index) => (
                        <Text key={index} style={[styles.emailText, { marginTop: 4 }]}>
                          • {email}
                        </Text>
                      ))}
                    </View>
                  )}
                </>
              ) : (
                <>
                  <Text style={[styles.resultTitle, styles.errorText]}>
                    ✗ Error
                  </Text>
                  <Text style={styles.resultText}>
                    {result.error || 'Failed to update subscriptions'}
                  </Text>
                </>
              )}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

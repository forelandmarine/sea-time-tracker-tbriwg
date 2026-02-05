
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  useColorScheme,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { colors } from '@/styles/commonStyles';
import { authenticatedPost } from '@/utils/api';
import { IconSymbol } from '@/components/IconSymbol';

function createStyles(isDark: boolean) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? colors.backgroundDark : colors.backgroundLight,
    },
    content: {
      padding: 20,
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      color: isDark ? colors.textDark : colors.textLight,
      marginBottom: 10,
    },
    description: {
      fontSize: 16,
      color: isDark ? colors.textSecondaryDark : colors.textSecondaryLight,
      marginBottom: 30,
      lineHeight: 24,
    },
    warningBox: {
      backgroundColor: isDark ? '#3a2a1a' : '#fff3cd',
      borderRadius: 12,
      padding: 16,
      marginBottom: 30,
      borderWidth: 1,
      borderColor: isDark ? '#6a4a2a' : '#ffc107',
    },
    warningTitle: {
      fontSize: 16,
      fontWeight: 'bold',
      color: isDark ? '#ffc107' : '#856404',
      marginBottom: 8,
    },
    warningText: {
      fontSize: 14,
      color: isDark ? '#ffd54f' : '#856404',
      lineHeight: 20,
    },
    button: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
      marginBottom: 20,
    },
    buttonDisabled: {
      opacity: 0.5,
    },
    buttonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },
    resultBox: {
      backgroundColor: isDark ? '#1a3a1a' : '#d4edda',
      borderRadius: 12,
      padding: 16,
      marginTop: 20,
      borderWidth: 1,
      borderColor: isDark ? '#2a6a2a' : '#28a745',
    },
    resultTitle: {
      fontSize: 16,
      fontWeight: 'bold',
      color: isDark ? '#4caf50' : '#155724',
      marginBottom: 8,
    },
    resultText: {
      fontSize: 14,
      color: isDark ? '#81c784' : '#155724',
      lineHeight: 20,
    },
    errorBox: {
      backgroundColor: isDark ? '#3a1a1a' : '#f8d7da',
      borderRadius: 12,
      padding: 16,
      marginTop: 20,
      borderWidth: 1,
      borderColor: isDark ? '#6a2a2a' : '#dc3545',
    },
    errorTitle: {
      fontSize: 16,
      fontWeight: 'bold',
      color: isDark ? '#f44336' : '#721c24',
      marginBottom: 8,
    },
    errorText: {
      fontSize: 14,
      color: isDark ? '#ef5350' : '#721c24',
      lineHeight: 20,
    },
  });
}

export default function AdminActivateSubscriptionsScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const styles = createStyles(isDark);
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    usersUpdated?: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleActivateAllSubscriptions = async () => {
    console.log('User tapped Activate All Subscriptions button');
    
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      console.log('Calling POST /api/admin/activate-all-subscriptions');
      
      // TODO: Backend Integration - POST /api/admin/activate-all-subscriptions
      // This endpoint will update all users to have active subscriptions for testing
      const response = await authenticatedPost('/api/admin/activate-all-subscriptions', {});
      
      console.log('Subscription activation response:', response);
      
      const successMessage = `Successfully activated subscriptions for ${response.usersUpdated || 0} users`;
      
      setResult({
        success: true,
        message: successMessage,
        usersUpdated: response.usersUpdated,
      });

      console.log(successMessage);
    } catch (err: any) {
      console.error('Error activating subscriptions:', err);
      const errorMessage = err.message || 'Failed to activate subscriptions';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Activate Subscriptions',
          headerShown: true,
          headerBackTitle: 'Back',
        }}
      />
      <ScrollView style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.title}>
            Activate All Subscriptions
          </Text>
          
          <Text style={styles.description}>
            This admin tool will flag all current users in the database as having valid, active app subscriptions for testing purposes.
          </Text>

          <View style={styles.warningBox}>
            <Text style={styles.warningTitle}>
              ⚠️ Testing Tool
            </Text>
            <Text style={styles.warningText}>
              This is a development/testing feature. It will set all users to have:
            </Text>
            <Text style={styles.warningText}>
              • subscription_status = 'active'
            </Text>
            <Text style={styles.warningText}>
              • subscription_expires_at = 1 year from now
            </Text>
            <Text style={styles.warningText}>
              • subscription_product_id = 'test_subscription'
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleActivateAllSubscriptions}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>
                Activate All User Subscriptions
              </Text>
            )}
          </TouchableOpacity>

          {result && (
            <View style={styles.resultBox}>
              <Text style={styles.resultTitle}>
                ✅ Success
              </Text>
              <Text style={styles.resultText}>
                {result.message}
              </Text>
              {result.usersUpdated !== undefined && (
                <Text style={styles.resultText}>
                  Users updated: {result.usersUpdated}
                </Text>
              )}
            </View>
          )}

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorTitle}>
                ❌ Error
              </Text>
              <Text style={styles.errorText}>
                {error}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </>
  );
}

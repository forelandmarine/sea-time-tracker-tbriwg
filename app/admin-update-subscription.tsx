
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  ActivityIndicator,
  ScrollView,
  Modal,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { colors } from '@/styles/commonStyles';
import { authenticatedPost } from '@/utils/api';

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
    inputGroup: {
      marginBottom: 20,
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
      color: isDark ? colors.textDark : colors.textLight,
      marginBottom: 8,
    },
    input: {
      backgroundColor: isDark ? '#2a2a2a' : '#ffffff',
      borderRadius: 12,
      padding: 16,
      fontSize: 16,
      color: isDark ? colors.textDark : colors.textLight,
      borderWidth: 1,
      borderColor: isDark ? '#444' : '#ddd',
    },
    statusButtonGroup: {
      flexDirection: 'row',
      gap: 12,
    },
    statusButton: {
      flex: 1,
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
      borderWidth: 2,
      borderColor: isDark ? '#444' : '#ddd',
    },
    statusButtonSelected: {
      borderColor: colors.primary,
      backgroundColor: isDark ? '#1a3a1a' : '#e8f5e9',
    },
    statusButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: isDark ? colors.textSecondaryDark : colors.textSecondaryLight,
    },
    statusButtonTextSelected: {
      color: colors.primary,
    },
    button: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
      marginTop: 20,
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
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    modalContent: {
      borderRadius: 12,
      padding: 24,
      width: '100%',
      maxWidth: 400,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 5,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '600',
      marginBottom: 12,
      textAlign: 'center',
    },
    modalMessage: {
      fontSize: 16,
      marginBottom: 20,
      textAlign: 'center',
      lineHeight: 22,
    },
    modalButton: {
      borderRadius: 8,
      padding: 12,
      alignItems: 'center',
    },
    modalButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },
  });
}

export default function AdminUpdateSubscriptionScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const styles = createStyles(isDark);
  const router = useRouter();

  const [email, setEmail] = useState('dan@forelandmarine.com');
  const [subscriptionStatus, setSubscriptionStatus] = useState<'active' | 'inactive'>('active');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    user: {
      id: string;
      email: string;
      subscriptionStatus: string;
    };
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalMessage, setModalMessage] = useState('');
  const [modalType, setModalType] = useState<'success' | 'error'>('success');

  const showModalMessage = (title: string, message: string, type: 'success' | 'error' = 'success') => {
    setModalTitle(title);
    setModalMessage(message);
    setModalType(type);
    setShowModal(true);
  };

  const handleUpdateSubscription = async () => {
    console.log('[AdminUpdateSubscription] User tapped Update Subscription button', {
      email,
      subscriptionStatus,
    });

    if (!email) {
      showModalMessage('Error', 'Please enter a user email', 'error');
      return;
    }

    setLoading(true);
    setResult(null);
    setError(null);

    try {
      console.log('[AdminUpdateSubscription] Calling POST /api/admin/update-user-subscription-by-email');

      const response = await authenticatedPost('/api/admin/update-user-subscription-by-email', {
        email,
        subscriptionStatus,
      });

      console.log('[AdminUpdateSubscription] Subscription update response:', response);

      setResult(response);

      const successMessage = `Successfully updated subscription for ${response.user.email} to ${response.user.subscriptionStatus}`;
      showModalMessage('Success', successMessage, 'success');

      console.log(successMessage);
    } catch (err: any) {
      console.error('[AdminUpdateSubscription] Error updating subscription:', err);
      const errorMessage = err.message || 'Failed to update subscription';
      setError(errorMessage);
      showModalMessage('Error', errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Update User Subscription',
          headerShown: true,
          headerBackTitle: 'Back',
        }}
      />
      <ScrollView style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.title}>Update User Subscription</Text>

          <Text style={styles.description}>
            Update a specific user's subscription status. This admin tool allows you to activate or
            deactivate subscriptions for individual users.
          </Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>User Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="Enter user email"
              placeholderTextColor={isDark ? colors.textSecondaryDark : colors.textSecondaryLight}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Subscription Status</Text>
            <View style={styles.statusButtonGroup}>
              <TouchableOpacity
                style={[
                  styles.statusButton,
                  subscriptionStatus === 'active' && styles.statusButtonSelected,
                ]}
                onPress={() => setSubscriptionStatus('active')}
              >
                <Text
                  style={[
                    styles.statusButtonText,
                    subscriptionStatus === 'active' && styles.statusButtonTextSelected,
                  ]}
                >
                  Active
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.statusButton,
                  subscriptionStatus === 'inactive' && styles.statusButtonSelected,
                ]}
                onPress={() => setSubscriptionStatus('inactive')}
              >
                <Text
                  style={[
                    styles.statusButtonText,
                    subscriptionStatus === 'inactive' && styles.statusButtonTextSelected,
                  ]}
                >
                  Inactive
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleUpdateSubscription}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>Update Subscription</Text>
            )}
          </TouchableOpacity>

          {result && (
            <View style={styles.resultBox}>
              <Text style={styles.resultTitle}>✅ Success</Text>
              <Text style={styles.resultText}>User ID: {result.user.id}</Text>
              <Text style={styles.resultText}>Email: {result.user.email}</Text>
              <Text style={styles.resultText}>
                Subscription Status: {result.user.subscriptionStatus}
              </Text>
            </View>
          )}

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorTitle}>❌ Error</Text>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Modal for messages - replaces Alert.alert for web compatibility */}
      <Modal
        visible={showModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalContent,
              { backgroundColor: isDark ? '#2C2C2E' : '#FFFFFF' },
            ]}
          >
            <Text
              style={[
                styles.modalTitle,
                { color: isDark ? colors.textDark : colors.textLight },
              ]}
            >
              {modalTitle}
            </Text>
            <Text
              style={[
                styles.modalMessage,
                { color: isDark ? colors.textDark : colors.textLight },
              ]}
            >
              {modalMessage}
            </Text>
            <TouchableOpacity
              style={[
                styles.modalButton,
                {
                  backgroundColor:
                    modalType === 'error' ? '#FF3B30' : colors.primary,
                },
              ]}
              onPress={() => setShowModal(false)}
            >
              <Text style={styles.modalButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}


import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  ScrollView,
  ActivityIndicator,
  Modal,
  Platform,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { colors } from '@/styles/commonStyles';
import { apiPut, getErrorMessage } from '@/utils/api';

export default function AdminUpdateSubscriptionScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const styles = createStyles(isDark);

  const [email, setEmail] = useState('test@seatime.com');
  const [subscriptionStatus, setSubscriptionStatus] = useState('active');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  
  // Modal state for web-compatible feedback
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalMessage, setModalMessage] = useState('');
  const [modalType, setModalType] = useState<'success' | 'error'>('success');

  const showModal = (title: string, message: string, type: 'success' | 'error') => {
    setModalTitle(title);
    setModalMessage(message);
    setModalType(type);
    setModalVisible(true);
  };

  const handleUpdateSubscription = async () => {
    console.log('[Admin] Updating subscription for', email, 'to', subscriptionStatus);
    
    if (!email) {
      showModal('Error', 'Please enter an email address', 'error');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const data = await apiPut('/api/admin/update-subscription', {
        email,
        subscription_status: subscriptionStatus,
      });

      console.log('[Admin] Subscription updated successfully', data);
      setResult(data);
      showModal('Success', `Subscription status updated to "${subscriptionStatus}" for ${email}`, 'success');
    } catch (error: any) {
      console.error('[Admin] Error updating subscription:', error);
      showModal('Error', getErrorMessage(error), 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Update Subscription',
          headerStyle: {
            backgroundColor: isDark ? colors.backgroundDark : colors.backgroundLight,
          },
          headerTintColor: isDark ? colors.textDark : colors.textLight,
        }}
      />
      <ScrollView style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.title}>Admin: Update Subscription Status</Text>
          <Text style={styles.description}>
            Update the subscription status for a user by email address.
          </Text>

          <View style={styles.form}>
            <Text style={styles.label}>Email Address</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="user@example.com"
              placeholderTextColor={isDark ? colors.textSecondaryDark : colors.textSecondaryLight}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={styles.label}>Subscription Status</Text>
            <View style={styles.statusButtons}>
              {['active', 'inactive', 'trialing', 'expired'].map((status) => {
                const isSelected = subscriptionStatus === status;
                const statusText = status.charAt(0).toUpperCase() + status.slice(1);
                return (
                  <TouchableOpacity
                    key={status}
                    style={[
                      styles.statusButton,
                      isSelected && styles.statusButtonSelected,
                    ]}
                    onPress={() => setSubscriptionStatus(status)}
                  >
                    <Text
                      style={[
                        styles.statusButtonText,
                        isSelected && styles.statusButtonTextSelected,
                      ]}
                    >
                      {statusText}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={[styles.updateButton, loading && styles.updateButtonDisabled]}
              onPress={handleUpdateSubscription}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.updateButtonText}>Update Subscription</Text>
              )}
            </TouchableOpacity>
          </View>

          {result && (
            <View style={styles.resultContainer}>
              <Text style={styles.resultTitle}>Result:</Text>
              <View style={styles.resultCard}>
                <Text style={styles.resultText}>Email: {result.user?.email}</Text>
                <Text style={styles.resultText}>Name: {result.user?.name}</Text>
                <Text style={styles.resultText}>
                  Status: {result.user?.subscription_status || 'N/A'}
                </Text>
                {result.user?.subscription_expires_at && (
                  <Text style={styles.resultText}>
                    Expires: {new Date(result.user.subscription_expires_at).toLocaleDateString()}
                  </Text>
                )}
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Web-compatible Modal for feedback */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={[
              styles.modalTitle,
              modalType === 'error' && styles.modalTitleError
            ]}>
              {modalTitle}
            </Text>
            <Text style={styles.modalMessage}>{modalMessage}</Text>
            <TouchableOpacity
              style={[
                styles.modalButton,
                modalType === 'error' && styles.modalButtonError
              ]}
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.modalButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

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
      marginBottom: 8,
    },
    description: {
      fontSize: 14,
      color: isDark ? colors.textSecondaryDark : colors.textSecondaryLight,
      marginBottom: 24,
    },
    form: {
      marginBottom: 24,
    },
    label: {
      fontSize: 16,
      fontWeight: '600',
      color: isDark ? colors.textDark : colors.textLight,
      marginBottom: 8,
    },
    input: {
      backgroundColor: isDark ? colors.cardDark : colors.cardLight,
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      color: isDark ? colors.textDark : colors.textLight,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: isDark ? colors.borderDark : colors.borderLight,
    },
    statusButtons: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 20,
    },
    statusButton: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 8,
      backgroundColor: isDark ? colors.cardDark : colors.cardLight,
      borderWidth: 1,
      borderColor: isDark ? colors.borderDark : colors.borderLight,
    },
    statusButtonSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    statusButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: isDark ? colors.textDark : colors.textLight,
    },
    statusButtonTextSelected: {
      color: '#FFFFFF',
    },
    updateButton: {
      backgroundColor: colors.primary,
      borderRadius: 8,
      padding: 16,
      alignItems: 'center',
    },
    updateButtonDisabled: {
      opacity: 0.6,
    },
    updateButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },
    resultContainer: {
      marginTop: 24,
    },
    resultTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: isDark ? colors.textDark : colors.textLight,
      marginBottom: 12,
    },
    resultCard: {
      backgroundColor: isDark ? colors.cardDark : colors.cardLight,
      borderRadius: 8,
      padding: 16,
      borderWidth: 1,
      borderColor: isDark ? colors.borderDark : colors.borderLight,
    },
    resultText: {
      fontSize: 14,
      color: isDark ? colors.textDark : colors.textLight,
      marginBottom: 8,
    },
    // Modal styles
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    modalContent: {
      backgroundColor: isDark ? colors.cardDark : colors.cardLight,
      borderRadius: 12,
      padding: 24,
      width: '100%',
      maxWidth: 400,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 4,
        },
        android: {
          elevation: 5,
        },
      }),
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.primary,
      marginBottom: 12,
      textAlign: 'center',
    },
    modalTitleError: {
      color: '#EF4444',
    },
    modalMessage: {
      fontSize: 16,
      color: isDark ? colors.textDark : colors.textLight,
      marginBottom: 20,
      textAlign: 'center',
      lineHeight: 22,
    },
    modalButton: {
      backgroundColor: colors.primary,
      borderRadius: 8,
      padding: 14,
      alignItems: 'center',
    },
    modalButtonError: {
      backgroundColor: '#EF4444',
    },
    modalButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },
  });
}

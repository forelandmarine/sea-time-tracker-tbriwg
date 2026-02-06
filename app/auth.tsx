
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  useColorScheme,
  Platform,
  Image,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { colors } from '@/styles/commonStyles';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as LocalAuthentication from 'expo-local-authentication';
import { BACKEND_URL } from '@/utils/api';
import { 
  getBiometricCredentials, 
  saveBiometricCredentials, 
  clearBiometricCredentials,
  isBiometricAvailable,
  authenticateWithBiometrics 
} from '@/utils/biometricAuth';

export default function AuthScreen() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [hasSavedCredentials, setHasSavedCredentials] = useState(false);
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const { signIn, signUp, signInWithApple } = useAuth();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  useEffect(() => {
    console.log('[AuthScreen] Mounted');
    console.log('[AuthScreen] Backend URL:', BACKEND_URL || 'NOT CONFIGURED');
    console.log('[AuthScreen] Platform:', Platform.OS);
    checkBiometricAvailability();
    checkSavedCredentials();
  }, []);

  const checkBiometricAvailability = async () => {
    const available = await isBiometricAvailable();
    setBiometricAvailable(available);
    console.log('[AuthScreen] Biometric authentication available:', available);
  };

  const checkSavedCredentials = async () => {
    const credentials = await getBiometricCredentials();
    setHasSavedCredentials(!!credentials);
    if (credentials) {
      console.log('[AuthScreen] Found saved credentials for:', credentials.email);
    }
  };

  const showError = (message: string) => {
    console.error('[AuthScreen] Showing error:', message);
    setErrorMessage(message);
    setErrorModalVisible(true);
  };

  const handleBiometricSignIn = async () => {
    try {
      console.log('[AuthScreen] User tapped biometric sign in button');
      setLoading(true);

      const credentials = await getBiometricCredentials();
      if (!credentials) {
        showError('No saved credentials found. Please sign in with email and password first.');
        return;
      }

      const authenticated = await authenticateWithBiometrics();
      if (!authenticated) {
        console.log('[AuthScreen] Biometric authentication cancelled or failed');
        return;
      }

      console.log('[AuthScreen] Biometric authentication successful, signing in...');
      await signIn(credentials.email, credentials.password);
      console.log('[AuthScreen] Sign in successful, navigating to home');
      router.replace('/(tabs)');
    } catch (error: any) {
      console.error('[AuthScreen] Biometric sign in failed:', error);
      showError(error.message || 'Biometric sign in failed');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async () => {
    console.log('[AuthScreen] handleEmailAuth called');
    
    if (!BACKEND_URL) {
      console.error('[AuthScreen] Backend URL not configured');
      showError('The app backend is not configured. Please ensure the backend URL is set in app.json.');
      return;
    }

    if (!email || !password) {
      console.warn('[AuthScreen] Email or password missing');
      showError('Please enter email and password');
      return;
    }

    if (isSignUp && password.length < 6) {
      console.warn('[AuthScreen] Password too short');
      showError('Password must be at least 6 characters');
      return;
    }

    console.log('[AuthScreen] Starting authentication...');
    setLoading(true);
    
    try {
      if (isSignUp) {
        console.log('[AuthScreen] User tapped Sign Up button');
        console.log('[AuthScreen] Calling signUp with email:', email);
        await signUp(email, password, name || 'User');
        console.log('[AuthScreen] Sign up successful');
      } else {
        console.log('[AuthScreen] User tapped Sign In button');
        console.log('[AuthScreen] Calling signIn with email:', email);
        await signIn(email, password);
        console.log('[AuthScreen] Sign in successful');
      }

      // Save credentials if remember me is checked
      if (rememberMe && !isSignUp) {
        console.log('[AuthScreen] Saving credentials for biometric authentication');
        try {
          await saveBiometricCredentials(email, password);
          setHasSavedCredentials(true);
          console.log('[AuthScreen] Credentials saved successfully');
        } catch (bioError) {
          console.error('[AuthScreen] Failed to save biometric credentials:', bioError);
          // Don't block login if biometric save fails
        }
      }

      console.log('[AuthScreen] Authentication successful, navigating to home');
      
      // Use setTimeout to ensure state updates complete before navigation
      setTimeout(() => {
        console.log('[AuthScreen] Executing navigation to /(tabs)');
        try {
          router.replace('/(tabs)');
          console.log('[AuthScreen] Navigation completed');
        } catch (navError) {
          console.error('[AuthScreen] Navigation error:', navError);
          // Fallback navigation
          router.push('/(tabs)');
        }
      }, 100);
    } catch (error: any) {
      console.error('[AuthScreen] Authentication failed:', error);
      console.error('[AuthScreen] Error details:', {
        message: error.message,
        name: error.name,
        stack: error.stack,
      });
      
      // Provide more helpful error messages
      let errorMsg = error.message || 'Authentication failed';
      
      // Check if error message contains HTML (indicates server error)
      if (errorMsg.includes('<!DOCTYPE') || errorMsg.includes('<html')) {
        errorMsg = 'Server error occurred. Please try again later or contact support.';
      } else if (errorMsg.includes('Network') || errorMsg.includes('fetch')) {
        errorMsg = 'Cannot connect to server. Please check your internet connection.';
      } else if (errorMsg.includes('timeout') || errorMsg.includes('timed out')) {
        errorMsg = 'Request timed out. Please check your connection and try again.';
      } else if (errorMsg.includes('Invalid email or password')) {
        errorMsg = 'Invalid email or password. Please check your credentials and try again.';
      }
      
      showError(errorMsg);
    } finally {
      setLoading(false);
      console.log('[AuthScreen] Authentication flow completed');
    }
  };

  const handleAppleSignIn = async () => {
    try {
      console.log('[AuthScreen] User tapped Sign in with Apple button');
      console.log('[AuthScreen] Platform:', Platform.OS);
      console.log('[AuthScreen] Checking Apple Authentication availability...');
      
      // Check if Apple Authentication is available
      let isAvailable = false;
      try {
        isAvailable = await AppleAuthentication.isAvailableAsync();
        console.log('[AuthScreen] Apple Authentication available:', isAvailable);
      } catch (availError: any) {
        console.error('[AuthScreen] Error checking Apple Authentication availability:', availError);
        showError('Sign in with Apple is not available on this device. Please use email and password instead.');
        return;
      }
      
      if (!isAvailable) {
        console.log('[AuthScreen] Apple Authentication not available');
        showError('Sign in with Apple is not available on this device. Please use email and password instead.');
        return;
      }

      setLoading(true);
      console.log('[AuthScreen] Requesting Apple credentials...');
      
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      console.log('[AuthScreen] Apple credential received:', {
        hasIdentityToken: !!credential.identityToken,
        hasEmail: !!credential.email,
        hasFullName: !!credential.fullName,
        fullName: credential.fullName,
        user: credential.user,
      });

      if (!credential.identityToken) {
        console.error('[AuthScreen] No identity token received from Apple');
        showError('Failed to get Apple authentication token. Please try again.');
        setLoading(false);
        return;
      }

      console.log('[AuthScreen] Sending Apple credentials to backend...');
      
      // Format the user data properly for the backend
      const appleUserData = {
        email: credential.email || undefined,
        name: credential.fullName ? {
          givenName: credential.fullName.givenName || undefined,
          familyName: credential.fullName.familyName || undefined,
        } : undefined,
      };
      
      console.log('[AuthScreen] Formatted Apple user data:', appleUserData);
      
      await signInWithApple(credential.identityToken, appleUserData);
      
      console.log('[AuthScreen] Apple sign in successful, navigating to home');
      
      // Use setTimeout to ensure state updates complete before navigation
      setTimeout(() => {
        console.log('[AuthScreen] Executing navigation to /(tabs)');
        try {
          router.replace('/(tabs)');
          console.log('[AuthScreen] Navigation completed');
        } catch (navError) {
          console.error('[AuthScreen] Navigation error:', navError);
          // Fallback navigation
          router.push('/(tabs)');
        }
      }, 100);
    } catch (error: any) {
      console.error('[AuthScreen] Apple sign in error:', {
        code: error.code,
        message: error.message,
        name: error.name,
        stack: error.stack,
      });
      
      // Don't show error for user cancellation
      if (error.code === 'ERR_CANCELED' || error.code === 'ERR_REQUEST_CANCELED') {
        console.log('[AuthScreen] User cancelled Apple sign in');
        return;
      }
      
      // Show helpful error messages for other errors
      let errorMsg = 'Unable to sign in with Apple. ';
      
      if (error.code === 'ERR_INVALID_RESPONSE') {
        errorMsg = 'Received an invalid response from Apple. Please try again.';
      } else if (error.message?.includes('Network') || error.message?.includes('fetch') || error.message?.includes('timed out')) {
        errorMsg = 'Cannot connect to server. Please check your internet connection and try again.';
      } else if (error.message?.includes('token')) {
        errorMsg = 'Authentication token is invalid. Please try again.';
      } else if (error.message?.includes('<!DOCTYPE') || error.message?.includes('<html')) {
        errorMsg = 'Server error occurred. Please try again later or contact support.';
      } else if (error.message) {
        errorMsg = error.message;
      } else {
        errorMsg = 'An unknown error occurred. Please try again or use email and password.';
      }
      
      showError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const styles = createStyles(isDark);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Image
          source={require('@/assets/images/8331a0b9-33c9-4ff2-93d0-772c257bd0c9.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.title}>SeaTime Tracker</Text>
        <Text style={styles.subtitle}>By Foreland Marine</Text>
        
        {!BACKEND_URL && (
          <View style={styles.warningBanner}>
            <Text style={styles.warningText}>
              ⚠️ Backend not configured. Authentication may not work.
            </Text>
          </View>
        )}
      </View>

      <View style={styles.form}>
        {biometricAvailable && hasSavedCredentials && !isSignUp && (
          <TouchableOpacity
            style={[styles.button, styles.biometricButton]}
            onPress={handleBiometricSignIn}
            disabled={loading}
          >
            <Text style={styles.biometricButtonText}>
              {Platform.OS === 'ios' ? '🔐 Sign in with Face ID' : '🔐 Sign in with Biometrics'}
            </Text>
          </TouchableOpacity>
        )}

        {biometricAvailable && hasSavedCredentials && !isSignUp && (
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>
        )}

        {isSignUp && (
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Name (Optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="Your name"
              placeholderTextColor={isDark ? colors.textSecondary : colors.textSecondaryLight}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />
          </View>
        )}

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="your.email@example.com"
            placeholderTextColor={isDark ? colors.textSecondary : colors.textSecondaryLight}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder={isSignUp ? "Minimum 6 characters" : "Enter your password"}
            placeholderTextColor={isDark ? colors.textSecondary : colors.textSecondaryLight}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete={isSignUp ? 'password-new' : 'password'}
          />
        </View>

        {!isSignUp && biometricAvailable && (
          <TouchableOpacity
            style={styles.checkboxContainer}
            onPress={() => setRememberMe(!rememberMe)}
          >
            <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
              {rememberMe && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.checkboxLabel}>
              Remember me (enable {Platform.OS === 'ios' ? 'Face ID' : 'biometric'} sign in)
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.button, styles.primaryButton]}
          onPress={handleEmailAuth}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>
              {isSignUp ? 'Sign Up' : 'Sign In'}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.switchButton}
          onPress={() => setIsSignUp(!isSignUp)}
        >
          <Text style={styles.switchText}>
            {isSignUp
              ? 'Already have an account? Sign In'
              : "Don't have an account? Sign Up"}
          </Text>
        </TouchableOpacity>

        {!isSignUp && (
          <TouchableOpacity
            style={styles.forgotPasswordButton}
            onPress={() => {
              console.log('[AuthScreen] User tapped Forgot Password link');
              router.push('/forgot-password');
            }}
          >
            <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
          </TouchableOpacity>
        )}

        {Platform.OS === 'ios' && (
          <>
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>

            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
              buttonStyle={
                isDark
                  ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                  : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
              }
              cornerRadius={12}
              style={styles.appleButton}
              onPress={handleAppleSignIn}
            />
          </>
        )}
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Your sea time data is private and secure.
        </Text>
        <Text style={styles.footerText}>
          Compliant with iOS data handling regulations.
        </Text>
      </View>

      {/* Error Modal */}
      <Modal
        visible={errorModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setErrorModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Sign In Error</Text>
            <Text style={styles.modalMessage}>{errorMessage}</Text>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => setErrorModalVisible(false)}
            >
              <Text style={styles.modalButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function createStyles(isDark: boolean) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? colors.background : colors.backgroundLight,
    },
    content: {
      padding: 24,
      paddingTop: Platform.OS === 'android' ? 48 : 24,
    },
    header: {
      alignItems: 'center',
      marginBottom: 40,
      marginTop: 40,
    },
    logo: {
      width: 100,
      height: 100,
    },
    title: {
      fontSize: 32,
      fontWeight: 'bold',
      color: isDark ? colors.text : colors.textLight,
      marginTop: 16,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 18,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
    },
    form: {
      width: '100%',
      maxWidth: 400,
      alignSelf: 'center',
    },
    inputContainer: {
      marginBottom: 20,
    },
    label: {
      fontSize: 16,
      fontWeight: '600',
      color: isDark ? colors.text : colors.textLight,
      marginBottom: 8,
    },
    input: {
      backgroundColor: isDark ? colors.cardBackground : colors.card,
      borderWidth: 1,
      borderColor: isDark ? colors.border : colors.borderLight,
      borderRadius: 12,
      padding: 16,
      fontSize: 16,
      color: isDark ? colors.text : colors.textLight,
    },
    button: {
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
      marginTop: 8,
    },
    primaryButton: {
      backgroundColor: colors.primary,
    },
    buttonText: {
      color: '#FFFFFF',
      fontSize: 18,
      fontWeight: '600',
    },
    switchButton: {
      marginTop: 16,
      alignItems: 'center',
    },
    switchText: {
      color: colors.primary,
      fontSize: 16,
      fontWeight: '500',
    },
    forgotPasswordButton: {
      marginTop: 12,
      alignItems: 'center',
    },
    forgotPasswordText: {
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
      fontSize: 15,
      fontWeight: '500',
      textDecorationLine: 'underline',
    },
    divider: {
      flexDirection: 'row',
      alignItems: 'center',
      marginVertical: 24,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: isDark ? colors.border : colors.borderLight,
    },
    dividerText: {
      marginHorizontal: 16,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
      fontSize: 14,
      fontWeight: '500',
    },
    appleButton: {
      width: '100%',
      height: 50,
    },
    biometricButton: {
      backgroundColor: isDark ? colors.cardBackground : colors.card,
      borderWidth: 2,
      borderColor: colors.primary,
    },
    biometricButtonText: {
      color: colors.primary,
      fontSize: 18,
      fontWeight: '600',
    },
    checkboxContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
    },
    checkbox: {
      width: 24,
      height: 24,
      borderWidth: 2,
      borderColor: isDark ? colors.border : colors.borderLight,
      borderRadius: 6,
      marginRight: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? colors.cardBackground : colors.card,
    },
    checkboxChecked: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    checkmark: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: 'bold',
    },
    checkboxLabel: {
      flex: 1,
      fontSize: 15,
      color: isDark ? colors.text : colors.textLight,
    },
    footer: {
      marginTop: 40,
      alignItems: 'center',
    },
    footerText: {
      fontSize: 14,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
      textAlign: 'center',
      marginBottom: 4,
    },
    warningBanner: {
      backgroundColor: '#FFF3CD',
      borderRadius: 8,
      padding: 12,
      marginTop: 16,
      borderWidth: 1,
      borderColor: '#FFC107',
    },
    warningText: {
      color: '#856404',
      fontSize: 14,
      textAlign: 'center',
      fontWeight: '500',
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    modalContent: {
      backgroundColor: isDark ? colors.cardBackground : '#FFFFFF',
      borderRadius: 16,
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
      fontWeight: 'bold',
      color: isDark ? colors.text : colors.textLight,
      marginBottom: 12,
      textAlign: 'center',
    },
    modalMessage: {
      fontSize: 16,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
      marginBottom: 24,
      textAlign: 'center',
      lineHeight: 24,
    },
    modalButton: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
    },
    modalButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },
  });
}


import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  useColorScheme,
  Platform,
  Image,
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

  const handleBiometricSignIn = async () => {
    try {
      console.log('[AuthScreen] User tapped biometric sign in button');
      setLoading(true);

      const credentials = await getBiometricCredentials();
      if (!credentials) {
        Alert.alert('Error', 'No saved credentials found. Please sign in with email and password first.');
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
      Alert.alert('Error', error.message || 'Biometric sign in failed');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async () => {
    if (!BACKEND_URL) {
      Alert.alert(
        'Backend Not Configured',
        'The app backend is not configured. Please ensure the backend URL is set in app.json.',
        [{ text: 'OK' }]
      );
      return;
    }

    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }

    if (isSignUp && password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      if (isSignUp) {
        console.log('[AuthScreen] User tapped Sign Up button');
        await signUp(email, password, name || 'User');
      } else {
        console.log('[AuthScreen] User tapped Sign In button');
        await signIn(email, password);
      }

      // Save credentials if remember me is checked
      if (rememberMe && !isSignUp) {
        console.log('[AuthScreen] Saving credentials for biometric authentication');
        await saveBiometricCredentials(email, password);
        setHasSavedCredentials(true);
      }

      console.log('[AuthScreen] Authentication successful, navigating to home');
      router.replace('/(tabs)');
    } catch (error: any) {
      console.error('[AuthScreen] Authentication failed:', error);
      
      // Provide more helpful error messages
      let errorMessage = error.message || 'Authentication failed';
      if (errorMessage.includes('Network') || errorMessage.includes('fetch')) {
        errorMessage = 'Cannot connect to server. Please check your internet connection.';
      }
      
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    try {
      console.log('[AuthScreen] User tapped Sign in with Apple button');
      console.log('[AuthScreen] Checking Apple Authentication availability...');
      
      // Check if Apple Authentication is available
      const isAvailable = await AppleAuthentication.isAvailableAsync();
      console.log('[AuthScreen] Apple Authentication available:', isAvailable);
      
      if (!isAvailable) {
        Alert.alert('Error', 'Sign in with Apple is not available on this device');
        return;
      }

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
        user: credential.user,
      });

      if (!credential.identityToken) {
        console.error('[AuthScreen] No identity token received from Apple');
        Alert.alert('Error', 'Failed to get Apple authentication token');
        return;
      }

      console.log('[AuthScreen] Sending Apple credentials to backend...');
      await signInWithApple(credential.identityToken, {
        email: credential.email,
        name: credential.fullName,
      });
      
      console.log('[AuthScreen] Apple sign in successful, navigating to home');
      router.replace('/(tabs)');
    } catch (error: any) {
      if (error.code === 'ERR_CANCELED') {
        console.log('[AuthScreen] User cancelled Apple sign in');
      } else {
        console.error('[AuthScreen] Apple sign in failed:', {
          code: error.code,
          message: error.message,
          error: error,
        });
        Alert.alert('Error', `Apple sign in failed: ${error.message || 'Unknown error'}`);
      }
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
  });
}

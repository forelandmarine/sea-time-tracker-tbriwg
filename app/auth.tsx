
import React, { useState } from 'react';
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
import { IconSymbol } from '@/components/IconSymbol';
import * as AppleAuthentication from 'expo-apple-authentication';
import Constants from 'expo-constants';

export default function AuthScreen() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signUp, signInWithApple } = useAuth();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const handleEmailAuth = async () => {
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
      console.log('[AuthScreen] Authentication successful, navigating to home');
      router.replace('/(tabs)');
    } catch (error: any) {
      console.error('[AuthScreen] Authentication failed:', error);
      Alert.alert('Error', error.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    try {
      console.log('[AuthScreen] User tapped Sign in with Apple button');
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      console.log('[AuthScreen] Apple credential received');
      await signInWithApple(credential.identityToken!, {
        email: credential.email,
        name: credential.fullName,
      });
      
      console.log('[AuthScreen] Apple sign in successful, navigating to home');
      router.replace('/(tabs)');
    } catch (error: any) {
      if (error.code === 'ERR_CANCELED') {
        console.log('[AuthScreen] User cancelled Apple sign in');
      } else {
        console.error('[AuthScreen] Apple sign in failed:', error);
        Alert.alert('Error', 'Apple sign in failed');
      }
    }
  };

  const handleCreateTestUser = async () => {
    setLoading(true);
    try {
      console.log('[AuthScreen] User tapped Create Test Account button');
      const API_URL = Constants.expoConfig?.extra?.backendUrl || '';
      
      // Create test user via backend endpoint
      const response = await fetch(`${API_URL}/api/auth/test-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create test user');
      }

      const data = await response.json();
      console.log('[AuthScreen] Test user response:', data.message);
      
      // The backend returns a session token, so we can use it directly
      // Store the token and user
      const { user, session } = data;
      
      // Import token storage from AuthContext
      const TOKEN_KEY = 'seatime_auth_token';
      if (Platform.OS === 'web') {
        localStorage.setItem(TOKEN_KEY, session.token);
      } else {
        const SecureStore = await import('expo-secure-store');
        await SecureStore.setItemAsync(TOKEN_KEY, session.token);
      }
      
      Alert.alert(
        'Test Account Ready',
        `Email: test@seatime.com\nPassword: testpassword123\n\n${data.message}`,
        [{ text: 'OK', onPress: () => router.replace('/(tabs)') }]
      );
    } catch (error: any) {
      console.error('[AuthScreen] Create test user failed:', error);
      Alert.alert('Error', error.message || 'Failed to create test user');
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
        <Text style={styles.subtitle}>
          {isSignUp ? 'Create your account' : 'Welcome back'}
        </Text>
      </View>

      <View style={styles.form}>
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

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>OR</Text>
          <View style={styles.dividerLine} />
        </View>

        <TouchableOpacity
          style={[styles.button, styles.testButton]}
          onPress={handleCreateTestUser}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <>
              <IconSymbol
                ios_icon_name="person.badge.key"
                android_material_icon_name="person"
                size={20}
                color={colors.primary}
                style={styles.testButtonIcon}
              />
              <Text style={styles.testButtonText}>Create Test Account</Text>
            </>
          )}
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
      width: 62,
      height: 62,
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
    testButton: {
      backgroundColor: isDark ? colors.cardBackground : colors.card,
      borderWidth: 2,
      borderColor: colors.primary,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    testButtonIcon: {
      marginRight: 8,
    },
    testButtonText: {
      color: colors.primary,
      fontSize: 16,
      fontWeight: '600',
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
  });
}

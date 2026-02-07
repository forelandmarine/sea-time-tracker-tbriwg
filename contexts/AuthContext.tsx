
import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { Platform } from 'react-native';
import { BACKEND_URL } from '@/utils/api';
import { clearBiometricCredentials } from '@/utils/biometricAuth';

const TOKEN_KEY = 'seatime_auth_token';

// CRITICAL: Absolute maximum timeouts to prevent hanging
const AUTH_CHECK_TIMEOUT = 3000; // 3 seconds max for auth check
const SIGN_IN_TIMEOUT = 10000; // 10 seconds max for sign in
const SIGN_OUT_BACKEND_TIMEOUT = 500; // 500ms for backend sign out (fire-and-forget)
const SAFETY_TIMEOUT = 6000; // 6 seconds absolute maximum for loading state

// ═══════════════════════════════════════════════════════════════════════════
// 🚨 CRITICAL FIX: DYNAMIC IMPORT OF EXPO-SECURE-STORE
// ═══════════════════════════════════════════════════════════════════════════
// PROBLEM: Importing expo-secure-store at module scope causes TurboModule
// initialization during app startup, which can trigger SIGABRT crashes on iOS
// when the native module is called before the React Native bridge is ready.
//
// SOLUTION: Use dynamic import() inside functions, ensuring SecureStore is
// only loaded when actually needed, after the app is fully mounted and stable.
// ═══════════════════════════════════════════════════════════════════════════

interface User {
  id: string;
  email: string;
  name?: string;
  hasDepartment?: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name?: string) => Promise<void>;
  signInWithApple: (identityToken: string, appleUser?: any) => Promise<void>;
  signOut: () => Promise<void>;
  isAuthenticated: boolean;
  refreshTrigger: number;
  triggerRefresh: () => void;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ═══════════════════════════════════════════════════════════════════════════
// CRITICAL: Safe SecureStore wrapper with DYNAMIC IMPORT
// ═══════════════════════════════════════════════════════════════════════════
const tokenStorage = {
  async getToken(): Promise<string | null> {
    try {
      console.log('[Auth] ⚠️ ABOUT TO CALL NATIVE: tokenStorage.getToken');
      console.log('[Auth] Platform:', Platform.OS);
      console.log('[Auth] TOKEN_KEY:', TOKEN_KEY);
      
      // CRITICAL: Validate TOKEN_KEY before native call
      if (!TOKEN_KEY || typeof TOKEN_KEY !== 'string' || TOKEN_KEY.length === 0) {
        console.error('[Auth] ❌ VALIDATION FAILED: Invalid TOKEN_KEY:', TOKEN_KEY);
        return null;
      }
      
      if (Platform.OS === 'web') {
        try {
          const token = localStorage.getItem(TOKEN_KEY);
          console.log('[Auth] ✅ Web token retrieved:', token ? 'YES (length: ' + token.length + ')' : 'NO');
          return token;
        } catch (webError) {
          console.error('[Auth] ❌ Web localStorage error:', webError);
          return null;
        }
      }
      
      // CRITICAL: Dynamic import - SecureStore is NOT loaded at module scope
      console.log('[Auth] Dynamically importing expo-secure-store...');
      const SecureStore = await import('expo-secure-store');
      console.log('[Auth] ✅ expo-secure-store imported successfully');
      
      // CRITICAL: Wrap SecureStore call in try-catch
      console.log('[Auth] Calling SecureStore.getItemAsync...');
      try {
        const token = await SecureStore.getItemAsync(TOKEN_KEY);
        console.log('[Auth] ✅ NATIVE CALL SUCCESS: SecureStore.getItemAsync');
        console.log('[Auth] Token retrieved:', token ? 'YES (length: ' + token.length + ')' : 'NO');
        return token;
      } catch (secureStoreError: any) {
        console.error('[Auth] ❌ NATIVE CALL FAILED: SecureStore.getItemAsync');
        console.error('[Auth] Error:', secureStoreError);
        console.error('[Auth] Error name:', secureStoreError.name);
        console.error('[Auth] Error message:', secureStoreError.message);
        console.error('[Auth] Error stack:', secureStoreError.stack);
        return null;
      }
    } catch (error: any) {
      console.error('[Auth] ❌ Error getting token:', error);
      console.error('[Auth] Error details:', error.message, error.name);
      return null;
    }
  },
  
  async setToken(token: string): Promise<void> {
    try {
      console.log('[Auth] ⚠️ ABOUT TO CALL NATIVE: tokenStorage.setToken');
      console.log('[Auth] Platform:', Platform.OS);
      console.log('[Auth] TOKEN_KEY:', TOKEN_KEY);
      console.log('[Auth] Token length:', token?.length);
      
      // CRITICAL: Validate inputs before native call
      if (!TOKEN_KEY || typeof TOKEN_KEY !== 'string' || TOKEN_KEY.length === 0) {
        console.error('[Auth] ❌ VALIDATION FAILED: Invalid TOKEN_KEY:', TOKEN_KEY);
        throw new Error('Invalid storage key');
      }
      
      if (!token || typeof token !== 'string' || token.length === 0) {
        console.error('[Auth] ❌ VALIDATION FAILED: Invalid token:', typeof token);
        throw new Error('Invalid token value');
      }
      
      if (Platform.OS === 'web') {
        try {
          localStorage.setItem(TOKEN_KEY, token);
          console.log('[Auth] ✅ Token stored in localStorage');
        } catch (error: any) {
          console.warn('[Auth] ⚠️ localStorage not accessible:', error.message);
          throw error;
        }
      } else {
        // CRITICAL: Dynamic import - SecureStore is NOT loaded at module scope
        console.log('[Auth] Dynamically importing expo-secure-store...');
        const SecureStore = await import('expo-secure-store');
        console.log('[Auth] ✅ expo-secure-store imported successfully');
        
        // CRITICAL: Wrap SecureStore call in try-catch
        console.log('[Auth] Calling SecureStore.setItemAsync...');
        try {
          await SecureStore.setItemAsync(TOKEN_KEY, token);
          console.log('[Auth] ✅ NATIVE CALL SUCCESS: SecureStore.setItemAsync');
          console.log('[Auth] Token stored in SecureStore');
        } catch (secureStoreError: any) {
          console.error('[Auth] ❌ NATIVE CALL FAILED: SecureStore.setItemAsync');
          console.error('[Auth] Error:', secureStoreError);
          console.error('[Auth] Error name:', secureStoreError.name);
          console.error('[Auth] Error message:', secureStoreError.message);
          console.error('[Auth] Error stack:', secureStoreError.stack);
          throw new Error(`Failed to store token: ${secureStoreError.message}`);
        }
      }
    } catch (error: any) {
      console.error('[Auth] ❌ Error storing token:', error);
      console.error('[Auth] Error details:', error.message, error.name);
      throw error;
    }
  },
  
  async removeToken(): Promise<void> {
    try {
      console.log('[Auth] ⚠️ ABOUT TO CALL NATIVE: tokenStorage.removeToken');
      console.log('[Auth] Platform:', Platform.OS);
      console.log('[Auth] TOKEN_KEY:', TOKEN_KEY);
      
      // CRITICAL: Validate TOKEN_KEY before native call
      if (!TOKEN_KEY || typeof TOKEN_KEY !== 'string' || TOKEN_KEY.length === 0) {
        console.error('[Auth] ❌ VALIDATION FAILED: Invalid TOKEN_KEY:', TOKEN_KEY);
        return; // Don't throw - we want to continue even if removal fails
      }
      
      if (Platform.OS === 'web') {
        try {
          localStorage.removeItem(TOKEN_KEY);
          console.log('[Auth] ✅ Token removed from localStorage');
        } catch {
          // Ignore errors
        }
      } else {
        // CRITICAL: Dynamic import - SecureStore is NOT loaded at module scope
        console.log('[Auth] Dynamically importing expo-secure-store...');
        const SecureStore = await import('expo-secure-store');
        console.log('[Auth] ✅ expo-secure-store imported successfully');
        
        // CRITICAL: Wrap SecureStore call in try-catch
        console.log('[Auth] Calling SecureStore.deleteItemAsync...');
        try {
          await SecureStore.deleteItemAsync(TOKEN_KEY);
          console.log('[Auth] ✅ NATIVE CALL SUCCESS: SecureStore.deleteItemAsync');
          console.log('[Auth] Token removed from SecureStore');
        } catch (secureStoreError: any) {
          console.error('[Auth] ❌ NATIVE CALL FAILED: SecureStore.deleteItemAsync');
          console.error('[Auth] Error:', secureStoreError);
          console.error('[Auth] Error name:', secureStoreError.name);
          console.error('[Auth] Error message:', secureStoreError.message);
          // Don't throw - we want to continue even if removal fails
        }
      }
    } catch (error: any) {
      console.error('[Auth] ❌ Error removing token:', error);
      console.error('[Auth] Error details:', error.message, error.name);
      // Don't throw - we want to continue even if removal fails
    }
  },
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false); // 🚨 CRITICAL FIX: Start with false to never block startup
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  // CRITICAL: Use a single lock to prevent ALL concurrent auth operations
  const authLock = useRef(false);
  const safetyTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const appReadyRef = useRef(false);
  const initialCheckDone = useRef(false);

  const triggerRefresh = useCallback(() => {
    console.log('[Auth] ========== GLOBAL REFRESH TRIGGERED ==========');
    setRefreshTrigger(prev => prev + 1);
  }, []);

  // CRITICAL: Safety timeout to FORCE loading state to false
  useEffect(() => {
    if (!loading) return;
    
    safetyTimeoutRef.current = setTimeout(() => {
      if (loading) {
        console.warn('[Auth] ⚠️ SAFETY TIMEOUT - Force stopping loading state after 6 seconds');
        setLoading(false);
        authLock.current = false; // Release lock
      }
    }, SAFETY_TIMEOUT);
    
    return () => {
      if (safetyTimeoutRef.current) {
        clearTimeout(safetyTimeoutRef.current);
      }
    };
  }, [loading]);

  // ═══════════════════════════════════════════════════════════════════════════
  // 🚨 CRITICAL FIX: EXTREME DELAYED APP READY FLAG
  // ═══════════════════════════════════════════════════════════════════════════
  // Wait for app to be fully mounted and VERY stable before allowing auth operations
  // This prevents TurboModule crashes from calling native modules too early
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    console.log('[Auth] Setting up app ready timer (5 second delay)...');
    const readyTimer = setTimeout(() => {
      console.log('[Auth] ✅ App is now ready for auth operations (after 5 second delay)');
      appReadyRef.current = true;
    }, 5000); // 🚨 INCREASED to 5 seconds to ensure maximum stability

    return () => {
      clearTimeout(readyTimer);
    };
  }, []);

  const checkAuth = useCallback(async () => {
    // CRITICAL: Don't check auth until app is ready
    if (!appReadyRef.current) {
      console.log('[Auth] App not ready yet, skipping auth check');
      setLoading(false);
      return;
    }

    // CRITICAL: Prevent ANY concurrent auth operations
    if (authLock.current) {
      console.log('[Auth] Auth operation in progress, skipping check');
      return;
    }

    authLock.current = true;
    setLoading(true);
    
    try {
      console.log('[Auth] Starting auth check...');
      console.log('[Auth] Platform:', Platform.OS);
      console.log('[Auth] BACKEND_URL:', BACKEND_URL || 'NOT CONFIGURED');
      
      if (!BACKEND_URL) {
        console.warn('[Auth] Backend URL not configured');
        setLoading(false);
        setUser(null);
        authLock.current = false;
        return;
      }

      console.log('[Auth] Getting token from storage...');
      const token = await tokenStorage.getToken();
      console.log('[Auth] Token retrieved:', token ? 'YES (length: ' + token.length + ')' : 'NO');
      
      if (!token) {
        console.log('[Auth] No token found, user not authenticated');
        setLoading(false);
        setUser(null);
        authLock.current = false;
        return;
      }

      console.log('[Auth] Token found, verifying with backend...');
      
      // CRITICAL: Aggressive timeout with AbortController
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.warn('[Auth] Auth check timeout after', AUTH_CHECK_TIMEOUT, 'ms, aborting...');
        controller.abort();
      }, AUTH_CHECK_TIMEOUT);
      
      try {
        const url = `${BACKEND_URL}/api/auth/user`;
        console.log('[Auth] Fetching:', url);
        
        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        console.log('[Auth] Response received:', response.status, response.statusText);

        if (response.ok) {
          const data = await response.json();
          console.log('[Auth] ✅ User authenticated:', data.user?.email);
          setUser(data.user);
        } else {
          console.log('[Auth] Token invalid (status:', response.status, '), clearing...');
          await tokenStorage.removeToken();
          setUser(null);
        }
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        
        if (fetchError.name === 'AbortError') {
          console.warn('[Auth] Auth check aborted due to timeout');
        } else {
          console.error('[Auth] Auth check fetch error:', fetchError.message);
          console.error('[Auth] Error name:', fetchError.name);
        }
        
        // Keep token on network errors (might be temporary)
        if (!(fetchError instanceof TypeError && fetchError.message.includes('Network'))) {
          console.log('[Auth] Clearing token due to non-network error');
          await tokenStorage.removeToken();
        } else {
          console.log('[Auth] Keeping token (network error, might be temporary)');
        }
        setUser(null);
      }
    } catch (error: any) {
      console.error('[Auth] Check auth failed:', error);
      console.error('[Auth] Error details:', error.message, error.name);
      setUser(null);
    } finally {
      console.log('[Auth] Auth check complete, setting loading to false');
      setLoading(false);
      authLock.current = false;
    }
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // 🚨 CRITICAL FIX: REMOVE AUTOMATIC AUTH CHECK ON MOUNT
  // ═══════════════════════════════════════════════════════════════════════════
  // Instead of checking auth automatically, we'll only check when:
  // 1. User explicitly signs in
  // 2. App navigates to a protected route (handled by _layout.tsx)
  // This prevents early SecureStore access that can cause crashes
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    console.log('[Auth] AuthProvider mounted - NOT checking auth automatically');
    console.log('[Auth] Auth will be checked only when needed (sign in, protected route access)');
    
    // Mark initial check as done immediately without actually checking
    initialCheckDone.current = true;
    
    // Set loading to false immediately so app can proceed
    setLoading(false);
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    // CRITICAL: Prevent concurrent operations
    if (authLock.current) {
      throw new Error('Authentication operation already in progress. Please wait.');
    }

    authLock.current = true;
    setLoading(true);
    console.log('[Auth] ========== SIGN IN STARTED ==========');
    console.log('[Auth] Platform:', Platform.OS);
    console.log('[Auth] Email:', email);
    console.log('[Auth] BACKEND_URL:', BACKEND_URL);
    
    if (!BACKEND_URL) {
      authLock.current = false;
      setLoading(false);
      throw new Error('Backend URL is not configured');
    }

    const url = `${BACKEND_URL}/api/auth/sign-in/email`;
    console.log('[Auth] Request URL:', url);
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.warn('[Auth] Sign in timeout after', SIGN_IN_TIMEOUT, 'ms, aborting...');
        controller.abort();
      }, SIGN_IN_TIMEOUT);
      
      try {
        console.log('[Auth] Preparing request body...');
        const requestBody = JSON.stringify({ email, password });
        console.log('[Auth] Request body length:', requestBody.length);
        
        console.log('[Auth] Sending fetch request...');
        const fetchStartTime = Date.now();
        
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: requestBody,
          signal: controller.signal,
        });

        const fetchDuration = Date.now() - fetchStartTime;
        console.log('[Auth] Response received after', fetchDuration, 'ms');
        console.log('[Auth] Response status:', response.status, response.statusText);
        console.log('[Auth] Response headers:', JSON.stringify(Object.fromEntries(response.headers.entries())));
        
        clearTimeout(timeoutId);

        if (!response.ok) {
          console.error('[Auth] Response not OK:', response.status);
          
          // Try to read response body
          let errorText = '';
          try {
            errorText = await response.text();
            console.error('[Auth] Error response body:', errorText);
          } catch (readError) {
            console.error('[Auth] Failed to read error response body:', readError);
            throw new Error(`Login failed with status ${response.status}`);
          }
          
          // Try to parse as JSON
          let errorData;
          try {
            errorData = JSON.parse(errorText);
            console.error('[Auth] Parsed error data:', errorData);
          } catch {
            // Not JSON, use raw text
            throw new Error(`Login failed: ${errorText || response.statusText}`);
          }
          
          throw new Error(errorData.error || errorData.message || 'Login failed');
        }

        console.log('[Auth] Reading response body...');
        const responseText = await response.text();
        console.log('[Auth] Response body length:', responseText.length);
        console.log('[Auth] Response body preview:', responseText.substring(0, 200));
        
        let data;
        try {
          data = JSON.parse(responseText);
          console.log('[Auth] Response data parsed:', { hasSession: !!data.session, hasUser: !!data.user });
        } catch (parseError) {
          console.error('[Auth] Failed to parse response JSON:', parseError);
          console.error('[Auth] Response text:', responseText);
          throw new Error('Invalid response from server');
        }

        if (!data.session || !data.session.token) {
          console.error('[Auth] No session token in response:', data);
          throw new Error('No session token received from server');
        }

        console.log('[Auth] Storing token...');
        
        // 🚨 CRITICAL FIX: Wrap token storage in try-catch to prevent crashes
        try {
          await tokenStorage.setToken(data.session.token);
          console.log('[Auth] Token stored successfully');
        } catch (storageError: any) {
          console.error('[Auth] ❌ CRITICAL: Token storage failed:', storageError);
          console.error('[Auth] Storage error details:', storageError.message, storageError.name);
          // Continue anyway - set user state even if storage fails
          // This prevents the app from crashing but allows the user to proceed
          console.warn('[Auth] ⚠️ Continuing without token storage - session will not persist');
        }
        
        console.log('[Auth] Setting user state...');
        setUser(data.user);
        console.log('[Auth] User state set:', data.user.email);
        
        // CRITICAL: Add a small delay to ensure state updates propagate
        // This prevents race conditions where navigation happens before state is ready
        await new Promise(resolve => setTimeout(resolve, 100));
        
        console.log('[Auth] ========== SIGN IN COMPLETED SUCCESSFULLY ==========');
      } catch (error: any) {
        clearTimeout(timeoutId);
        console.error('[Auth] Fetch error:', error);
        console.error('[Auth] Error type:', error.constructor.name);
        console.error('[Auth] Error message:', error.message);
        console.error('[Auth] Error stack:', error.stack);
        throw error;
      }
    } catch (error: any) {
      console.error('[Auth] Sign in failed:', error.message);
      console.error('[Auth] Error name:', error.name);
      console.error('[Auth] Error stack:', error.stack);
      
      if (error.name === 'AbortError') {
        throw new Error('Sign in timed out. Please check your connection and try again.');
      }
      
      if (error.message === 'Network request failed' || error.name === 'TypeError') {
        throw new Error('Cannot connect to server. Please check your internet connection.');
      }
      
      throw error;
    } finally {
      setLoading(false);
      authLock.current = false;
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string, name?: string) => {
    // CRITICAL: Prevent concurrent operations
    if (authLock.current) {
      throw new Error('Authentication operation already in progress. Please wait.');
    }

    authLock.current = true;
    setLoading(true);
    console.log('[Auth] ========== SIGN UP STARTED ==========');
    console.log('[Auth] Platform:', Platform.OS);
    console.log('[Auth] Email:', email);
    console.log('[Auth] Name:', name);
    console.log('[Auth] BACKEND_URL:', BACKEND_URL);
    
    if (!BACKEND_URL) {
      authLock.current = false;
      setLoading(false);
      throw new Error('Backend URL is not configured');
    }

    const url = `${BACKEND_URL}/api/auth/sign-up/email`;
    console.log('[Auth] Request URL:', url);
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.warn('[Auth] Sign up timeout, aborting...');
        controller.abort();
      }, SIGN_IN_TIMEOUT);
      
      try {
        console.log('[Auth] Sending fetch request...');
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email, password, name: name || 'User' }),
          signal: controller.signal,
        });

        console.log('[Auth] Response received:', response.status, response.statusText);
        clearTimeout(timeoutId);

        if (!response.ok) {
          console.error('[Auth] Response not OK:', response.status);
          const errorText = await response.text();
          console.error('[Auth] Error response body:', errorText);
          let errorData;
          try {
            errorData = JSON.parse(errorText);
          } catch {
            throw new Error(`Registration failed: ${errorText}`);
          }
          throw new Error(errorData.error || 'Registration failed');
        }

        const data = await response.json();
        console.log('[Auth] Response data received:', { hasSession: !!data.session, hasUser: !!data.user });

        if (!data.session || !data.session.token) {
          throw new Error('No session token received from server');
        }

        // 🚨 CRITICAL FIX: Wrap token storage in try-catch to prevent crashes
        try {
          await tokenStorage.setToken(data.session.token);
          console.log('[Auth] Token stored successfully');
        } catch (storageError: any) {
          console.error('[Auth] ❌ CRITICAL: Token storage failed:', storageError);
          console.error('[Auth] Storage error details:', storageError.message, storageError.name);
          // Continue anyway - set user state even if storage fails
          console.warn('[Auth] ⚠️ Continuing without token storage - session will not persist');
        }
        
        setUser(data.user);
        console.log('[Auth] ========== SIGN UP COMPLETED ==========');
      } catch (error: any) {
        clearTimeout(timeoutId);
        console.error('[Auth] Fetch error:', error);
        throw error;
      }
    } catch (error: any) {
      console.error('[Auth] Sign up failed:', error.message);
      console.error('[Auth] Error name:', error.name);
      console.error('[Auth] Error stack:', error.stack);
      
      if (error.name === 'AbortError') {
        throw new Error('Sign up timed out. Please check your connection and try again.');
      }
      
      if (error.message === 'Network request failed' || error.name === 'TypeError') {
        throw new Error('Cannot connect to server. Please check your internet connection.');
      }
      
      throw error;
    } finally {
      setLoading(false);
      authLock.current = false;
    }
  }, []);

  const signInWithApple = useCallback(async (identityToken: string, appleUser?: any) => {
    // CRITICAL: Prevent concurrent operations
    if (authLock.current) {
      throw new Error('Authentication operation already in progress. Please wait.');
    }

    authLock.current = true;
    setLoading(true);
    console.log('[Auth] ========== APPLE SIGN IN STARTED ==========');
    console.log('[Auth] Platform:', Platform.OS);
    console.log('[Auth] Identity token length:', identityToken?.length);
    console.log('[Auth] Apple user data:', appleUser);
    console.log('[Auth] BACKEND_URL:', BACKEND_URL);

    // CRITICAL: Validate all inputs before ANY native operations
    if (!identityToken || typeof identityToken !== 'string') {
      console.error('[Auth] Invalid identity token:', typeof identityToken);
      authLock.current = false;
      setLoading(false);
      throw new Error('Invalid identity token received from Apple');
    }

    if (!BACKEND_URL) {
      console.error('[Auth] Backend URL not configured');
      authLock.current = false;
      setLoading(false);
      throw new Error('Backend URL is not configured');
    }

    const requestBody = { 
      identityToken,
      user: appleUser ? {
        email: appleUser.email || undefined,
        name: appleUser.name ? {
          firstName: appleUser.name.givenName || undefined,
          lastName: appleUser.name.familyName || undefined,
        } : undefined,
      } : undefined,
    };

    const url = `${BACKEND_URL}/api/auth/sign-in/apple`;
    console.log('[Auth] Request URL:', url);
    console.log('[Auth] Request body:', JSON.stringify(requestBody, null, 2));

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.warn('[Auth] Apple sign in timeout, aborting...');
        controller.abort();
      }, SIGN_IN_TIMEOUT);

      try {
        console.log('[Auth] Sending fetch request...');
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        });

        console.log('[Auth] Response received:', response.status, response.statusText);
        clearTimeout(timeoutId);

        if (!response.ok) {
          console.error('[Auth] Response not OK:', response.status);
          const errorText = await response.text();
          console.error('[Auth] Error response body:', errorText);
          let errorData;
          try {
            errorData = JSON.parse(errorText);
          } catch {
            throw new Error(`Apple sign in failed: ${errorText}`);
          }
          throw new Error(errorData.error || 'Apple sign in failed');
        }

        const data = await response.json();
        console.log('[Auth] Response data received:', { hasSession: !!data.session, hasUser: !!data.user });

        // CRITICAL: Validate response data before ANY native storage operations
        if (!data || typeof data !== 'object') {
          console.error('[Auth] Invalid response data type:', typeof data);
          throw new Error('Invalid response from server');
        }

        if (!data.session || typeof data.session !== 'object') {
          console.error('[Auth] Invalid session object:', data.session);
          throw new Error('No session received from server');
        }

        if (!data.session.token || typeof data.session.token !== 'string') {
          console.error('[Auth] Invalid session token:', typeof data.session.token);
          throw new Error('No valid session token received from server');
        }

        if (!data.user || typeof data.user !== 'object') {
          console.error('[Auth] Invalid user object:', data.user);
          throw new Error('No user data received from server');
        }

        // CRITICAL: Log BEFORE native storage operation (SecureStore/Keychain)
        console.log('[Auth] ⚠️ ABOUT TO CALL NATIVE: tokenStorage.setToken (SecureStore/Keychain)');
        console.log('[Auth] Token length:', data.session.token.length);
        
        // 🚨 CRITICAL FIX: Wrap token storage in try-catch to prevent crashes
        try {
          await tokenStorage.setToken(data.session.token);
          console.log('[Auth] ✅ NATIVE CALL SUCCESS: Token stored in SecureStore/Keychain');
        } catch (storageError: any) {
          console.error('[Auth] ❌ NATIVE CALL FAILED: tokenStorage.setToken');
          console.error('[Auth] Storage error:', storageError);
          console.error('[Auth] Error name:', storageError.name);
          console.error('[Auth] Error message:', storageError.message);
          console.error('[Auth] Error stack:', storageError.stack);
          // 🚨 CRITICAL: Don't throw - continue with authentication
          // The user can still use the app, but the session won't persist
          console.warn('[Auth] ⚠️ Continuing without token storage - session will not persist');
        }

        console.log('[Auth] Setting user state...');
        setUser(data.user);
        console.log('[Auth] ========== APPLE SIGN IN COMPLETED ==========');
      } catch (error: any) {
        clearTimeout(timeoutId);
        console.error('[Auth] Fetch error:', error);
        throw error;
      }
    } catch (error: any) {
      console.error('[Auth] Apple sign in failed:', error.message);
      console.error('[Auth] Error name:', error.name);
      console.error('[Auth] Error stack:', error.stack);
      
      if (error.name === 'AbortError') {
        throw new Error('Apple sign in timed out. Please check your connection and try again.');
      }
      
      if (error.message === 'Network request failed' || error.name === 'TypeError') {
        throw new Error('Cannot connect to server. Please check your internet connection.');
      }
      
      throw error;
    } finally {
      setLoading(false);
      authLock.current = false;
    }
  }, []);

  const signOut = useCallback(async () => {
    // CRITICAL: Prevent concurrent operations
    if (authLock.current) {
      console.warn('[Auth] Auth operation in progress, forcing sign out anyway');
    }

    authLock.current = true;
    console.log('[Auth] ========== SIGN OUT STARTED ==========');
    
    try {
      const token = await tokenStorage.getToken();
      
      if (token && BACKEND_URL) {
        // Fire-and-forget backend call with VERY short timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), SIGN_OUT_BACKEND_TIMEOUT);
        
        fetch(`${BACKEND_URL}/api/auth/sign-out`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
          signal: controller.signal,
        }).then(() => {
          clearTimeout(timeoutId);
          console.log('[Auth] Backend sign-out successful');
        }).catch((error) => {
          clearTimeout(timeoutId);
          console.warn('[Auth] Backend sign-out failed (ignored):', error.message);
        });
      }
    } catch (error) {
      console.error('[Auth] Sign out error (ignored):', error);
    } finally {
      // ALWAYS clear local state immediately, regardless of backend call
      console.log('[Auth] Clearing local state...');
      
      try {
        await tokenStorage.removeToken();
      } catch (error) {
        console.error('[Auth] Failed to remove token (ignored):', error);
      }
      
      try {
        await clearBiometricCredentials();
      } catch (error) {
        console.error('[Auth] Failed to clear biometric credentials (ignored):', error);
      }
      
      setUser(null);
      setLoading(false); // Ensure loading is false
      authLock.current = false;
      console.log('[Auth] ========== SIGN OUT COMPLETED ==========');
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signIn,
        signUp,
        signInWithApple,
        signOut,
        isAuthenticated: !!user,
        refreshTrigger,
        triggerRefresh,
        checkAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

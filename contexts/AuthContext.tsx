
import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { clearBiometricCredentials } from '@/utils/biometricAuth';

const API_URL = Constants.expoConfig?.extra?.backendUrl || '';
const TOKEN_KEY = 'seatime_auth_token';

// CRITICAL: Absolute maximum timeouts to prevent hanging
const AUTH_CHECK_TIMEOUT = 3000; // 3 seconds max for auth check
const SIGN_IN_TIMEOUT = 10000; // 10 seconds max for sign in
const SIGN_OUT_BACKEND_TIMEOUT = 500; // 500ms for backend sign out (fire-and-forget)
const SAFETY_TIMEOUT = 4000; // 4 seconds absolute maximum for loading state

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

// Token storage with bulletproof error handling
const tokenStorage = {
  async getToken(): Promise<string | null> {
    try {
      console.log('[Auth] Getting token from storage, Platform:', Platform.OS);
      
      if (Platform.OS === 'web') {
        try {
          const token = localStorage.getItem(TOKEN_KEY);
          console.log('[Auth] Web token retrieved:', token ? 'YES (length: ' + token.length + ')' : 'NO');
          return token;
        } catch (webError) {
          console.error('[Auth] Web localStorage error:', webError);
          return null;
        }
      }
      
      console.log('[Auth] Getting token from SecureStore...');
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      console.log('[Auth] SecureStore token retrieved:', token ? 'YES (length: ' + token.length + ')' : 'NO');
      return token;
    } catch (error: any) {
      console.error('[Auth] Error getting token:', error);
      console.error('[Auth] Error details:', error.message, error.name);
      return null;
    }
  },
  
  async setToken(token: string): Promise<void> {
    try {
      console.log('[Auth] Storing token, Platform:', Platform.OS, 'token length:', token.length);
      
      if (Platform.OS === 'web') {
        try {
          localStorage.setItem(TOKEN_KEY, token);
          console.log('[Auth] Token stored in localStorage');
        } catch (error: any) {
          console.warn('[Auth] localStorage not accessible:', error.message);
        }
      } else {
        await SecureStore.setItemAsync(TOKEN_KEY, token);
        console.log('[Auth] Token stored in SecureStore');
      }
    } catch (error: any) {
      console.error('[Auth] Error storing token:', error);
      console.error('[Auth] Error details:', error.message, error.name);
      // Don't throw - allow auth to continue even if storage fails
    }
  },
  
  async removeToken(): Promise<void> {
    try {
      console.log('[Auth] Removing token, Platform:', Platform.OS);
      
      if (Platform.OS === 'web') {
        try {
          localStorage.removeItem(TOKEN_KEY);
          console.log('[Auth] Token removed from localStorage');
        } catch {
          // Ignore errors
        }
      } else {
        await SecureStore.deleteItemAsync(TOKEN_KEY);
        console.log('[Auth] Token removed from SecureStore');
      }
    } catch (error: any) {
      console.error('[Auth] Error removing token:', error);
      console.error('[Auth] Error details:', error.message, error.name);
      // Don't throw - we want to continue even if removal fails
    }
  },
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  // CRITICAL: Use a single lock to prevent ALL concurrent auth operations
  const authLock = useRef(false);
  const safetyTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const triggerRefresh = useCallback(() => {
    console.log('[Auth] ========== GLOBAL REFRESH TRIGGERED ==========');
    setRefreshTrigger(prev => prev + 1);
  }, []);

  // CRITICAL: Safety timeout to FORCE loading state to false
  useEffect(() => {
    safetyTimeoutRef.current = setTimeout(() => {
      if (loading) {
        console.warn('[Auth] ⚠️ SAFETY TIMEOUT - Force stopping loading state after 4 seconds');
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

  const checkAuth = useCallback(async () => {
    // CRITICAL: Prevent ANY concurrent auth operations
    if (authLock.current) {
      console.log('[Auth] Auth operation in progress, skipping check');
      return;
    }

    authLock.current = true;
    
    try {
      console.log('[Auth] Starting auth check...');
      console.log('[Auth] Platform:', Platform.OS);
      console.log('[Auth] API_URL:', API_URL || 'NOT CONFIGURED');
      
      if (!API_URL) {
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
        const url = `${API_URL}/api/auth/user`;
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

  // Initial auth check on mount
  useEffect(() => {
    console.log('[Auth] Starting initial auth check...');
    checkAuth();
  }, [checkAuth]);

  const signIn = useCallback(async (email: string, password: string) => {
    // CRITICAL: Prevent concurrent operations
    if (authLock.current) {
      throw new Error('Authentication operation already in progress. Please wait.');
    }

    authLock.current = true;
    console.log('[Auth] ========== SIGN IN STARTED ==========');
    console.log('[Auth] Platform:', Platform.OS);
    console.log('[Auth] Email:', email);
    console.log('[Auth] API_URL:', API_URL);
    
    if (!API_URL) {
      authLock.current = false;
      throw new Error('Backend URL is not configured');
    }

    const url = `${API_URL}/api/auth/sign-in/email`;
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
        await tokenStorage.setToken(data.session.token);
        console.log('[Auth] Setting user state...');
        setUser(data.user);
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
      authLock.current = false;
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string, name?: string) => {
    // CRITICAL: Prevent concurrent operations
    if (authLock.current) {
      throw new Error('Authentication operation already in progress. Please wait.');
    }

    authLock.current = true;
    console.log('[Auth] ========== SIGN UP STARTED ==========');
    console.log('[Auth] Platform:', Platform.OS);
    console.log('[Auth] Email:', email);
    console.log('[Auth] Name:', name);
    console.log('[Auth] API_URL:', API_URL);
    
    if (!API_URL) {
      authLock.current = false;
      throw new Error('Backend URL is not configured');
    }

    const url = `${API_URL}/api/auth/sign-up/email`;
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

        await tokenStorage.setToken(data.session.token);
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
      authLock.current = false;
    }
  }, []);

  const signInWithApple = useCallback(async (identityToken: string, appleUser?: any) => {
    // CRITICAL: Prevent concurrent operations
    if (authLock.current) {
      throw new Error('Authentication operation already in progress. Please wait.');
    }

    authLock.current = true;
    console.log('[Auth] ========== APPLE SIGN IN STARTED ==========');
    console.log('[Auth] Platform:', Platform.OS);
    console.log('[Auth] Identity token length:', identityToken?.length);
    console.log('[Auth] Apple user data:', appleUser);
    console.log('[Auth] API_URL:', API_URL);

    if (!API_URL) {
      authLock.current = false;
      throw new Error('Backend URL is not configured');
    }

    if (!identityToken) {
      authLock.current = false;
      throw new Error('No identity token provided');
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

    const url = `${API_URL}/api/auth/sign-in/apple`;
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

        if (!data.session || !data.session.token) {
          throw new Error('No session token received from server');
        }

        await tokenStorage.setToken(data.session.token);
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
      
      if (token && API_URL) {
        // Fire-and-forget backend call with VERY short timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), SIGN_OUT_BACKEND_TIMEOUT);
        
        fetch(`${API_URL}/api/auth/sign-out`, {
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

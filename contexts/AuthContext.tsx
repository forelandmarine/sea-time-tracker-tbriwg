
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { clearBiometricCredentials } from '@/utils/biometricAuth';

const API_URL = Constants.expoConfig?.extra?.backendUrl || '';
const TOKEN_KEY = 'seatime_auth_token';

interface User {
  id: string;
  email: string;
  name?: string;
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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Platform-specific token storage
const tokenStorage = {
  async getToken(): Promise<string | null> {
    try {
      if (Platform.OS === 'web') {
        try {
          const token = localStorage.getItem(TOKEN_KEY);
          return token;
        } catch (storageError) {
          console.warn('[Auth] localStorage not accessible:', storageError);
          return null;
        }
      }
      return await SecureStore.getItemAsync(TOKEN_KEY);
    } catch (error) {
      console.error('[Auth] Error getting token:', error);
      return null;
    }
  },
  
  async setToken(token: string): Promise<void> {
    try {
      console.log('[Auth] Storing token, length:', token?.length);
      if (Platform.OS === 'web') {
        try {
          localStorage.setItem(TOKEN_KEY, token);
          console.log('[Auth] Token stored successfully in localStorage');
        } catch (storageError) {
          console.warn('[Auth] localStorage not accessible:', storageError);
        }
      } else {
        await SecureStore.setItemAsync(TOKEN_KEY, token);
        console.log('[Auth] Token stored successfully in SecureStore');
      }
    } catch (error) {
      console.error('[Auth] Error storing token:', error);
    }
  },
  
  async removeToken(): Promise<void> {
    try {
      console.log('[Auth] Removing token from storage');
      if (Platform.OS === 'web') {
        try {
          localStorage.removeItem(TOKEN_KEY);
          console.log('[Auth] Token removed successfully from localStorage');
        } catch (storageError) {
          console.warn('[Auth] localStorage not accessible:', storageError);
        }
      } else {
        await SecureStore.deleteItemAsync(TOKEN_KEY);
        console.log('[Auth] Token removed successfully from SecureStore');
      }
    } catch (error) {
      console.error('[Auth] Error removing token:', error);
    }
  },
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Function to trigger app-wide data refresh
  const triggerRefresh = () => {
    console.log('[Auth] ========== GLOBAL REFRESH TRIGGERED ==========');
    setRefreshTrigger(prev => prev + 1);
  };

  // Check for existing session on mount
  useEffect(() => {
    console.log('[Auth] Starting auth check...');
    checkAuth();
  }, []);

  // Safety timeout - if auth check takes too long, stop loading
  // CRITICAL: Increased to 5 seconds to give more time for slow connections
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (loading) {
        console.warn('[Auth] Auth check timeout (5s) - stopping loading state');
        setLoading(false);
      }
    }, 5000); // 5 second timeout
    
    return () => clearTimeout(timeout);
  }, [loading]);

  const checkAuth = async () => {
    try {
      console.log('[Auth] Checking authentication status...');
      console.log('[Auth] API URL:', API_URL);
      console.log('[Auth] Platform:', Platform.OS);
      
      if (!API_URL) {
        console.warn('[Auth] Backend URL not configured, skipping auth check');
        setLoading(false);
        setUser(null);
        return;
      }

      const token = await tokenStorage.getToken();
      
      if (!token) {
        console.log('[Auth] No token found');
        setLoading(false);
        setUser(null);
        return;
      }

      console.log('[Auth] Token found, verifying with backend...');
      
      // Add timeout for fetch request - increased to 4s for better reliability
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000); // 4 second timeout
      
      try {
        const response = await fetch(`${API_URL}/api/auth/user`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          console.log('[Auth] User authenticated:', data.user?.email || 'unknown');
          setUser(data.user);
        } else {
          console.log('[Auth] Token invalid, clearing... Status:', response.status);
          await tokenStorage.removeToken();
          setUser(null);
        }
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        
        if (fetchError.name === 'AbortError') {
          console.warn('[Auth] Auth check timed out after 4 seconds');
        } else {
          console.error('[Auth] Fetch error:', fetchError);
        }
        
        // Don't clear token on network errors - might be temporary
        if (fetchError instanceof TypeError && fetchError.message.includes('Network')) {
          console.warn('[Auth] Network error during auth check, keeping token for next app launch');
        } else if (fetchError.name !== 'AbortError') {
          await tokenStorage.removeToken();
        }
        setUser(null);
      }
    } catch (error) {
      console.error('[Auth] Check auth failed:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      console.log('[Auth] ========== SIGN IN STARTED ==========');
      console.log('[Auth] Email:', email);
      console.log('[Auth] API URL:', API_URL);
      
      if (!API_URL) {
        throw new Error('Backend URL is not configured. Please check app.json extra.backendUrl');
      }

      const url = `${API_URL}/api/auth/sign-in/email`;
      console.log('[Auth] Full request URL:', url);
      
      // Add timeout for fetch request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email, password }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        console.log('[Auth] Sign in response status:', response.status);

        if (!response.ok) {
          let errorData;
          try {
            errorData = await response.json();
          } catch (e) {
            throw new Error(`Login failed with status ${response.status}`);
          }
          console.error('[Auth] Sign in failed with error:', errorData);
          throw new Error(errorData.error || 'Login failed');
        }

        const data = await response.json();
        console.log('[Auth] Sign in response received');
        console.log('[Auth] User:', data.user?.email);
        console.log('[Auth] Has session:', !!data.session);
        console.log('[Auth] Has token:', !!data.session?.token);

        if (!data.session || !data.session.token) {
          console.error('[Auth] Missing session or token in response');
          throw new Error('No session token received from server');
        }

        console.log('[Auth] Storing token...');
        await tokenStorage.setToken(data.session.token);
        console.log('[Auth] Token stored successfully');
        
        console.log('[Auth] Setting user state...');
        setUser(data.user);
        console.log('[Auth] User state updated successfully');
        console.log('[Auth] ========== SIGN IN COMPLETED ==========');
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        
        if (fetchError.name === 'AbortError') {
          throw new Error('Sign in timed out. Please check your internet connection and try again.');
        }
        
        throw fetchError;
      }
    } catch (error: any) {
      console.error('[Auth] ========== SIGN IN FAILED ==========');
      console.error('[Auth] Error message:', error?.message);
      console.error('[Auth] Error name:', error?.name);
      console.error('[Auth] Full error:', error);
      
      // Provide more helpful error messages
      if (error.message === 'Network request failed' || error.name === 'TypeError') {
        throw new Error('Cannot connect to server. Please check your internet connection and ensure the backend is running.');
      }
      
      throw error;
    }
  };

  const signUp = async (email: string, password: string, name?: string) => {
    try {
      console.log('[Auth] ========== SIGN UP STARTED ==========');
      console.log('[Auth] Email:', email);
      console.log('[Auth] Name:', name);
      console.log('[Auth] API URL:', API_URL);
      
      if (!API_URL) {
        throw new Error('Backend URL is not configured. Please check app.json extra.backendUrl');
      }

      const url = `${API_URL}/api/auth/sign-up/email`;
      console.log('[Auth] Full request URL:', url);
      
      // Add timeout for fetch request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email, password, name: name || 'User' }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        console.log('[Auth] Sign up response status:', response.status);

        if (!response.ok) {
          let errorData;
          try {
            errorData = await response.json();
          } catch (e) {
            throw new Error(`Registration failed with status ${response.status}`);
          }
          console.error('[Auth] Sign up failed with error:', errorData);
          throw new Error(errorData.error || 'Registration failed');
        }

        const data = await response.json();
        console.log('[Auth] Sign up response received');
        console.log('[Auth] User:', data.user?.email);
        console.log('[Auth] Has session:', !!data.session);
        console.log('[Auth] Has token:', !!data.session?.token);

        if (!data.session || !data.session.token) {
          console.error('[Auth] Missing session or token in response');
          throw new Error('No session token received from server');
        }

        console.log('[Auth] Storing token...');
        await tokenStorage.setToken(data.session.token);
        console.log('[Auth] Token stored successfully');
        
        console.log('[Auth] Setting user state...');
        setUser(data.user);
        console.log('[Auth] User state updated successfully');
        console.log('[Auth] ========== SIGN UP COMPLETED ==========');
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        
        if (fetchError.name === 'AbortError') {
          throw new Error('Sign up timed out. Please check your internet connection and try again.');
        }
        
        throw fetchError;
      }
    } catch (error: any) {
      console.error('[Auth] ========== SIGN UP FAILED ==========');
      console.error('[Auth] Error message:', error?.message);
      console.error('[Auth] Error name:', error?.name);
      console.error('[Auth] Full error:', error);
      
      // Provide more helpful error messages
      if (error.message === 'Network request failed' || error.name === 'TypeError') {
        throw new Error('Cannot connect to server. Please check your internet connection and ensure the backend is running.');
      }
      
      throw error;
    }
  };

  const signInWithApple = async (identityToken: string, appleUser?: any) => {
    try {
      console.log('[Auth] Signing in with Apple');
      console.log('[Auth] Identity token length:', identityToken?.length);
      console.log('[Auth] Apple user data:', appleUser);
      console.log('[Auth] API URL:', API_URL);

      if (!API_URL) {
        throw new Error('Backend URL is not configured. Please check app.json extra.backendUrl');
      }

      if (!identityToken) {
        throw new Error('No identity token provided');
      }

      // Format the request body to match backend expectations
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
      console.log('[Auth] Full request URL:', url);
      console.log('[Auth] Request body:', JSON.stringify(requestBody, null, 2));

      // Add timeout for fetch request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        console.log('[Auth] Apple sign in response status:', response.status);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('[Auth] Apple sign in failed. Status:', response.status);
          console.error('[Auth] Error response:', errorText);
          
          let errorData;
          try {
            errorData = JSON.parse(errorText);
          } catch (e) {
            throw new Error(`Apple sign in failed with status ${response.status}: ${errorText}`);
          }
          
          throw new Error(errorData.error || 'Apple sign in failed');
        }

        const data = await response.json();
        console.log('[Auth] Apple sign in response received');
        console.log('[Auth] Is new user:', data.isNewUser);
        console.log('[Auth] User email:', data.user?.email);

        if (!data.session || !data.session.token) {
          console.error('[Auth] Missing session or token in response');
          throw new Error('No session token received from server');
        }

        await tokenStorage.setToken(data.session.token);
        setUser(data.user);
        console.log('[Auth] Apple sign in successful, user:', data.user.email);
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        
        if (fetchError.name === 'AbortError') {
          throw new Error('Apple sign in timed out. Please check your internet connection and try again.');
        }
        
        throw fetchError;
      }
    } catch (error: any) {
      console.error('[Auth] Apple sign in failed:', error?.message);
      console.error('[Auth] Full error:', error);
      
      // Provide more helpful error messages
      if (error.message === 'Network request failed' || error.name === 'TypeError') {
        throw new Error('Cannot connect to server. Please check your internet connection and ensure the backend is running.');
      }
      
      throw error;
    }
  };

  const signOut = async () => {
    console.log('[Auth] ========== SIGN OUT STARTED ==========');
    
    // CRITICAL: Use finally block to ALWAYS clear local state
    // This ensures user is signed out even if backend call fails
    let backendCallSucceeded = false;
    
    try {
      const token = await tokenStorage.getToken();
      console.log('[Auth] Retrieved token for sign out, has token:', !!token);
      
      if (token && API_URL) {
        console.log('[Auth] Calling backend sign-out endpoint...');
        try {
          // Add timeout to prevent hanging - reduced to 1s for fail-fast
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 1000); // 1 second timeout
          
          const response = await fetch(`${API_URL}/api/auth/sign-out`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({}),
            signal: controller.signal,
          });
          
          clearTimeout(timeoutId);
          console.log('[Auth] Backend sign-out response status:', response.status);
          
          if (response.ok) {
            const data = await response.json();
            console.log('[Auth] Backend sign-out successful:', data);
            backendCallSucceeded = true;
          } else {
            const errorText = await response.text();
            console.warn('[Auth] Backend sign-out failed:', response.status, errorText);
          }
        } catch (fetchError: any) {
          if (fetchError.name === 'AbortError') {
            console.warn('[Auth] Backend sign-out timed out after 1 second');
          } else {
            console.error('[Auth] Backend sign-out request failed:', fetchError);
          }
          // Continue with local sign-out even if backend call fails
        }
      } else {
        console.log('[Auth] No token or API URL, skipping backend call');
      }
    } catch (error) {
      console.error('[Auth] Sign out error during backend call:', error);
      // Continue to finally block to clear local state
    } finally {
      // ALWAYS clear local state, regardless of backend success
      console.log('[Auth] Clearing local token and user state (finally block)...');
      
      try {
        await tokenStorage.removeToken();
        console.log('[Auth] Token removed successfully');
      } catch (tokenError) {
        console.error('[Auth] Failed to remove token:', tokenError);
        // Continue anyway
      }
      
      try {
        // Clear biometric credentials on sign out
        console.log('[Auth] Clearing biometric credentials...');
        await clearBiometricCredentials();
        console.log('[Auth] Biometric credentials cleared');
      } catch (bioError) {
        console.error('[Auth] Failed to clear biometric credentials:', bioError);
        // Continue anyway
      }
      
      // ALWAYS set user to null - this is the critical step
      setUser(null);
      console.log('[Auth] User state cleared');
      console.log('[Auth] ========== SIGN OUT COMPLETED ==========');
      console.log('[Auth] Backend call succeeded:', backendCallSucceeded);
    }
  };

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

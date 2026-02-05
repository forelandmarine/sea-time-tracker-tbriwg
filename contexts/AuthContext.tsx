
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
  emailVerified?: boolean;
  image?: string | null;
  createdAt?: string;
  updatedAt?: string;
  subscription_status?: 'active' | 'inactive';
  subscription_expires_at?: string | null;
  subscription_product_id?: string | null;
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

  // Safety timeout - REDUCED to 2 seconds for faster loading
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (loading) {
        console.warn('[Auth] Auth check timeout - stopping loading state');
        setLoading(false);
      }
    }, 2000); // REDUCED from 5s to 2s
    
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
      
      // REDUCED timeout to 2 seconds for faster loading
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000); // REDUCED from 3s to 2s
      
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
          console.log('[Auth] ========== AUTH CHECK SUCCESS ==========');
          console.log('[Auth] User authenticated:', data.user?.email || 'unknown');
          console.log('[Auth] User ID:', data.user?.id);
          console.log('[Auth] Subscription status:', data.user?.subscription_status);
          console.log('[Auth] ==========================================');
          
          // Store user with subscription data
          const userData = {
            ...data.user,
            subscription_status: data.user?.subscription_status || 'inactive',
            subscription_expires_at: data.user?.subscription_expires_at || null,
            subscription_product_id: data.user?.subscription_product_id || null,
          };
          
          setUser(userData);
          setLoading(false);
          return;
        } else {
          console.log('[Auth] Token invalid, clearing... Status:', response.status);
          await tokenStorage.removeToken();
          setUser(null);
          setLoading(false);
          return;
        }
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        
        if (fetchError.name === 'AbortError') {
          console.warn('[Auth] Auth check timed out');
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
        setLoading(false);
        return;
      }
    } catch (error) {
      console.error('[Auth] Check auth failed:', error);
      setUser(null);
      setLoading(false);
      return;
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      console.log('[Auth] Signing in:', email);
      console.log('[Auth] API URL:', API_URL);
      
      if (!API_URL) {
        throw new Error('Backend URL is not configured. Please check app.json extra.backendUrl');
      }

      const url = `${API_URL}/api/auth/sign-in/email`;
      console.log('[Auth] Full request URL:', url);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      console.log('[Auth] Sign in response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('[Auth] Sign in failed with error:', errorData);
        throw new Error(errorData.error || 'Login failed');
      }

      const data = await response.json();
      console.log('[Auth] ========== SIGN IN SUCCESS ==========');
      console.log('[Auth] User email:', data.user?.email);
      console.log('[Auth] User ID:', data.user?.id);
      console.log('[Auth] Subscription status:', data.user?.subscription_status);
      console.log('[Auth] ==========================================');

      if (!data.session || !data.session.token) {
        console.error('[Auth] Missing session or token');
        throw new Error('No session token received from server');
      }

      await tokenStorage.setToken(data.session.token);
      
      // Store user with subscription data
      const userData = {
        ...data.user,
        subscription_status: data.user?.subscription_status || 'inactive',
        subscription_expires_at: data.user?.subscription_expires_at || null,
        subscription_product_id: data.user?.subscription_product_id || null,
      };
      
      setUser(userData);
      console.log('[Auth] Sign in successful, user state updated with subscription data');
    } catch (error: any) {
      console.error('[Auth] Sign in failed:', error?.message);
      
      // Provide more helpful error messages
      if (error.message === 'Network request failed' || error.name === 'TypeError') {
        throw new Error('Cannot connect to server. Please check your internet connection and ensure the backend is running.');
      }
      
      throw error;
    }
  };

  const signUp = async (email: string, password: string, name?: string) => {
    try {
      console.log('[Auth] Signing up:', email);
      console.log('[Auth] API URL:', API_URL);
      
      if (!API_URL) {
        throw new Error('Backend URL is not configured. Please check app.json extra.backendUrl');
      }

      const url = `${API_URL}/api/auth/sign-up/email`;
      console.log('[Auth] Full request URL:', url);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, name: name || 'User' }),
      });

      console.log('[Auth] Sign up response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('[Auth] Sign up failed with error:', errorData);
        throw new Error(errorData.error || 'Registration failed');
      }

      const data = await response.json();
      console.log('[Auth] ========== SIGN UP SUCCESS ==========');
      console.log('[Auth] User email:', data.user?.email);
      console.log('[Auth] User ID:', data.user?.id);
      console.log('[Auth] Subscription status:', data.user?.subscription_status);
      console.log('[Auth] ==========================================');

      if (!data.session || !data.session.token) {
        console.error('[Auth] Missing session or token');
        throw new Error('No session token received from server');
      }

      await tokenStorage.setToken(data.session.token);
      
      // Store user with subscription data (defaults to inactive for new users)
      const userData = {
        ...data.user,
        subscription_status: data.user?.subscription_status || 'inactive',
        subscription_expires_at: data.user?.subscription_expires_at || null,
        subscription_product_id: data.user?.subscription_product_id || null,
      };
      
      setUser(userData);
      console.log('[Auth] Sign up successful with subscription data');
    } catch (error: any) {
      console.error('[Auth] Sign up failed:', error?.message);
      
      // Provide more helpful error messages
      if (error.message === 'Network request failed' || error.name === 'TypeError') {
        throw new Error('Cannot connect to server. Please check your internet connection and ensure the backend is running.');
      }
      
      throw error;
    }
  };

  const signInWithApple = async (identityToken: string, appleUser?: any) => {
    try {
      console.log('[Auth] ========== APPLE SIGN IN STARTED ==========');
      console.log('[Auth] Identity token length:', identityToken?.length);
      console.log('[Auth] API URL:', API_URL);

      if (!API_URL) {
        throw new Error('Backend URL is not configured. Please check app.json extra.backendUrl');
      }

      if (!identityToken) {
        throw new Error('No identity token provided');
      }

      const requestBody = { 
        identityToken,
        user: appleUser,
      };

      const url = `${API_URL}/api/auth/sign-in/apple`;
      console.log('[Auth] Full request URL:', url);

      // REDUCED timeout to 10 seconds for faster loading
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.error('[Auth] Apple sign in request timeout');
        controller.abort();
      }, 10000); // REDUCED from 15s to 10s

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
          console.error('[Auth] Error response body:', errorText);
          
          let errorData;
          try {
            errorData = JSON.parse(errorText);
          } catch (e) {
            throw new Error(`Apple sign in failed with status ${response.status}: ${errorText}`);
          }
          
          throw new Error(errorData.error || 'Apple sign in failed');
        }

        const data = await response.json();
        console.log('[Auth] ========== APPLE SIGN IN SUCCESS ==========');
        console.log('[Auth] User email:', data.user?.email);
        console.log('[Auth] User ID:', data.user?.id);
        console.log('[Auth] Subscription status:', data.user?.subscription_status);
        console.log('[Auth] ==========================================');

        if (!data.session || !data.session.token) {
          console.error('[Auth] Missing session or token in response');
          throw new Error('No session token received from server');
        }

        console.log('[Auth] Storing token...');
        await tokenStorage.setToken(data.session.token);
        console.log('[Auth] Token stored successfully');
        
        // Store user with subscription data
        const userData = {
          ...data.user,
          subscription_status: data.user?.subscription_status || 'inactive',
          subscription_expires_at: data.user?.subscription_expires_at || null,
          subscription_product_id: data.user?.subscription_product_id || null,
        };
        
        console.log('[Auth] Setting user state...');
        setUser(userData);
        console.log('[Auth] ========== APPLE SIGN IN COMPLETED ==========');
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        
        if (fetchError.name === 'AbortError') {
          console.error('[Auth] Apple sign in request timed out');
          throw new Error('Sign in request timed out. Please check your internet connection and try again.');
        }
        
        throw fetchError;
      }
    } catch (error: any) {
      console.error('[Auth] ========== APPLE SIGN IN FAILED ==========');
      console.error('[Auth] Error type:', error?.name);
      console.error('[Auth] Error message:', error?.message);
      console.error('[Auth] ==========================================');
      
      // Provide more helpful error messages
      if (error.message === 'Network request failed' || error.name === 'TypeError') {
        throw new Error('Cannot connect to server. Please check your internet connection and ensure the backend is running.');
      }
      
      throw error;
    }
  };

  const signOut = async () => {
    console.log('[Auth] ========== SIGN OUT STARTED ==========');
    
    try {
      const token = await tokenStorage.getToken();
      console.log('[Auth] Retrieved token for sign out, has token:', !!token);
      
      if (token && API_URL) {
        console.log('[Auth] Calling backend sign-out endpoint...');
        try {
          const response = await fetch(`${API_URL}/api/auth/sign-out`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({}),
          });
          
          console.log('[Auth] Backend sign-out response status:', response.status);
          
          if (response.ok) {
            const data = await response.json();
            console.log('[Auth] Backend sign-out successful:', data);
          } else {
            const errorText = await response.text();
            console.warn('[Auth] Backend sign-out failed:', response.status, errorText);
          }
        } catch (fetchError) {
          console.error('[Auth] Backend sign-out request failed:', fetchError);
          // Continue with local sign-out even if backend call fails
        }
      } else {
        console.log('[Auth] No token or API URL, skipping backend call');
      }
    } catch (error) {
      console.error('[Auth] Sign out error:', error);
      // Don't throw - we still want to clear local state
    } finally {
      // ALWAYS clear local state, even if backend call fails
      console.log('[Auth] Clearing local token and user state...');
      try {
        await tokenStorage.removeToken();
        console.log('[Auth] Token removed successfully');
      } catch (tokenError) {
        console.error('[Auth] Failed to remove token:', tokenError);
      }
      
      // Clear biometric credentials on sign out
      try {
        console.log('[Auth] Clearing biometric credentials...');
        await clearBiometricCredentials();
        console.log('[Auth] Biometric credentials cleared');
      } catch (bioError) {
        console.error('[Auth] Failed to clear biometric credentials:', bioError);
      }
      
      // Set user to null - this triggers the routing logic to redirect to auth
      setUser(null);
      console.log('[Auth] User state cleared - user is now logged out');
      console.log('[Auth] ========== SIGN OUT COMPLETED ==========');
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

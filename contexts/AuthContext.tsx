
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Platform-specific token storage
const tokenStorage = {
  async getToken(): Promise<string | null> {
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
          return localStorage.getItem(TOKEN_KEY);
        }
        return null;
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
        if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
          localStorage.setItem(TOKEN_KEY, token);
        }
      } else {
        await SecureStore.setItemAsync(TOKEN_KEY, token);
      }
      console.log('[Auth] Token stored successfully');
    } catch (error) {
      console.error('[Auth] Error storing token:', error);
    }
  },
  
  async removeToken(): Promise<void> {
    try {
      console.log('[Auth] Removing token from storage');
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
          localStorage.removeItem(TOKEN_KEY);
        }
      } else {
        await SecureStore.deleteItemAsync(TOKEN_KEY);
      }
      console.log('[Auth] Token removed successfully');
    } catch (error) {
      console.error('[Auth] Error removing token:', error);
    }
  },
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Check for existing session on mount
  useEffect(() => {
    // Only run on client-side (not during SSR)
    if (Platform.OS === 'web' && typeof window === 'undefined') {
      console.log('[Auth] Skipping auth check during SSR');
      setLoading(false);
      return;
    }

    checkAuth();
    
    // Safety timeout - if auth check takes too long, stop loading
    const timeout = setTimeout(() => {
      if (loading) {
        console.warn('[Auth] Auth check timeout - stopping loading state');
        setLoading(false);
      }
    }, 5000); // 5 second timeout (reduced from 10)
    
    return () => clearTimeout(timeout);
  }, []);

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
      
      // Add timeout for fetch request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
      
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
          console.warn('[Auth] Auth check timed out');
        } else {
          console.error('[Auth] Fetch error:', fetchError);
        }
        
        // Don't clear token on network errors - might be temporary
        if (fetchError instanceof TypeError && fetchError.message.includes('Network')) {
          console.warn('[Auth] Network error during auth check, keeping token');
        } else {
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
      console.log('[Auth] Sign in response received, full data:', JSON.stringify(data));
      console.log('[Auth] User:', data.user?.email);
      console.log('[Auth] Session object:', JSON.stringify(data.session));
      console.log('[Auth] Session data:', { 
        hasSession: !!data.session, 
        hasToken: !!data.session?.token,
        tokenLength: data.session?.token?.length 
      });

      if (!data.session || !data.session.token) {
        console.error('[Auth] Missing session or token. Full response:', JSON.stringify(data));
        throw new Error('No session token received from server');
      }

      await tokenStorage.setToken(data.session.token);
      setUser(data.user);
      console.log('[Auth] Sign in successful, user state updated');
    } catch (error: any) {
      console.error('[Auth] Sign in failed:', {
        message: error?.message,
        name: error?.name,
        stack: error?.stack,
        error: error
      });
      
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
      console.log('[Auth] Sign up response received, full data:', JSON.stringify(data));
      console.log('[Auth] User:', data.user?.email);
      console.log('[Auth] Session object:', JSON.stringify(data.session));

      if (!data.session || !data.session.token) {
        console.error('[Auth] Missing session or token. Full response:', JSON.stringify(data));
        throw new Error('No session token received from server');
      }

      await tokenStorage.setToken(data.session.token);
      setUser(data.user);
      console.log('[Auth] Sign up successful');
    } catch (error: any) {
      console.error('[Auth] Sign up failed:', {
        message: error?.message,
        name: error?.name,
        error: error
      });
      
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
      console.log('[Auth] Apple user data:', JSON.stringify(appleUser));
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
      console.log('[Auth] Request body:', JSON.stringify(requestBody));

      const url = `${API_URL}/api/auth/sign-in/apple`;
      console.log('[Auth] Full request URL:', url);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      console.log('[Auth] Apple sign in response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Auth] Apple sign in failed. Status:', response.status, 'Response:', errorText);
        
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch (e) {
          throw new Error(`Apple sign in failed with status ${response.status}: ${errorText}`);
        }
        
        throw new Error(errorData.error || 'Apple sign in failed');
      }

      const data = await response.json();
      console.log('[Auth] Apple sign in response received, full data:', JSON.stringify(data));
      console.log('[Auth] Session object:', JSON.stringify(data.session));
      console.log('[Auth] Is new user:', data.isNewUser);

      if (!data.session || !data.session.token) {
        console.error('[Auth] Missing session or token. Full response:', JSON.stringify(data));
        throw new Error('No session token received from server');
      }

      await tokenStorage.setToken(data.session.token);
      setUser(data.user);
      console.log('[Auth] Apple sign in successful, user:', data.user.email);
    } catch (error: any) {
      console.error('[Auth] Apple sign in failed:', {
        message: error?.message,
        name: error?.name,
        stack: error?.stack,
        error: error
      });
      
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

      console.log('[Auth] Clearing local token and user state...');
      await tokenStorage.removeToken();
      setUser(null);
      console.log('[Auth] ========== SIGN OUT COMPLETED ==========');
    } catch (error) {
      console.error('[Auth] Sign out error:', error);
      // Still clear local state even if there's an error
      try {
        await tokenStorage.removeToken();
        setUser(null);
        console.log('[Auth] Local state cleared despite error');
      } catch (clearError) {
        console.error('[Auth] Failed to clear local state:', clearError);
      }
      throw error;
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

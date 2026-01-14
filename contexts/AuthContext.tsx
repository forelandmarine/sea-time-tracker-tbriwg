
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
    if (Platform.OS === 'web') {
      return localStorage.getItem(TOKEN_KEY);
    }
    return await SecureStore.getItemAsync(TOKEN_KEY);
  },
  
  async setToken(token: string): Promise<void> {
    console.log('[Auth] Storing token, length:', token?.length);
    if (Platform.OS === 'web') {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      await SecureStore.setItemAsync(TOKEN_KEY, token);
    }
    console.log('[Auth] Token stored successfully');
  },
  
  async removeToken(): Promise<void> {
    if (Platform.OS === 'web') {
      localStorage.removeItem(TOKEN_KEY);
    } else {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    }
  },
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Check for existing session on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      console.log('[Auth] Checking authentication status...');
      const token = await tokenStorage.getToken();
      
      if (!token) {
        console.log('[Auth] No token found');
        setLoading(false);
        return;
      }

      console.log('[Auth] Token found, verifying with backend...');
      // Verify token with backend
      const response = await fetch(`${API_URL}/api/auth/user`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log('[Auth] User authenticated:', data.user.email);
        setUser(data.user);
      } else {
        console.log('[Auth] Token invalid, clearing... Status:', response.status);
        await tokenStorage.removeToken();
        setUser(null);
      }
    } catch (error) {
      console.error('[Auth] Check auth failed:', error);
      await tokenStorage.removeToken();
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      console.log('[Auth] Signing in:', email);
      console.log('[Auth] API URL:', API_URL);
      
      const response = await fetch(`${API_URL}/api/auth/sign-in/email`, {
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
      throw error;
    }
  };

  const signUp = async (email: string, password: string, name?: string) => {
    try {
      console.log('[Auth] Signing up:', email);
      const response = await fetch(`${API_URL}/api/auth/sign-up/email`, {
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
      throw error;
    }
  };

  const signInWithApple = async (identityToken: string, appleUser?: any) => {
    try {
      console.log('[Auth] Signing in with Apple');
      const response = await fetch(`${API_URL}/api/auth/sign-in/apple`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          identityToken,
          user: appleUser,
        }),
      });

      console.log('[Auth] Apple sign in response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('[Auth] Apple sign in failed with error:', errorData);
        throw new Error(errorData.error || 'Apple sign in failed');
      }

      const data = await response.json();
      console.log('[Auth] Apple sign in response received, full data:', JSON.stringify(data));
      console.log('[Auth] Session object:', JSON.stringify(data.session));

      if (!data.session || !data.session.token) {
        console.error('[Auth] Missing session or token. Full response:', JSON.stringify(data));
        throw new Error('No session token received from server');
      }

      await tokenStorage.setToken(data.session.token);
      setUser(data.user);
      console.log('[Auth] Apple sign in successful');
    } catch (error: any) {
      console.error('[Auth] Apple sign in failed:', {
        message: error?.message,
        name: error?.name,
        error: error
      });
      throw error;
    }
  };

  const signOut = async () => {
    try {
      console.log('[Auth] Signing out');
      const token = await tokenStorage.getToken();
      
      if (token) {
        // Call logout endpoint (optional - for token invalidation)
        await fetch(`${API_URL}/api/auth/sign-out`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({}),
        });
      }

      await tokenStorage.removeToken();
      setUser(null);
      console.log('[Auth] Sign out successful');
    } catch (error) {
      console.error('[Auth] Sign out failed:', error);
      // Still clear local state even if API call fails
      await tokenStorage.removeToken();
      setUser(null);
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


import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Platform, InteractionManager } from 'react-native';
import { BACKEND_URL } from '@/utils/api';
import { clearBiometricCredentials } from '@/utils/biometricAuth';

const TOKEN_KEY = 'seatime_auth_token';

// Reasonable timeouts
const API_TIMEOUT = 15000; // 15 seconds for API calls

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

// Token storage with deferred SecureStore loading to prevent early TurboModule initialization
const tokenStorage = {
  async getToken(): Promise<string | null> {
    try {
      if (Platform.OS === 'web') {
        return localStorage.getItem(TOKEN_KEY);
      }
      
      // CRITICAL: Dynamically import SecureStore to prevent module-scope initialization
      // This prevents TurboModule crashes during startup
      console.log('[Auth] Dynamically loading expo-secure-store for token retrieval...');
      const SecureStore = await import('expo-secure-store');
      return await SecureStore.getItemAsync(TOKEN_KEY);
    } catch (error) {
      console.error('[Auth] Error getting token:', error);
      return null;
    }
  },
  
  async setToken(token: string): Promise<void> {
    if (!token) throw new Error('Invalid token');
    
    try {
      if (Platform.OS === 'web') {
        localStorage.setItem(TOKEN_KEY, token);
        return;
      }
      
      // CRITICAL: Dynamically import SecureStore
      console.log('[Auth] Dynamically loading expo-secure-store for token storage...');
      const SecureStore = await import('expo-secure-store');
      await SecureStore.setItemAsync(TOKEN_KEY, token);
    } catch (error) {
      console.error('[Auth] Error storing token:', error);
      throw error;
    }
  },
  
  async removeToken(): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        localStorage.removeItem(TOKEN_KEY);
        return;
      }
      
      // CRITICAL: Dynamically import SecureStore
      console.log('[Auth] Dynamically loading expo-secure-store for token removal...');
      const SecureStore = await import('expo-secure-store');
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    } catch (error) {
      console.error('[Auth] Error removing token:', error);
      // Don't throw - we want sign out to always succeed locally
    }
  },
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const triggerRefresh = useCallback(() => {
    console.log('[Auth] Global refresh triggered');
    setRefreshTrigger(prev => prev + 1);
  }, []);

  const checkAuth = useCallback(async () => {
    if (loading) {
      console.log('[Auth] Already checking auth, skipping');
      return;
    }

    setLoading(true);
    
    try {
      if (!BACKEND_URL) {
        console.log('[Auth] No backend URL configured');
        setUser(null);
        return;
      }

      // CRITICAL: Wait for all interactions to complete before accessing SecureStore
      // This ensures the TurboModule bridge is fully initialized
      await new Promise<void>((resolve) => {
        InteractionManager.runAfterInteractions(() => {
          console.log('[Auth] Interactions complete, safe to access SecureStore');
          resolve();
        });
      });

      const token = await tokenStorage.getToken();
      
      if (!token) {
        console.log('[Auth] No token found');
        setUser(null);
        return;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);
      
      try {
        const response = await fetch(`${BACKEND_URL}/api/auth/user`, {
          headers: { 'Authorization': `Bearer ${token}` },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          console.log('[Auth] User authenticated:', data.user.email);
          setUser(data.user);
        } else {
          console.log('[Auth] Token invalid, clearing');
          await tokenStorage.removeToken();
          setUser(null);
        }
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        
        // Keep token on network errors
        if (!(fetchError instanceof TypeError && fetchError.message.includes('Network'))) {
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
  }, [loading]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (loading) {
      throw new Error('Authentication in progress');
    }

    if (!BACKEND_URL) {
      throw new Error('Backend not configured');
    }

    setLoading(true);
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);
      
      const response = await fetch(`${BACKEND_URL}/api/auth/sign-in/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          throw new Error(`Login failed: ${errorText || response.statusText}`);
        }
        throw new Error(errorData.error || errorData.message || 'Login failed');
      }

      const data = await response.json();

      if (!data.session?.token) {
        throw new Error('No session token received');
      }

      // CRITICAL: Wait for interactions before storing token
      await new Promise<void>((resolve) => {
        InteractionManager.runAfterInteractions(() => {
          console.log('[Auth] Safe to store token after sign in');
          resolve();
        });
      });

      // Store token and set user atomically
      await tokenStorage.setToken(data.session.token);
      setUser(data.user);
      
      console.log('[Auth] Sign in successful:', data.user.email);
    } catch (error: any) {
      console.error('[Auth] Sign in failed:', error);
      
      if (error.name === 'AbortError') {
        throw new Error('Request timed out. Please try again.');
      }
      
      if (error.message?.includes('Network') || error.name === 'TypeError') {
        throw new Error('Cannot connect to server. Check your connection.');
      }
      
      throw error;
    } finally {
      setLoading(false);
    }
  }, [loading]);

  const signUp = useCallback(async (email: string, password: string, name?: string) => {
    if (loading) {
      throw new Error('Authentication in progress');
    }

    if (!BACKEND_URL) {
      throw new Error('Backend not configured');
    }

    setLoading(true);
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);
      
      const response = await fetch(`${BACKEND_URL}/api/auth/sign-up/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name: name || 'User' }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          throw new Error(`Registration failed: ${errorText}`);
        }
        throw new Error(errorData.error || 'Registration failed');
      }

      const data = await response.json();

      if (!data.session?.token) {
        throw new Error('No session token received');
      }

      // CRITICAL: Wait for interactions before storing token
      await new Promise<void>((resolve) => {
        InteractionManager.runAfterInteractions(() => {
          console.log('[Auth] Safe to store token after sign up');
          resolve();
        });
      });

      await tokenStorage.setToken(data.session.token);
      setUser(data.user);
      
      console.log('[Auth] Sign up successful:', data.user.email);
    } catch (error: any) {
      console.error('[Auth] Sign up failed:', error);
      
      if (error.name === 'AbortError') {
        throw new Error('Request timed out. Please try again.');
      }
      
      if (error.message?.includes('Network') || error.name === 'TypeError') {
        throw new Error('Cannot connect to server. Check your connection.');
      }
      
      throw error;
    } finally {
      setLoading(false);
    }
  }, [loading]);

  const signInWithApple = useCallback(async (identityToken: string, appleUser?: any) => {
    if (loading) {
      throw new Error('Authentication in progress');
    }

    if (!identityToken) {
      throw new Error('Invalid identity token');
    }

    if (!BACKEND_URL) {
      throw new Error('Backend not configured');
    }

    setLoading(true);
    
    try {
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

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

      const response = await fetch(`${BACKEND_URL}/api/auth/sign-in/apple`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          throw new Error(`Apple sign in failed: ${errorText}`);
        }
        throw new Error(errorData.error || 'Apple sign in failed');
      }

      const data = await response.json();

      if (!data.session?.token) {
        throw new Error('No session token received');
      }

      // CRITICAL: Wait for interactions before storing token
      await new Promise<void>((resolve) => {
        InteractionManager.runAfterInteractions(() => {
          console.log('[Auth] Safe to store token after Apple sign in');
          resolve();
        });
      });

      await tokenStorage.setToken(data.session.token);
      setUser(data.user);
      
      console.log('[Auth] Apple sign in successful:', data.user.email);
    } catch (error: any) {
      console.error('[Auth] Apple sign in failed:', error);
      
      if (error.name === 'AbortError') {
        throw new Error('Request timed out. Please try again.');
      }
      
      if (error.message?.includes('Network') || error.name === 'TypeError') {
        throw new Error('Cannot connect to server. Check your connection.');
      }
      
      throw error;
    } finally {
      setLoading(false);
    }
  }, [loading]);

  const signOut = useCallback(async () => {
    console.log('[Auth] Sign out started');
    
    // Clear local state immediately - don't wait for backend
    setUser(null);
    setLoading(false);
    
    try {
      const token = await tokenStorage.getToken();
      
      // Fire-and-forget backend call
      if (token && BACKEND_URL) {
        fetch(`${BACKEND_URL}/api/auth/sign-out`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        }).catch(() => {
          // Ignore backend errors
        });
      }
      
      // Clean up local storage
      await tokenStorage.removeToken();
      await clearBiometricCredentials();
      
      console.log('[Auth] Sign out complete');
    } catch (error) {
      console.error('[Auth] Sign out cleanup error (ignored):', error);
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

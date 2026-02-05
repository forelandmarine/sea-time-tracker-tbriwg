
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { authenticatedGet, authenticatedPatch } from '@/utils/api';

interface SubscriptionStatus {
  status: 'active' | 'inactive';
  expiresAt: string | null;
  productId: string | null;
}

interface SubscriptionContextType {
  subscriptionStatus: SubscriptionStatus | null;
  loading: boolean;
  hasActiveSubscription: boolean;
  checkSubscription: () => Promise<void>;
  pauseTracking: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const { user, isAuthenticated } = useAuth();

  const hasActiveSubscription = subscriptionStatus?.status === 'active';

  useEffect(() => {
    if (isAuthenticated && user) {
      console.log('[Subscription] User authenticated, checking subscription status');
      checkSubscription();
    } else {
      console.log('[Subscription] User not authenticated, clearing subscription status');
      setSubscriptionStatus(null);
      setLoading(false);
    }
  }, [isAuthenticated, user]);

  const checkSubscription = async () => {
    try {
      console.log('[Subscription] Fetching subscription status from backend');
      setLoading(true);

      // Add timeout to prevent blocking app startup
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout

      const data = await authenticatedGet<SubscriptionStatus>('/api/subscription/status', {
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      console.log('[Subscription] Subscription status:', data.status);
      setSubscriptionStatus(data);
    } catch (error: any) {
      console.error('[Subscription] Error checking subscription:', error);
      
      if (error.name === 'AbortError') {
        console.warn('[Subscription] Subscription check timed out, defaulting to inactive');
      } else if (error.message?.includes('401')) {
        console.log('[Subscription] User not authenticated, setting to inactive');
      } else {
        console.warn('[Subscription] Defaulting to inactive due to error');
      }
      
      // Always set a default status to prevent blocking
      setSubscriptionStatus({ status: 'inactive', expiresAt: null, productId: null });
    } finally {
      setLoading(false);
    }
  };

  const pauseTracking = async () => {
    try {
      console.log('[Subscription] Pausing tracking for inactive subscription');

      const response = await authenticatedPatch<{ success: boolean; vesselsDeactivated: number }>(
        '/api/subscription/pause-tracking',
        {}
      );

      console.log('[Subscription] Tracking paused, vessels deactivated:', response.vesselsDeactivated);
      return response;
    } catch (error: any) {
      console.error('[Subscription] Error pausing tracking:', error);
      throw new Error(error.message || 'Failed to pause tracking');
    }
  };

  return (
    <SubscriptionContext.Provider
      value={{
        subscriptionStatus,
        loading,
        hasActiveSubscription,
        checkSubscription,
        pauseTracking,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscription must be used within SubscriptionProvider');
  }
  return context;
}

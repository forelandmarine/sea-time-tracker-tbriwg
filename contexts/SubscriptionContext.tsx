
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
      console.log('[Subscription] User subscription_status:', user.subscription_status);
      console.log('[Subscription] User subscription_expires_at:', user.subscription_expires_at);
      console.log('[Subscription] User subscription_product_id:', user.subscription_product_id);
      
      // If user object already has subscription status, use it immediately
      if (user.subscription_status) {
        console.log('[Subscription] ✅ Using subscription status from user object:', user.subscription_status);
        setSubscriptionStatus({
          status: user.subscription_status,
          expiresAt: user.subscription_expires_at || null,
          productId: user.subscription_product_id || null,
        });
        setLoading(false);
        
        // Still check backend for latest status in background (optional - can be removed for performance)
        // This ensures we have the most up-to-date subscription status
        console.log('[Subscription] Fetching latest subscription status from backend in background...');
        checkSubscription();
      } else {
        // No subscription status in user object, fetch from backend
        console.log('[Subscription] ⚠️ No subscription status in user object, fetching from backend');
        checkSubscription();
      }
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

      const data = await authenticatedGet<SubscriptionStatus>('/api/subscription/status');
      console.log('[Subscription] Subscription status:', data.status);
      
      // If subscription is inactive, automatically pause tracking
      if (data.status === 'inactive') {
        console.log('[Subscription] Subscription inactive, pausing tracking');
        try {
          await pauseTracking();
        } catch (pauseError) {
          console.error('[Subscription] Failed to pause tracking:', pauseError);
          // Continue even if pause fails - user still needs to see paywall
        }
      }
      
      setSubscriptionStatus(data);
    } catch (error: any) {
      console.error('[Subscription] Error checking subscription:', error);
      
      if (error.message?.includes('401')) {
        console.log('[Subscription] User not authenticated, setting to inactive');
        setSubscriptionStatus({ status: 'inactive', expiresAt: null, productId: null });
      } else {
        console.warn('[Subscription] Defaulting to inactive due to error');
        setSubscriptionStatus({ status: 'inactive', expiresAt: null, productId: null });
      }
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

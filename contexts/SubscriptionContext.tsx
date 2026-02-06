
import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { useAuth } from './AuthContext';
import { authenticatedGet, authenticatedPatch } from '@/utils/api';

// CRITICAL: Subscription check timeout - very short to prevent blocking
const SUBSCRIPTION_CHECK_TIMEOUT = 1500; // 1.5 seconds max

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
  const [loading, setLoading] = useState(false); // CRITICAL: Start as false to not block
  const { user, isAuthenticated } = useAuth();
  const checkInProgress = useRef(false);

  const hasActiveSubscription = subscriptionStatus?.status === 'active';

  useEffect(() => {
    if (isAuthenticated && user) {
      console.log('[Subscription] User authenticated, checking subscription (non-blocking)');
      
      // CRITICAL: Don't await - run in background
      checkSubscription().catch((error) => {
        console.error('[Subscription] Background check failed (ignored):', error);
      });
    } else {
      console.log('[Subscription] User not authenticated, clearing status');
      setSubscriptionStatus(null);
      setLoading(false);
    }
  }, [isAuthenticated, user]);

  const checkSubscription = async () => {
    // Prevent concurrent checks
    if (checkInProgress.current) {
      console.log('[Subscription] Check already in progress, skipping');
      return;
    }

    checkInProgress.current = true;
    
    try {
      console.log('[Subscription] Fetching subscription status');
      setLoading(true);

      // CRITICAL: Aggressive timeout with AbortController
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.warn('[Subscription] Check timeout, aborting...');
        controller.abort();
      }, SUBSCRIPTION_CHECK_TIMEOUT);

      const data = await authenticatedGet<SubscriptionStatus>('/api/subscription/status', {
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      console.log('[Subscription] Status:', data.status);
      setSubscriptionStatus(data);
    } catch (error: any) {
      console.error('[Subscription] Check error:', error.message);
      
      if (error.name === 'AbortError') {
        console.warn('[Subscription] Check timed out, defaulting to inactive');
      }
      
      // CRITICAL: Always set a default status to prevent blocking
      setSubscriptionStatus({ status: 'inactive', expiresAt: null, productId: null });
    } finally {
      setLoading(false);
      checkInProgress.current = false;
    }
  };

  const pauseTracking = async () => {
    try {
      console.log('[Subscription] Pausing tracking');

      const response = await authenticatedPatch<{ success: boolean; vesselsDeactivated: number }>(
        '/api/subscription/pause-tracking',
        {}
      );

      console.log('[Subscription] Tracking paused, vessels deactivated:', response.vesselsDeactivated);
      return response;
    } catch (error: any) {
      console.error('[Subscription] Pause tracking error:', error);
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

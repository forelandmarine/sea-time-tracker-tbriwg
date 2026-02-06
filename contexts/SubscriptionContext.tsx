
import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { Platform } from 'react-native';
import { useAuth } from './AuthContext';
import { authenticatedGet } from '@/utils/api';

// CRITICAL: Aggressive timeout to prevent blocking
const SUBSCRIPTION_CHECK_TIMEOUT = 1500; // 1.5 seconds max

interface SubscriptionStatus {
  status: 'active' | 'inactive' | 'pending';
  expiresAt: string | null;
  productId: string | null;
}

interface SubscriptionContextType {
  subscriptionStatus: SubscriptionStatus;
  loading: boolean;
  checkSubscription: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus>({
    status: 'inactive',
    expiresAt: null,
    productId: null,
  });
  
  // CRITICAL: Start with loading=false to never block startup
  const [loading, setLoading] = useState(false);
  
  // CRITICAL: Prevent concurrent checks
  const checkInProgress = useRef(false);

  const checkSubscription = useCallback(async () => {
    // Prevent concurrent checks
    if (checkInProgress.current) {
      console.log('[Subscription] Check already in progress, skipping');
      return;
    }

    checkInProgress.current = true;
    setLoading(true);

    try {
      console.log('[Subscription] Checking subscription status...');
      
      // CRITICAL: Aggressive timeout with AbortController
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.warn('[Subscription] Check timeout, aborting...');
        controller.abort();
      }, SUBSCRIPTION_CHECK_TIMEOUT);

      try {
        const response = await authenticatedGet<{ subscription: SubscriptionStatus }>(
          '/api/subscription',
          { signal: controller.signal }
        );

        clearTimeout(timeoutId);

        console.log('[Subscription] ✅ Status received:', response.subscription.status);
        setSubscriptionStatus(response.subscription);
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        
        if (fetchError.name === 'AbortError') {
          console.warn('[Subscription] Check aborted due to timeout');
        } else {
          console.error('[Subscription] Check error:', fetchError.message);
        }
        
        // Default to inactive on error
        setSubscriptionStatus({
          status: 'inactive',
          expiresAt: null,
          productId: null,
        });
      }
    } catch (error) {
      console.error('[Subscription] Check failed:', error);
      setSubscriptionStatus({
        status: 'inactive',
        expiresAt: null,
        productId: null,
      });
    } finally {
      setLoading(false);
      checkInProgress.current = false;
    }
  }, []);

  // CRITICAL: Only check subscription AFTER user is authenticated
  // Use a delay to ensure app is stable
  useEffect(() => {
    if (!isAuthenticated) {
      console.log('[Subscription] User not authenticated, skipping check');
      setSubscriptionStatus({
        status: 'inactive',
        expiresAt: null,
        productId: null,
      });
      return;
    }

    console.log('[Subscription] User authenticated, scheduling subscription check...');
    
    // CRITICAL: Delay subscription check to not block startup
    const checkTimer = setTimeout(() => {
      checkSubscription();
    }, 2000); // 2 second delay

    return () => {
      clearTimeout(checkTimer);
    };
  }, [isAuthenticated, checkSubscription]);

  return (
    <SubscriptionContext.Provider
      value={{
        subscriptionStatus,
        loading,
        checkSubscription,
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

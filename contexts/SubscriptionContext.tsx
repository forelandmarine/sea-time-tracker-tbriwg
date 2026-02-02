
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { authenticatedGet, authenticatedPost, authenticatedPatch } from '@/utils/api';

interface SubscriptionStatus {
  status: 'active' | 'inactive' | 'trial';
  expiresAt: string | null;
  productId: string | null;
}

interface VerifyReceiptResponse {
  success: boolean;
  status: 'active' | 'inactive' | 'trial';
  expiresAt: string | null;
}

interface SubscriptionContextType {
  subscriptionStatus: SubscriptionStatus | null;
  loading: boolean;
  hasActiveSubscription: boolean;
  checkSubscription: () => Promise<void>;
  verifyReceipt: (receiptData: string, productId: string, isSandbox?: boolean) => Promise<VerifyReceiptResponse>;
  pauseTracking: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const { user, isAuthenticated } = useAuth();

  const hasActiveSubscription = subscriptionStatus?.status === 'active' || subscriptionStatus?.status === 'trial';

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

      const data = await authenticatedGet<SubscriptionStatus>('/api/subscription/status');
      console.log('[Subscription] Subscription status:', data.status);
      setSubscriptionStatus(data);
    } catch (error: any) {
      console.error('[Subscription] Error checking subscription:', error);
      
      // If user is not authenticated (401), set to inactive
      if (error.message?.includes('401')) {
        console.log('[Subscription] User not authenticated, setting to inactive');
        setSubscriptionStatus({ status: 'inactive', expiresAt: null, productId: null });
      } else {
        // For other errors, default to inactive
        console.warn('[Subscription] Defaulting to inactive due to error');
        setSubscriptionStatus({ status: 'inactive', expiresAt: null, productId: null });
      }
    } finally {
      setLoading(false);
    }
  };

  const verifyReceipt = async (
    receiptData: string, 
    productId: string, 
    isSandbox: boolean = true
  ): Promise<VerifyReceiptResponse> => {
    try {
      console.log('[Subscription] Verifying iOS App Store receipt');
      console.log('[Subscription] Product ID:', productId);
      console.log('[Subscription] Sandbox mode:', isSandbox);

      const response = await authenticatedPost<VerifyReceiptResponse>('/api/subscription/verify', {
        receiptData,
        productId,
        isSandbox,
      });

      console.log('[Subscription] Receipt verification successful:', response.status);
      
      // Update local subscription status
      setSubscriptionStatus({
        status: response.status,
        expiresAt: response.expiresAt,
        productId,
      });

      return response;
    } catch (error: any) {
      console.error('[Subscription] Receipt verification failed:', error);
      throw new Error(error.message || 'Failed to verify receipt');
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
        verifyReceipt,
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

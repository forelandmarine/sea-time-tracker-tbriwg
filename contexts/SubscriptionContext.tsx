
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
      console.log('[Subscription] ========== SUBSCRIPTION CHECK ==========');
      console.log('[Subscription] User authenticated:', user.email);
      console.log('[Subscription] User ID:', user.id);
      console.log('[Subscription] User subscription_status:', user.subscription_status);
      console.log('[Subscription] User subscription_expires_at:', user.subscription_expires_at);
      console.log('[Subscription] User subscription_product_id:', user.subscription_product_id);
      console.log('[Subscription] ==========================================');
      
      // If user object already has subscription status, use it immediately
      if (user.subscription_status) {
        console.log('[Subscription] ✅ Using subscription status from user object:', user.subscription_status);
        const statusFromUser: SubscriptionStatus = {
          status: user.subscription_status,
          expiresAt: user.subscription_expires_at || null,
          productId: user.subscription_product_id || null,
        };
        
        setSubscriptionStatus(statusFromUser);
        setLoading(false);
        
        console.log('[Subscription] Subscription status set:', {
          status: statusFromUser.status,
          expiresAt: statusFromUser.expiresAt,
          productId: statusFromUser.productId,
          hasActiveSubscription: statusFromUser.status === 'active',
        });
        
        // If subscription is inactive, automatically pause tracking
        if (user.subscription_status === 'inactive') {
          console.log('[Subscription] ⚠️ Subscription inactive from user object, pausing tracking');
          pauseTracking().catch((pauseError) => {
            console.error('[Subscription] Failed to pause tracking:', pauseError);
          });
        } else {
          console.log('[Subscription] ✅ Subscription is ACTIVE - user has full access');
        }
        
        // Optionally verify with backend in background (non-blocking)
        // This ensures we have the most up-to-date subscription status
        // but doesn't block the UI or cause paywall flicker
        console.log('[Subscription] Verifying subscription status with backend in background...');
        checkSubscription().catch((error) => {
          console.error('[Subscription] Background subscription check failed:', error);
          // Don't update state on error - keep using the user object status
        });
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
  }, [isAuthenticated, user?.id, user?.subscription_status]); // Only re-run if user ID or subscription_status changes

  const checkSubscription = async () => {
    try {
      console.log('[Subscription] Fetching subscription status from backend');
      
      // Don't set loading to true if we already have a status from the user object
      // This prevents UI flicker
      if (!subscriptionStatus) {
        setLoading(true);
      }

      const data = await authenticatedGet<SubscriptionStatus>('/api/subscription/status');
      console.log('[Subscription] Backend subscription status:', data.status);
      console.log('[Subscription] Backend subscription expiresAt:', data.expiresAt);
      console.log('[Subscription] Backend subscription productId:', data.productId);
      
      // Only update if the status actually changed
      if (!subscriptionStatus || subscriptionStatus.status !== data.status) {
        console.log('[Subscription] Subscription status changed, updating state');
        setSubscriptionStatus(data);
        
        // If subscription is inactive, automatically pause tracking
        if (data.status === 'inactive') {
          console.log('[Subscription] Subscription inactive from backend, pausing tracking');
          try {
            await pauseTracking();
          } catch (pauseError) {
            console.error('[Subscription] Failed to pause tracking:', pauseError);
            // Continue even if pause fails - user still needs to see paywall
          }
        }
      } else {
        console.log('[Subscription] Subscription status unchanged, keeping current state');
      }
    } catch (error: any) {
      console.error('[Subscription] Error checking subscription:', error);
      
      if (error.message?.includes('401')) {
        console.log('[Subscription] User not authenticated, setting to inactive');
        setSubscriptionStatus({ status: 'inactive', expiresAt: null, productId: null });
      } else {
        console.warn('[Subscription] Error fetching subscription, keeping current state or defaulting to inactive');
        // Only set to inactive if we don't already have a status
        if (!subscriptionStatus) {
          setSubscriptionStatus({ status: 'inactive', expiresAt: null, productId: null });
        }
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


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
    console.log('[Subscription] ⚠️ BREADCRUMB: checkSubscription called');
    
    // Prevent concurrent checks
    if (checkInProgress.current) {
      console.log('[Subscription] Check already in progress, skipping');
      return;
    }

    checkInProgress.current = true;
    setLoading(true);

    try {
      console.log('[Subscription] Checking subscription status...');
      console.log('[Subscription] Platform:', Platform.OS);
      
      // CRITICAL: Aggressive timeout with AbortController
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.warn('[Subscription] Check timeout after', SUBSCRIPTION_CHECK_TIMEOUT, 'ms, aborting...');
        controller.abort();
      }, SUBSCRIPTION_CHECK_TIMEOUT);

      try {
        console.log('[Subscription] ⚠️ BREADCRUMB: About to call authenticatedGet /api/subscription/status');
        const response = await authenticatedGet<SubscriptionStatus>(
          '/api/subscription/status',
          { signal: controller.signal }
        );

        clearTimeout(timeoutId);

        console.log('[Subscription] ✅ API call completed');
        console.log('[Subscription] Response:', response);

        // CRITICAL: Validate response structure before using it
        if (!response || typeof response !== 'object') {
          console.error('[Subscription] ❌ VALIDATION FAILED: Invalid response type:', typeof response);
          throw new Error('Invalid response from subscription API');
        }

        // Validate status field
        const status = response.status;
        if (status !== 'active' && status !== 'inactive' && status !== 'pending') {
          console.warn('[Subscription] ⚠️ Invalid status value:', status, '- defaulting to inactive');
          response.status = 'inactive';
        }

        // Validate expiresAt field
        if (response.expiresAt !== null && typeof response.expiresAt !== 'string') {
          console.warn('[Subscription] ⚠️ Invalid expiresAt type:', typeof response.expiresAt, '- setting to null');
          response.expiresAt = null;
        }

        // Validate productId field
        if (response.productId !== null && typeof response.productId !== 'string') {
          console.warn('[Subscription] ⚠️ Invalid productId type:', typeof response.productId, '- setting to null');
          response.productId = null;
        }

        console.log('[Subscription] ✅ Status validated and received:', response.status);
        setSubscriptionStatus(response);
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        
        if (fetchError.name === 'AbortError') {
          console.warn('[Subscription] Check aborted due to timeout');
        } else {
          console.error('[Subscription] Check error:', fetchError.message);
          console.error('[Subscription] Error name:', fetchError.name);
        }
        
        // 🚨 CRITICAL: Default to inactive on error - NEVER block the app
        console.log('[Subscription] ⚠️ Defaulting to inactive status due to error');
        setSubscriptionStatus({
          status: 'inactive',
          expiresAt: null,
          productId: null,
        });
      }
    } catch (error: any) {
      console.error('[Subscription] Check failed:', error);
      console.error('[Subscription] Error details:', error.message, error.name);
      
      // 🚨 CRITICAL: Default to inactive on error - NEVER block the app
      setSubscriptionStatus({
        status: 'inactive',
        expiresAt: null,
        productId: null,
      });
    } finally {
      setLoading(false);
      checkInProgress.current = false;
      console.log('[Subscription] Check completed');
    }
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // 🚨 CRITICAL: NON-BLOCKING SUBSCRIPTION CHECK
  // ═══════════════════════════════════════════════════════════════════════════
  // Subscription check should NEVER block authentication or app startup
  // If it fails, the app continues with 'inactive' status
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    console.log('[Subscription] ⚠️ BREADCRUMB: useEffect triggered');
    console.log('[Subscription] isAuthenticated:', isAuthenticated);
    
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
    console.log('[Subscription] ⚠️ This check is NON-BLOCKING - app will continue even if it fails');
    
    // CRITICAL: Delay subscription check to not block startup
    const checkTimer = setTimeout(() => {
      console.log('[Subscription] Executing delayed subscription check (after 2 seconds)');
      checkSubscription().catch((error) => {
        console.error('[Subscription] Subscription check failed (non-blocking):', error);
        // Error is already handled in checkSubscription, just log here
      });
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

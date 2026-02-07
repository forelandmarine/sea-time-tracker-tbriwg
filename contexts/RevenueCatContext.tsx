
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Platform } from 'react-native';
import Purchases, {
  CustomerInfo,
  PurchasesOffering,
  PurchasesPackage,
  LOG_LEVEL,
} from 'react-native-purchases';
import { useAuth } from './AuthContext';
import { authenticatedPost, authenticatedGet } from '@/utils/api';
import { REVENUECAT_CONFIG, validateRevenueCatConfig } from '@/config/revenuecat';

interface SubscriptionStatus {
  status: 'active' | 'inactive' | 'trial' | 'expired';
  expiresAt: string | null;
  productId: string | null;
  isTrialActive: boolean;
}

interface RevenueCatContextType {
  // Subscription status
  subscriptionStatus: SubscriptionStatus;
  loading: boolean;
  
  // RevenueCat data
  customerInfo: CustomerInfo | null;
  offerings: PurchasesOffering | null;
  
  // Actions
  checkSubscription: () => Promise<void>;
  purchasePackage: (pkg: PurchasesPackage) => Promise<boolean>;
  restorePurchases: () => Promise<boolean>;
  
  // Helpers
  hasActiveSubscription: boolean;
  isSubscriptionRequired: boolean;
}

const RevenueCatContext = createContext<RevenueCatContextType | undefined>(undefined);

export function RevenueCatProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus>({
    status: 'inactive',
    expiresAt: null,
    productId: null,
    isTrialActive: false,
  });
  const [loading, setLoading] = useState(false);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [offerings, setOfferings] = useState<PurchasesOffering | null>(null);
  const [initialized, setInitialized] = useState(false);

  // Initialize RevenueCat SDK
  useEffect(() => {
    if (!isAuthenticated || !user || initialized) {
      return;
    }

    const initializeRevenueCat = async () => {
      try {
        console.log('[RevenueCat] Initializing SDK');
        
        // Validate configuration
        if (!validateRevenueCatConfig()) {
          console.error('[RevenueCat] Invalid configuration. Please update config/revenuecat.ts');
          return;
        }
        
        // Configure RevenueCat
        const apiKey = Platform.select({
          ios: REVENUECAT_CONFIG.iosApiKey,
          android: REVENUECAT_CONFIG.androidApiKey,
          default: REVENUECAT_CONFIG.iosApiKey,
        });

        if (!apiKey) {
          console.error('[RevenueCat] API key not configured');
          return;
        }

        // Set log level for debugging
        Purchases.setLogLevel(LOG_LEVEL.DEBUG);

        // Configure SDK
        await Purchases.configure({
          apiKey,
          appUserID: user.id, // Use Better Auth user ID as RevenueCat customer ID
        });

        console.log('[RevenueCat] SDK configured successfully');
        setInitialized(true);

        // Fetch initial customer info
        const info = await Purchases.getCustomerInfo();
        setCustomerInfo(info);
        console.log('[RevenueCat] Customer info fetched:', info);

        // Fetch available offerings
        const availableOfferings = await Purchases.getOfferings();
        if (availableOfferings.current) {
          setOfferings(availableOfferings.current);
          console.log('[RevenueCat] Offerings fetched:', availableOfferings.current);
        }

        // Sync with backend
        await syncSubscriptionWithBackend(info);
      } catch (error: any) {
        console.error('[RevenueCat] Initialization error:', error);
      }
    };

    initializeRevenueCat();
  }, [isAuthenticated, user, initialized]);

  // Sync subscription status with backend using RevenueCat data
  const syncSubscriptionWithBackend = useCallback(async (info: CustomerInfo) => {
    try {
      console.log('[RevenueCat] Syncing subscription with backend');
      
      // Check if user has active entitlements
      const hasActiveEntitlement = Object.keys(info.entitlements.active).length > 0;
      
      if (hasActiveEntitlement) {
        // Get the first active entitlement
        const entitlementKey = Object.keys(info.entitlements.active)[0];
        const entitlement = info.entitlements.active[entitlementKey];
        
        console.log('[RevenueCat] Active entitlement found:', entitlement);
        console.log('[RevenueCat] Product ID:', entitlement.productIdentifier);
        console.log('[RevenueCat] Expiration:', entitlement.expirationDate);
        
        // Sync with backend using new RevenueCat sync endpoint
        const response = await authenticatedPost<SubscriptionStatus>('/api/subscription/sync', {
          customerId: info.originalAppUserId,
        });
        
        setSubscriptionStatus(response);
        console.log('[RevenueCat] Backend sync successful:', response);
      } else {
        console.log('[RevenueCat] No active entitlements');
        
        // Update backend to inactive using sync endpoint
        const response = await authenticatedPost<SubscriptionStatus>('/api/subscription/sync', {
          customerId: info.originalAppUserId,
        });
        
        setSubscriptionStatus(response);
        console.log('[RevenueCat] Backend sync successful (inactive):', response);
      }
    } catch (error: any) {
      console.error('[RevenueCat] Backend sync error:', error);
      
      // If sync fails, try to get status from backend directly
      try {
        const fallbackStatus = await authenticatedGet<SubscriptionStatus>('/api/subscription/status');
        setSubscriptionStatus(fallbackStatus);
        console.log('[RevenueCat] Fallback status retrieved:', fallbackStatus);
      } catch (fallbackError: any) {
        console.error('[RevenueCat] Fallback status check failed:', fallbackError);
      }
    }
  }, []);

  // Check subscription status
  const checkSubscription = useCallback(async () => {
    if (!initialized) {
      console.log('[RevenueCat] SDK not initialized, skipping check');
      return;
    }

    setLoading(true);
    try {
      console.log('[RevenueCat] Checking subscription status');
      
      // Fetch latest customer info from RevenueCat
      const info = await Purchases.getCustomerInfo();
      setCustomerInfo(info);
      
      // Sync with backend
      await syncSubscriptionWithBackend(info);
      
      console.log('[RevenueCat] Subscription check complete');
    } catch (error: any) {
      console.error('[RevenueCat] Subscription check error:', error);
      
      // Fallback to backend status
      try {
        const response = await authenticatedGet<SubscriptionStatus>('/api/subscription/status');
        setSubscriptionStatus(response);
      } catch (backendError: any) {
        console.error('[RevenueCat] Backend status check error:', backendError);
      }
    } finally {
      setLoading(false);
    }
  }, [initialized, syncSubscriptionWithBackend]);

  // Purchase a package
  const purchasePackage = useCallback(async (pkg: PurchasesPackage): Promise<boolean> => {
    if (!initialized) {
      console.error('[RevenueCat] SDK not initialized');
      return false;
    }

    try {
      console.log('[RevenueCat] Purchasing package:', pkg.identifier);
      
      const { customerInfo: info } = await Purchases.purchasePackage(pkg);
      setCustomerInfo(info);
      
      // Sync with backend
      await syncSubscriptionWithBackend(info);
      
      console.log('[RevenueCat] Purchase successful');
      return true;
    } catch (error: any) {
      console.error('[RevenueCat] Purchase error:', error);
      
      // Check if user cancelled
      if (error.userCancelled) {
        console.log('[RevenueCat] User cancelled purchase');
      }
      
      return false;
    }
  }, [initialized, syncSubscriptionWithBackend]);

  // Restore purchases
  const restorePurchases = useCallback(async (): Promise<boolean> => {
    if (!initialized) {
      console.error('[RevenueCat] SDK not initialized');
      return false;
    }

    try {
      console.log('[RevenueCat] Restoring purchases');
      
      const info = await Purchases.restorePurchases();
      setCustomerInfo(info);
      
      // Sync with backend
      await syncSubscriptionWithBackend(info);
      
      console.log('[RevenueCat] Restore successful');
      return true;
    } catch (error: any) {
      console.error('[RevenueCat] Restore error:', error);
      return false;
    }
  }, [initialized, syncSubscriptionWithBackend]);

  // Computed values
  const hasActiveSubscription = subscriptionStatus.status === 'active' || subscriptionStatus.status === 'trial';
  const isSubscriptionRequired = !hasActiveSubscription;

  // Listen for customer info updates
  useEffect(() => {
    if (!initialized) {
      return;
    }

    const listener = Purchases.addCustomerInfoUpdateListener((info) => {
      console.log('[RevenueCat] Customer info updated:', info);
      setCustomerInfo(info);
      syncSubscriptionWithBackend(info);
    });

    return () => {
      listener.remove();
    };
  }, [initialized, syncSubscriptionWithBackend]);

  // Periodic subscription check (every 5 minutes)
  useEffect(() => {
    if (!isAuthenticated || !initialized) {
      return;
    }

    const interval = setInterval(() => {
      console.log('[RevenueCat] Periodic subscription check');
      checkSubscription();
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, [isAuthenticated, initialized, checkSubscription]);

  return (
    <RevenueCatContext.Provider
      value={{
        subscriptionStatus,
        loading,
        customerInfo,
        offerings,
        checkSubscription,
        purchasePackage,
        restorePurchases,
        hasActiveSubscription,
        isSubscriptionRequired,
      }}
    >
      {children}
    </RevenueCatContext.Provider>
  );
}

export function useRevenueCat() {
  const context = useContext(RevenueCatContext);
  if (context === undefined) {
    throw new Error('useRevenueCat must be used within RevenueCatProvider');
  }
  return context;
}

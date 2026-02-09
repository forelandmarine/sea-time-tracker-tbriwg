
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
import { REVENUECAT_API_KEY, ENTITLEMENT_ID, validateRevenueCatConfig } from '@/config/revenuecat';

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
  presentPaywall: () => Promise<void>;
  presentCustomerCenter: () => Promise<void>;
  
  // Helpers
  hasActiveSubscription: boolean;
  isSubscriptionRequired: boolean;
  isPro: boolean;
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
        console.log('[RevenueCat] Initializing SDK for user:', user.id);
        
        // Validate configuration
        if (!validateRevenueCatConfig()) {
          console.error('[RevenueCat] Invalid configuration. Please check config/revenuecat.ts');
          return;
        }

        if (!REVENUECAT_API_KEY) {
          console.error('[RevenueCat] API key not configured for platform:', Platform.OS);
          return;
        }

        console.log('[RevenueCat] Using API key:', REVENUECAT_API_KEY.substring(0, 15) + '...');

        // Set log level for debugging
        Purchases.setLogLevel(LOG_LEVEL.DEBUG);

        // Configure SDK with Better Auth user ID
        await Purchases.configure({
          apiKey: REVENUECAT_API_KEY,
          appUserID: user.id,
        });

        console.log('[RevenueCat] SDK configured successfully');
        setInitialized(true);

        // Fetch initial customer info
        const info = await Purchases.getCustomerInfo();
        setCustomerInfo(info);
        console.log('[RevenueCat] Customer info fetched');
        console.log('[RevenueCat] Active entitlements:', Object.keys(info.entitlements.active));

        // Fetch available offerings
        const availableOfferings = await Purchases.getOfferings();
        if (availableOfferings.current) {
          setOfferings(availableOfferings.current);
          console.log('[RevenueCat] Current offering:', availableOfferings.current.identifier);
          console.log('[RevenueCat] Available packages:', availableOfferings.current.availablePackages.length);
        } else {
          console.warn('[RevenueCat] No current offering available');
        }

        // Sync with backend
        await syncSubscriptionWithBackend(info);
      } catch (error: any) {
        console.error('[RevenueCat] Initialization error:', error);
        console.error('[RevenueCat] Error details:', error.message);
      }
    };

    initializeRevenueCat();
  }, [isAuthenticated, user, initialized]);

  // Sync subscription status with backend using RevenueCat data
  const syncSubscriptionWithBackend = useCallback(async (info: CustomerInfo) => {
    try {
      console.log('[RevenueCat] Syncing subscription with backend');
      
      // Check if user has the specific entitlement
      const hasProEntitlement = !!info.entitlements.active[ENTITLEMENT_ID];
      
      console.log('[RevenueCat] Has Pro entitlement:', hasProEntitlement);
      console.log('[RevenueCat] Entitlement ID:', ENTITLEMENT_ID);
      
      if (hasProEntitlement) {
        const entitlement = info.entitlements.active[ENTITLEMENT_ID];
        
        console.log('[RevenueCat] Active entitlement details:');
        console.log('[RevenueCat] - Product ID:', entitlement.productIdentifier);
        console.log('[RevenueCat] - Expiration:', entitlement.expirationDate);
        console.log('[RevenueCat] - Will Renew:', entitlement.willRenew);
        console.log('[RevenueCat] - Is Active:', entitlement.isActive);
      }
      
      // Sync with backend
      const response = await authenticatedPost<SubscriptionStatus>('/api/subscription/sync', {
        customerId: info.originalAppUserId,
        hasActiveSubscription: hasProEntitlement,
      });
      
      setSubscriptionStatus(response);
      console.log('[RevenueCat] Backend sync successful:', response);
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
      console.log('[RevenueCat] Product ID:', pkg.product.identifier);
      
      const { customerInfo: info } = await Purchases.purchasePackage(pkg);
      setCustomerInfo(info);
      
      console.log('[RevenueCat] Purchase successful');
      console.log('[RevenueCat] New active entitlements:', Object.keys(info.entitlements.active));
      
      // Sync with backend
      await syncSubscriptionWithBackend(info);
      
      return true;
    } catch (error: any) {
      console.error('[RevenueCat] Purchase error:', error);
      
      // Check if user cancelled
      if (error.userCancelled) {
        console.log('[RevenueCat] User cancelled purchase');
      } else {
        console.error('[RevenueCat] Purchase failed:', error.message);
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
      
      console.log('[RevenueCat] Restore successful');
      console.log('[RevenueCat] Active entitlements after restore:', Object.keys(info.entitlements.active));
      
      // Sync with backend
      await syncSubscriptionWithBackend(info);
      
      return Object.keys(info.entitlements.active).length > 0;
    } catch (error: any) {
      console.error('[RevenueCat] Restore error:', error);
      return false;
    }
  }, [initialized, syncSubscriptionWithBackend]);

  // Present native paywall (requires react-native-purchases-ui)
  const presentPaywall = useCallback(async () => {
    if (!initialized) {
      console.error('[RevenueCat] SDK not initialized');
      return;
    }

    try {
      console.log('[RevenueCat] Presenting native paywall');
      
      // Note: This requires react-native-purchases-ui and proper paywall configuration in RevenueCat dashboard
      // For now, we'll use the custom paywall screen via navigation
      console.log('[RevenueCat] Using custom paywall screen (native paywall requires additional setup)');
    } catch (error: any) {
      console.error('[RevenueCat] Paywall presentation error:', error);
    }
  }, [initialized]);

  // Present Customer Center (requires react-native-purchases-ui)
  const presentCustomerCenter = useCallback(async () => {
    if (!initialized) {
      console.error('[RevenueCat] SDK not initialized');
      return;
    }

    try {
      console.log('[RevenueCat] Presenting Customer Center');
      
      // Note: This requires react-native-purchases-ui and proper configuration
      // For now, we'll navigate to a custom customer center screen
      console.log('[RevenueCat] Using custom customer center screen (native customer center requires additional setup)');
    } catch (error: any) {
      console.error('[RevenueCat] Customer Center presentation error:', error);
    }
  }, [initialized]);

  // Computed values
  const isPro = customerInfo ? !!customerInfo.entitlements.active[ENTITLEMENT_ID] : false;
  const hasActiveSubscription = subscriptionStatus.status === 'active' || subscriptionStatus.status === 'trial' || isPro;
  const isSubscriptionRequired = !hasActiveSubscription;

  // Listen for customer info updates
  useEffect(() => {
    if (!initialized) {
      return;
    }

    const listener = Purchases.addCustomerInfoUpdateListener((info) => {
      console.log('[RevenueCat] Customer info updated');
      console.log('[RevenueCat] Active entitlements:', Object.keys(info.entitlements.active));
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
        presentPaywall,
        presentCustomerCenter,
        hasActiveSubscription,
        isSubscriptionRequired,
        isPro,
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

'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from 'react';
import { useUser } from '@clerk/nextjs';
import { TRADING_ALERT_PRODUCTS } from '@/lib/product-config';

// ✅ UNIFIED: Complete authentication and subscription state
interface UnifiedAuthState {
  // Authentication
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Subscription
  hasAccess: boolean;
  subscriptionData: {
    productId: string | null;
    subscriptionEnd: string | null;
    subscriptionStatus: string | null;
    amount: number | null;
    currency: string | null;
    interval: string | null;
    autoRenew: boolean | null;
    discountPercent: number | null;
    discountName: string | null;
    isAdminAccess: boolean;
  } | null;

  // Profile
  profile: {
    id: string;
    email: string;
    name: string;
    isAdmin: boolean;
    subscriptionStatus: string;
  } | null;

  // Performance tracking
  lastFetchTime: Date | null;
  dataSource: 'webhook-cache' | 'admin-bypass' | 'not-loaded';

  // Actions
  refetch: () => Promise<void>;
  isStale: () => boolean;
}

// ✅ OPTIMIZED: Single context for all authentication needs
const UnifiedAuthContext = createContext<UnifiedAuthState | null>(null);

// ✅ PERFORMANCE: Cache configuration
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const STALE_TTL = 2 * 60 * 1000; // 2 minutes

interface UnifiedAuthProviderProps {
  children: React.ReactNode;
  customProductIds?: string[];
}

export function UnifiedAuthProvider({
  children,
  customProductIds = [...TRADING_ALERT_PRODUCTS],
}: UnifiedAuthProviderProps) {
  const { isLoaded, isSignedIn, user } = useUser();

  // ⚡ FIX: Use ref to track fetch time to prevent infinite loops
  const lastFetchTimeRef = useRef<Date | null>(null);
  const isFetchingRef = useRef(false);

  // ✅ UNIFIED: Single state for all auth data
  const [authState, setAuthState] = useState<UnifiedAuthState>({
    isAuthenticated: false,
    isLoading: true,
    error: null,
    hasAccess: false,
    subscriptionData: null,
    profile: null,
    lastFetchTime: null,
    dataSource: 'not-loaded',
    refetch: async () => {},
    isStale: () => true,
  });

  // ⚡ FIX: Stable function that doesn't recreate on every render
  const fetchUnifiedAuthData = useCallback(
    async (forceRefresh = false) => {
      if (!isLoaded || !isSignedIn || !user || isFetchingRef.current) {
        if (!isLoaded || !isSignedIn || !user) {
          setAuthState(prev => ({
            ...prev,
            isAuthenticated: false,
            isLoading: false,
            hasAccess: false,
            subscriptionData: null,
            profile: null,
            error: null,
          }));
        }
        return;
      }

      // ⚡ FIX: Check cache freshness using ref instead of state
      const now = new Date();
      if (!forceRefresh && lastFetchTimeRef.current) {
        const timeSinceLastFetch =
          now.getTime() - lastFetchTimeRef.current.getTime();
        if (timeSinceLastFetch < CACHE_TTL) {
          console.log(
            `⚡ [UNIFIED-AUTH] Using cached data (${Math.round(timeSinceLastFetch / 1000)}s old)`
          );
          return;
        }
      }

      // ⚡ FIX: Prevent multiple simultaneous fetches
      isFetchingRef.current = true;
      setAuthState(prev => ({ ...prev, isLoading: true, error: null }));

      try {
        console.log(
          `🚀 [UNIFIED-AUTH] Fetching complete authentication data for user: ${user.id}`
        );

        // ✅ SINGLE API CALL: Get complete user data in one request
        const response = await fetch('/api/check-product-subscription', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            allowedProductIds: customProductIds,
            includeProfile: true, // Request additional profile data
          }),
        });

        if (!response.ok) {
          throw new Error(`Authentication check failed: ${response.status}`);
        }

        const result = await response.json();

        // ⚡ FIX: Update ref before state to prevent loops
        lastFetchTimeRef.current = now;

        // ✅ ENHANCED: Parse comprehensive response
        const newAuthState: Partial<UnifiedAuthState> = {
          isAuthenticated: true,
          isLoading: false,
          hasAccess: result.hasAccess || false,
          subscriptionData: result.hasAccess
            ? {
                productId: result.productId,
                subscriptionEnd: result.subscriptionEnd,
                subscriptionStatus:
                  result.subscriptionDetails?.status || 'ACTIVE',
                amount: result.subscriptionDetails?.amount,
                currency: result.subscriptionDetails?.currency,
                interval: result.subscriptionDetails?.interval,
                autoRenew: result.subscriptionDetails?.autoRenew,
                discountPercent: result.subscriptionDetails?.discountPercent,
                discountName: result.subscriptionDetails?.discountName,
                isAdminAccess: result.isAdminAccess || false,
              }
            : null,
          profile: {
            id: user.id,
            email:
              result.foundWithEmail ||
              user.primaryEmailAddress?.emailAddress ||
              '',
            name: user.fullName || `${user.firstName} ${user.lastName}`,
            isAdmin: result.isAdminAccess || false,
            subscriptionStatus: result.subscriptionDetails?.status || 'FREE',
          },
          lastFetchTime: now,
          dataSource:
            result.source === 'admin_bypass' ? 'admin-bypass' : 'webhook-cache',
          error: null,
        };

        setAuthState(prev => ({ ...prev, ...newAuthState }));

        console.log(
          `✅ [UNIFIED-AUTH] Successfully loaded unified auth data:`,
          {
            hasAccess: result.hasAccess,
            productId: result.productId,
            dataSource: result.source,
            isAdmin: result.isAdminAccess,
            processingTime: 'single-api-call',
          }
        );
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Authentication failed';
        console.error('❌ [UNIFIED-AUTH] Failed to fetch auth data:', error);

        setAuthState(prev => ({
          ...prev,
          isLoading: false,
          error: errorMessage,
          hasAccess: false,
        }));
      } finally {
        // ⚡ FIX: Always release the fetch lock
        isFetchingRef.current = false;
      }
    },
    [isLoaded, isSignedIn, user, customProductIds] // ⚡ FIX: Removed lastFetchTime dependency
  );

  // ⚡ FIX: Stable stale check using ref
  const isStale = useCallback(() => {
    if (!lastFetchTimeRef.current) return true;
    const timeSinceLastFetch = Date.now() - lastFetchTimeRef.current.getTime();
    return timeSinceLastFetch > STALE_TTL;
  }, []);

  // ⚡ FIX: Simplified useEffect structure to prevent infinite loops
  useEffect(() => {
    if (isLoaded) {
      if (!isSignedIn || !user) {
        // Clear auth state for signed out users
        setAuthState(prev => ({
          ...prev,
          isAuthenticated: false,
          isLoading: false,
          hasAccess: false,
          subscriptionData: null,
          profile: null,
          error: null,
        }));
        lastFetchTimeRef.current = null;
      } else {
        // Only fetch once per user session, not on every render
        if (!lastFetchTimeRef.current) {
          console.log(
            '🚀 [UNIFIED-AUTH] Initial auth data fetch for new user session'
          );
          fetchUnifiedAuthData(true);
        }
      }
    }
  }, [isLoaded, isSignedIn, user?.id]); // ⚡ CRITICAL FIX: Removed fetchUnifiedAuthData from dependencies

  // ✅ FINALIZED: Complete auth state with actions
  const finalAuthState: UnifiedAuthState = {
    ...authState,
    refetch: () => fetchUnifiedAuthData(true), // ⚡ FIX: Always force refresh on manual refetch
    isStale,
  };

  return (
    <UnifiedAuthContext.Provider value={finalAuthState}>
      {children}
    </UnifiedAuthContext.Provider>
  );
}

// ✅ HOOK: Easy access to unified auth state
export function useUnifiedAuth(): UnifiedAuthState {
  const context = useContext(UnifiedAuthContext);
  if (!context) {
    throw new Error('useUnifiedAuth must be used within UnifiedAuthProvider');
  }
  return context;
}

// ✅ CONVENIENCE: Legacy compatibility hooks
export function useAuthStatus() {
  const { isAuthenticated, hasAccess, isLoading } = useUnifiedAuth();
  return { isAuthenticated, hasAccess, isLoading };
}

export function useSubscriptionData() {
  const { subscriptionData, hasAccess } = useUnifiedAuth();
  return { subscription: subscriptionData, hasAccess };
}

export function useUserProfile() {
  const { profile } = useUnifiedAuth();
  return { profile };
}

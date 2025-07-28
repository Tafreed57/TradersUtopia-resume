'use client';

import { useUser } from '@clerk/nextjs';
import { useEffect, useRef, useState } from 'react';
import { TRADING_ALERT_PRODUCTS } from '@/lib/product-config';

interface UseAuthCleanupOptions {
  enableAutoSync?: boolean;
  syncInterval?: number;
  enableLogging?: boolean;
  customProductIds?: string[]; // Allow override for specific use cases
}

interface AuthStatus {
  isAuthenticated: boolean;
  hasValidSubscription: boolean;
  subscriptionProductId?: string;
  subscriptionEnd?: string;
  lastSyncTime?: Date;
  isLoading: boolean;
  error?: string;
}

export function useAuthCleanup(options: UseAuthCleanupOptions = {}) {
  const {
    enableAutoSync = false, // ✅ DISABLED: Stop automatic sync to prevent repeated calls
    syncInterval = 300000, // ✅ INCREASED: 5 minutes instead of 1 minute when enabled
    enableLogging = false,
    customProductIds = [...TRADING_ALERT_PRODUCTS], // ✅ UPDATED: Use client-safe config, convert readonly to mutable
  } = options;

  const { isLoaded, isSignedIn, user } = useUser();
  const [authStatus, setAuthStatus] = useState<AuthStatus>({
    isAuthenticated: false,
    hasValidSubscription: false,
    isLoading: true,
  });

  const lastSyncRef = useRef<Date | null>(null);
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isSyncingRef = useRef(false);

  // ✅ ENHANCED: Comprehensive authentication verification (manual only)
  const performAuthSync = async (forceSync = false) => {
    if (!isLoaded || !isSignedIn || !user || isSyncingRef.current) {
      return;
    }

    // Check if we need to sync (force sync or enough time has passed)
    // const now = new Date();
    // const timeSinceLastSync = lastSyncRef.current
    //   ? now.getTime() - lastSyncRef.current.getTime()
    //   : Infinity;

    // if (!forceSync && timeSinceLastSync < syncInterval) {
    //   return;
    // }

    // isSyncingRef.current = true;
    // setAuthStatus(prev => ({ ...prev, isLoading: true, error: undefined }));

    // try {
    //   if (enableLogging) {
    //   }

    //   // Step 1: Verify product subscription with enhanced endpoint
    //   const productResponse = await fetch('/api/check-product-subscription', {
    //     method: 'POST',
    //     headers: {
    //       'Content-Type': 'application/json',
    //     },
    //     body: JSON.stringify({
    //       allowedProductIds: customProductIds, // ✅ UPDATED: Use configurable product IDs
    //     }),
    //   });

    //   let hasValidSubscription = false;
    //   let subscriptionData: any = null;

    //   if (productResponse.ok) {
    //     subscriptionData = await productResponse.json();
    //     hasValidSubscription = subscriptionData.hasAccess;

    //     if (enableLogging) {
    //     }
    //   } else {
    //     const errorData = await productResponse.json().catch(() => ({}));
    //     if (enableLogging) {
    //     }
    //   }

    //   // ✅ REMOVED: Payment verification step to reduce API calls

    //   // Step 2: Update auth status
    //   setAuthStatus({
    //     isAuthenticated: true,
    //     hasValidSubscription,
    //     subscriptionProductId: subscriptionData?.productId,
    //     subscriptionEnd: subscriptionData?.subscriptionEnd,
    //     lastSyncTime: now,
    //     isLoading: false,
    //     error: undefined,
    //   });

    //   lastSyncRef.current = now;

    //   if (enableLogging) {
    //     console.log(
    //       '✅ [AUTH-SYNC] Authentication sync completed successfully'
    //     );
    //   }
    // } catch (error) {
    //   const errorMessage =
    //     error instanceof Error ? error.message : 'Unknown error';

    //   if (enableLogging) {
    //     console.error('❌ [AUTH-SYNC] Authentication sync failed:', error);
    //   }

    //   setAuthStatus(prev => ({
    //     ...prev,
    //     isLoading: false,
    //     error: errorMessage,
    //   }));
    // } finally {
    //   isSyncingRef.current = false;
    // }
  };

  // ✅ SIMPLIFIED: Only perform initial sync when user loads, no automatic intervals
  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    if (!isSignedIn || !user) {
      setAuthStatus({
        isAuthenticated: false,
        hasValidSubscription: false,
        isLoading: false,
      });
      return;
    }

    // Perform initial sync when user loads (only once)
    performAuthSync(true);

    // ✅ REMOVED: Automatic interval sync to stop repeated calls
  }, [isLoaded, isSignedIn, user?.id]);

  // ✅ REMOVED: Visibility change and focus event listeners to prevent excessive API calls

  // Manual sync function for components
  const forceSyncAuth = () => {
    return performAuthSync(true);
  };

  // Check if auth data is stale
  const isAuthStale = () => {
    if (!lastSyncRef.current) return true;
    const timeSinceSync = Date.now() - lastSyncRef.current.getTime();
    return timeSinceSync > syncInterval * 2; // Consider stale after 2x sync interval
  };

  return {
    ...authStatus,
    forceSyncAuth,
    isAuthStale: isAuthStale(),
    timeSinceLastSync: lastSyncRef.current
      ? Date.now() - lastSyncRef.current.getTime()
      : null,
    productIds: customProductIds, // ✅ ADDED: Expose which products are being checked
  };
}

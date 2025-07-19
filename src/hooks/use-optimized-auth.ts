'use client';

import { useUser } from '@clerk/nextjs';
import { useEffect, useRef, useState } from 'react';

interface OptimizedAuthState {
  isAuthenticated: boolean;
  hasAccess: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  error: string | null;
  subscriptionStatus: string | null;
  subscriptionEnd: string | null;
  stripeProductId: string | null;
  profile: {
    id: string;
    email: string;
    name: string;
    isAdmin: boolean;
  } | null;
  dataSource: string;
  cached: boolean;
  cacheAge?: number;
  lastCheck: Date | null;
}

interface UseOptimizedAuthOptions {
  enableAutoCheck?: boolean;
  checkOnMount?: boolean;
  enableLogging?: boolean;
}

export function useOptimizedAuth(options: UseOptimizedAuthOptions = {}) {
  const {
    enableAutoCheck = true,
    checkOnMount = true,
    enableLogging = false,
  } = options;

  const { isLoaded, isSignedIn, user } = useUser();
  const [authState, setAuthState] = useState<OptimizedAuthState>({
    isAuthenticated: false,
    hasAccess: false,
    isAdmin: false,
    isLoading: true,
    error: null,
    subscriptionStatus: null,
    subscriptionEnd: null,
    stripeProductId: null,
    profile: null,
    dataSource: 'none',
    cached: false,
    lastCheck: null,
  });

  const hasCheckedRef = useRef(false);
  const checkInProgressRef = useRef(false);

  const performAuthCheck = async (forceRefresh = false) => {
    if (!isLoaded || !isSignedIn || !user || checkInProgressRef.current) {
      return;
    }

    // Skip if we've already checked recently and not forcing refresh
    if (!forceRefresh && hasCheckedRef.current) {
      return;
    }

    checkInProgressRef.current = true;
    setAuthState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      if (enableLogging) {
        console.log(
          `🔍 [OPTIMIZED-AUTH] Starting auth check for user: ${user.id}`
        );
      }

      const response = await fetch('/api/auth/session-check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Auth check failed: ${response.status}`);
      }

      const result = await response.json();

      if (enableLogging) {
        console.log(`✅ [OPTIMIZED-AUTH] Auth check completed:`, {
          hasAccess: result.hasAccess,
          cached: result.cached,
          dataSource: result.dataSource,
          stripeCallMade: result.stripeCallMade,
        });
      }

      setAuthState({
        isAuthenticated: result.isAuthenticated,
        hasAccess: result.hasAccess,
        isAdmin: result.isAdmin || false,
        isLoading: false,
        error: null,
        subscriptionStatus: result.subscriptionStatus,
        subscriptionEnd: result.subscriptionEnd,
        stripeProductId: result.stripeProductId,
        profile: result.profile,
        dataSource: result.dataSource,
        cached: result.cached || false,
        cacheAge: result.cacheAge,
        lastCheck: new Date(),
      });

      hasCheckedRef.current = true;
    } catch (error) {
      console.error('❌ [OPTIMIZED-AUTH] Auth check failed:', error);

      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        lastCheck: new Date(),
      }));
    } finally {
      checkInProgressRef.current = false;
    }
  };

  // Perform auth check on mount or when user changes
  useEffect(() => {
    if (
      checkOnMount &&
      isLoaded &&
      isSignedIn &&
      user &&
      !hasCheckedRef.current
    ) {
      performAuthCheck();
    }
  }, [isLoaded, isSignedIn, user?.id, checkOnMount]);

  // Reset state when user signs out
  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      setAuthState({
        isAuthenticated: false,
        hasAccess: false,
        isAdmin: false,
        isLoading: false,
        error: null,
        subscriptionStatus: null,
        subscriptionEnd: null,
        stripeProductId: null,
        profile: null,
        dataSource: 'signed_out',
        cached: false,
        lastCheck: null,
      });
      hasCheckedRef.current = false;
    }
  }, [isLoaded, isSignedIn]);

  const refreshAuth = async () => {
    hasCheckedRef.current = false;
    await performAuthCheck(true);
  };

  const isStale = () => {
    if (!authState.lastCheck) return true;
    const ageInMinutes =
      (Date.now() - authState.lastCheck.getTime()) / (1000 * 60);
    return ageInMinutes > 30; // Consider stale after 30 minutes
  };

  return {
    ...authState,
    refreshAuth,
    isStale: isStale(),
    performAuthCheck,
  };
}

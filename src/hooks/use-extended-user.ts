'use client';

import { useUser as useClerkUser } from '@clerk/nextjs';
import { useEffect, useRef, useState, useCallback } from 'react';

// Enhanced user state that includes service data
interface ExtendedUserState {
  // Clerk data (passthrough)
  isLoaded: boolean;
  isSignedIn: boolean;
  user: any; // Clerk User type

  // Enhanced auth data from services
  isAuthenticated: boolean;
  hasAccess: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  error: string | null;

  // Subscription data from services
  subscriptionData: {
    hasAccess: boolean;
    hasActiveSubscription: boolean;
    subscriptionStatus: string;
    subscriptionStart?: Date;
    subscriptionEnd?: Date;
    stripeCustomerId?: string;
    stripeProductId?: string;
    accessReason?: string;
  } | null;

  // Enhanced profile data
  profile: {
    id: string;
    email: string;
    name: string;
    isAdmin: boolean;
    createdAt: Date;
  } | null;

  // Performance data
  dataSource: string;
  cached: boolean;
  lastCheck: Date | null;

  // Actions
  refetch: () => Promise<void>;
  refreshAuth: () => Promise<void>;
  isStale: () => boolean;
}

interface UseExtendedUserOptions {
  enableAutoCheck?: boolean;
  checkOnMount?: boolean;
  enableLogging?: boolean;
  cacheTimeout?: number; // minutes
}

/**
 * Extended useUser hook that combines Clerk's useUser() with service calls
 * Provides complete user state including subscription, access, and admin status
 *
 * Features:
 * - Extends Clerk's useUser() with service data
 * - Intelligent caching and performance optimization
 * - Automatic payment/subscription verification
 * - Admin status checking
 * - Comprehensive error handling
 *
 * @param options Configuration options for the hook
 * @returns Extended user state with service data
 *
 * @example
 * ```tsx
 * const { user, hasAccess, subscriptionData, profile, isAdmin } = useExtendedUser();
 *
 * if (isLoading) return <Loading />;
 * if (!hasAccess) return <PaymentGate />;
 * if (isAdmin) return <AdminPanel />;
 * ```
 */
export function useExtendedUser(
  options: UseExtendedUserOptions = {}
): ExtendedUserState {
  const {
    enableAutoCheck = true,
    checkOnMount = true,
    enableLogging = false,
    cacheTimeout = 15, // 15 minutes default cache
  } = options;

  // Get Clerk's user data
  const clerkUser = useClerkUser();

  // Extended state management
  const [extendedState, setExtendedState] = useState<
    Omit<ExtendedUserState, 'refetch' | 'refreshAuth' | 'isStale'>
  >({
    // Clerk passthrough
    isLoaded: false,
    isSignedIn: false,
    user: null,

    // Enhanced data
    isAuthenticated: false,
    hasAccess: false,
    isAdmin: false,
    isLoading: true,
    error: null,
    subscriptionData: null,
    profile: null,
    dataSource: 'none',
    cached: false,
    lastCheck: null,
  });

  // Ref to prevent duplicate API calls
  const hasCheckedRef = useRef(false);
  const checkInProgressRef = useRef(false);

  /**
   * Performs comprehensive auth check using service APIs
   */
  const performExtendedCheck = useCallback(
    async (forceRefresh = false) => {
      if (
        !clerkUser.isLoaded ||
        !clerkUser.isSignedIn ||
        !clerkUser.user ||
        checkInProgressRef.current
      ) {
        return;
      }

      // Skip if recently checked and not forcing refresh
      if (!forceRefresh && hasCheckedRef.current && extendedState.lastCheck) {
        const ageInMinutes =
          (Date.now() - extendedState.lastCheck.getTime()) / (1000 * 60);
        if (ageInMinutes < cacheTimeout) {
          return;
        }
      }

      checkInProgressRef.current = true;
      setExtendedState(prev => ({ ...prev, isLoading: true, error: null }));

      try {
        if (enableLogging) {
          console.log(
            `🚀 [EXTENDED-USER] Starting enhanced user check for: ${clerkUser.user.id}`
          );
        }

        // Call session check API (includes profile + subscription data)
        const sessionResponse = await fetch('/api/auth/session-check', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!sessionResponse.ok) {
          throw new Error(`Session check failed: ${sessionResponse.status}`);
        }

        const sessionData: any = await sessionResponse.json();

        // Call payment verification API (includes access data)
        const paymentResponse = await fetch('/api/payments/verify', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        let paymentData: any = {
          hasAccess: false,
          stripeData: null,
          performanceInfo: null,
        };
        if (paymentResponse.ok) {
          paymentData = await paymentResponse.json();
        }

        // Combine all the data
        const hasAccess =
          paymentData.hasAccess || sessionData.hasAccess || false;
        const isAdmin =
          sessionData.isAdmin || sessionData.profile?.isAdmin || false;

        // Build comprehensive subscription data
        const subscriptionData = {
          hasAccess,
          hasActiveSubscription:
            paymentData.stripeData?.hasActiveSubscription || false,
          subscriptionStatus: sessionData.subscriptionStatus || 'FREE',
          subscriptionStart: sessionData.subscriptionStart
            ? new Date(sessionData.subscriptionStart)
            : undefined,
          subscriptionEnd: sessionData.subscriptionEnd
            ? new Date(sessionData.subscriptionEnd)
            : paymentData.stripeData?.subscriptionEnd
              ? new Date(paymentData.stripeData.subscriptionEnd)
              : undefined,
          stripeCustomerId:
            sessionData.stripeCustomerId || paymentData.stripeData?.customerId,
          stripeProductId:
            sessionData.stripeProductId || paymentData.stripeData?.productId,
          accessReason:
            paymentData.stripeData?.accessReason ||
            (hasAccess ? 'Verified access' : 'No access'),
        };

        // Enhanced profile data
        const profile = sessionData.profile
          ? {
              id: sessionData.profile.id,
              email: sessionData.profile.email,
              name: sessionData.profile.name,
              isAdmin,
              createdAt: new Date(sessionData.profile.createdAt || new Date()),
            }
          : null;

        // Performance optimization data
        const dataSource =
          paymentData.performanceInfo?.dataSource ||
          sessionData.dataSource ||
          'api-combined';
        const cached =
          paymentData.performanceInfo?.cacheHit || sessionData.cached || false;

        if (enableLogging) {
          console.log(`✅ [EXTENDED-USER] Enhanced check completed:`, {
            hasAccess,
            isAdmin,
            subscriptionStatus: subscriptionData.subscriptionStatus,
            dataSource,
            cached,
          });
        }

        // Update state with all combined data
        setExtendedState({
          // Clerk passthrough
          isLoaded: clerkUser.isLoaded,
          isSignedIn: clerkUser.isSignedIn,
          user: clerkUser.user,

          // Enhanced data
          isAuthenticated: clerkUser.isSignedIn,
          hasAccess,
          isAdmin,
          isLoading: false,
          error: null,
          subscriptionData,
          profile,
          dataSource,
          cached,
          lastCheck: new Date(),
        });

        hasCheckedRef.current = true;
      } catch (error) {
        console.error('❌ [EXTENDED-USER] Enhanced check failed:', error);

        setExtendedState(prev => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          lastCheck: new Date(),
        }));
      } finally {
        checkInProgressRef.current = false;
      }
    },
    [
      clerkUser.isLoaded,
      clerkUser.isSignedIn,
      clerkUser.user?.id,
      cacheTimeout,
      enableLogging,
      extendedState.lastCheck,
    ]
  );

  /**
   * Refetch all data (alias for performExtendedCheck)
   */
  const refetch = useCallback(async () => {
    hasCheckedRef.current = false;
    await performExtendedCheck(true);
  }, [performExtendedCheck]);

  /**
   * Refresh auth data (alias for refetch)
   */
  const refreshAuth = useCallback(async () => {
    await refetch();
  }, [refetch]);

  // Effect: Update Clerk passthrough data immediately
  useEffect(() => {
    setExtendedState(prev => ({
      ...prev,
      isLoaded: clerkUser.isLoaded,
      isSignedIn: clerkUser.isSignedIn || false,
      user: clerkUser.user,
      isAuthenticated: clerkUser.isSignedIn || false,
    }));
  }, [clerkUser.isLoaded, clerkUser.isSignedIn, clerkUser.user]);

  // Effect: Perform extended check when user is available
  useEffect(() => {
    if (
      checkOnMount &&
      clerkUser.isLoaded &&
      clerkUser.isSignedIn &&
      clerkUser.user &&
      !hasCheckedRef.current
    ) {
      performExtendedCheck();
    }
  }, [
    clerkUser.isLoaded,
    clerkUser.isSignedIn,
    clerkUser.user?.id,
    checkOnMount,
    performExtendedCheck,
  ]);

  // Effect: Reset state when user signs out
  useEffect(() => {
    if (clerkUser.isLoaded && !clerkUser.isSignedIn) {
      setExtendedState({
        isLoaded: true,
        isSignedIn: false,
        user: null,
        isAuthenticated: false,
        hasAccess: false,
        isAdmin: false,
        isLoading: false,
        error: null,
        subscriptionData: null,
        profile: null,
        dataSource: 'signed_out',
        cached: false,
        lastCheck: null,
      });
      hasCheckedRef.current = false;
    }
  }, [clerkUser.isLoaded, clerkUser.isSignedIn]);

  // Helper function to check if data is stale
  const isStale = () => {
    if (!extendedState.lastCheck) return true;
    const ageInMinutes =
      (Date.now() - extendedState.lastCheck.getTime()) / (1000 * 60);
    return ageInMinutes > cacheTimeout;
  };

  return {
    ...extendedState,
    refetch,
    refreshAuth,
    isStale,
  };
}

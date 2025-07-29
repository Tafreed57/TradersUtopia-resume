'use client';

import { useUser as useClerkUser } from '@clerk/nextjs';
import { useEffect, useRef, useState, useCallback } from 'react';
import { makeSecureRequest } from '@/lib/csrf-client';

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

  // Simplified subscription data
  subscriptionData: {
    hasAccess: boolean;
    hasActiveSubscription: boolean;
    subscriptionStatus: string;
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
 * Extended useUser hook that combines Clerk's useUser() with session-check service
 * Provides complete user state including subscription, access, and admin status
 *
 * Features:
 * - Extends Clerk's useUser() with database service data
 * - Intelligent caching and performance optimization
 * - Database-only subscription verification (no external API calls)
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
   * Performs simplified auth check using session-check API only
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
            `🚀 [EXTENDED-USER] Starting simplified auth check for: ${clerkUser.user.id}`
          );
        }

        // Call simplified session check API (includes profile + subscription data from database)
        const sessionResponse = await makeSecureRequest(
          '/api/auth/session-check',
          {
            method: 'POST',
          }
        );

        if (!sessionResponse.ok) {
          throw new Error(`Session check failed: ${sessionResponse.status}`);
        }

        const sessionData: any = await sessionResponse.json();
        console.log('🚀 [EXTENDED-USER] sessionData:', sessionData);
        // Extract data from simplified response
        const hasAccess = sessionData.hasAccess || false;
        const isAdmin = sessionData.isAdmin || false;
        const isAuthenticated = sessionData.isAuthenticated || false;

        // Build simplified subscription data
        const subscriptionData = {
          hasAccess,
          hasActiveSubscription: hasAccess && !isAdmin, // Active subscription if has access but not admin
          subscriptionStatus: isAdmin ? 'ADMIN' : hasAccess ? 'ACTIVE' : 'FREE',
        };

        // Enhanced profile data from response
        const profile = sessionData.profile
          ? {
              id: sessionData.profile.id,
              email: sessionData.profile.email,
              name: sessionData.profile.name,
              isAdmin: sessionData.profile.isAdmin || false,
              createdAt: new Date(sessionData.profile.createdAt || new Date()),
            }
          : null;

        if (enableLogging) {
          console.log(`✅ [EXTENDED-USER] Simplified check completed:`, {
            hasAccess,
            isAdmin,
            isAuthenticated,
            subscriptionStatus: subscriptionData.subscriptionStatus,
            dataSource: 'database',
          });
        }

        // Update state with simplified data
        setExtendedState({
          // Clerk passthrough
          isLoaded: clerkUser.isLoaded,
          isSignedIn: clerkUser.isSignedIn,
          user: clerkUser.user,

          // Enhanced data
          isAuthenticated,
          hasAccess,
          isAdmin,
          isLoading: false,
          error: null,
          subscriptionData,
          profile,
          dataSource: 'database',
          cached: false,
          lastCheck: new Date(),
        });

        hasCheckedRef.current = true;
      } catch (error) {
        console.error('❌ [EXTENDED-USER] Simplified check failed:', error);

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
      cacheTimeout,
      enableLogging,
      extendedState.lastCheck,
      clerkUser.user,
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

'use client';

import { useUser } from '@clerk/nextjs';
import { useEffect, useState, useMemo } from 'react';

// Simplified user state interface
interface ExtendedUserState {
  // Clerk passthrough
  isLoaded: boolean;
  isSignedIn: boolean;
  user: any;

  // Additional data
  hasAccess: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  error: string | null;
}

/**
 * Simplified user hook that provides Clerk data plus hasAccess and isAdmin
 *
 * @returns User state with access and admin status
 */
export function useExtendedUser(): ExtendedUserState {
  const clerkUser = useUser();

  // Extract stable user ID to prevent unnecessary re-renders
  const userId = useMemo(() => clerkUser.user?.id, [clerkUser.user?.id]);

  const [additionalData, setAdditionalData] = useState<{
    hasAccess: boolean;
    isAdmin: boolean;
    isLoading: boolean;
    error: string | null;
  }>({
    hasAccess: false,
    isAdmin: false,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    let isMounted = true;

    const fetchUserData = async () => {
      // Keep loading state true until Clerk is fully loaded
      if (!clerkUser.isLoaded) {
        return;
      }

      // If not signed in, set loading to false but keep access states false
      if (!clerkUser.isSignedIn) {
        if (isMounted) {
          setAdditionalData({
            hasAccess: false,
            isAdmin: false,
            isLoading: false,
            error: null,
          });
        }
        return;
      }

      try {
        const response = await fetch('/api/auth/session-check', {
          method: 'POST',
        });

        if (!response.ok) {
          throw new Error(`Session check failed: ${response.status}`);
        }

        const data = await response.json();

        if (isMounted) {
          setAdditionalData({
            hasAccess: data.hasAccess || false,
            isAdmin: data.isAdmin || false,
            isLoading: false,
            error: null,
          });
        }
      } catch (error) {
        if (isMounted) {
          setAdditionalData({
            hasAccess: false,
            isAdmin: false,
            isLoading: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    };

    fetchUserData();

    return () => {
      isMounted = false;
    };
  }, [clerkUser.isLoaded, clerkUser.isSignedIn, userId]);

  return {
    // Clerk passthrough
    isLoaded: clerkUser.isLoaded,
    isSignedIn: clerkUser.isSignedIn || false,
    user: clerkUser.user,

    // Additional data
    hasAccess: additionalData.hasAccess,
    isAdmin: additionalData.isAdmin,
    isLoading: additionalData.isLoading,
    error: additionalData.error,
  };
}

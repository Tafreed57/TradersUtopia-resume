'use client';

import { useUser } from '@clerk/nextjs';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState, useRef, useCallback } from 'react';

interface TwoFactorGuardProps {
  children: React.ReactNode;
}

export function TwoFactorGuard({ children }: TwoFactorGuardProps) {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const [is2FAChecked, setIs2FAChecked] = useState(false);
  const [requires2FA, setRequires2FA] = useState(false);
  const [lastCheckedUserId, setLastCheckedUserId] = useState<string | null>(
    null
  );

  // Use ref to prevent multiple simultaneous checks
  const isCheckingRef = useRef(false);
  const hasCheckedRef = useRef(false);

  // Skip 2FA check for auth pages and API routes
  const skipRoutes = [
    '/',
    '/api',
    '/2fa-verify',
    '/sign-in',
    '/sign-up',
    '/.well-known',
    '/favicon.ico',
    '/robots.txt',
    '/_next',
  ];

  const shouldSkip = skipRoutes.some(
    route => pathname === route || pathname?.startsWith(route + '/')
  );

  // Memoized check function to prevent recreating on every render
  const check2FA = useCallback(async () => {
    // Prevent multiple simultaneous checks
    if (isCheckingRef.current) {
      if (process.env.NODE_ENV === 'development') {
        console.log('🔄 [2FA-GUARD] Already checking, skipping...');
      }
      return;
    }

    // If already checked for this user and route, don't check again
    if (hasCheckedRef.current && lastCheckedUserId === user?.id) {
      if (process.env.NODE_ENV === 'development') {
        console.log(
          '✅ [2FA-GUARD] Already checked for this user, skipping...'
        );
      }
      return;
    }

    isCheckingRef.current = true;
    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 [2FA-GUARD] Starting 2FA check for user:', user?.id);
    }

    try {
      const response = await fetch('/api/user/profile', {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      });

      if (response.ok) {
        const profile = await response.json();

        if (profile.twoFactorEnabled) {
          console.log(
            '🔐 [2FA-GUARD] 2FA enabled, checking verification status...'
          );

          const statusResponse = await fetch('/api/2fa/status', {
            cache: 'no-store',
            headers: { 'Cache-Control': 'no-cache' },
          });

          if (statusResponse.ok) {
            const statusData = await statusResponse.json();
            console.log('📊 [2FA-GUARD] 2FA status:', statusData);

            if (!statusData.verified) {
              console.log(
                '❌ [2FA-GUARD] 2FA not verified, blocking access and redirecting...'
              );
              setRequires2FA(true);
              setIs2FAChecked(false); // Keep as false to prevent access
              setLastCheckedUserId(user?.id || null);
              hasCheckedRef.current = false; // Allow future rechecks
              isCheckingRef.current = false;
              router.push(
                `/2fa-verify?redirect=${encodeURIComponent(pathname || '/dashboard')}`
              );
              return;
            } else {
              console.log('✅ [2FA-GUARD] 2FA verified successfully');
              setRequires2FA(false);
            }
          }
        } else {
          console.log('ℹ️ [2FA-GUARD] 2FA not enabled for user');
          setRequires2FA(false);
        }
      }

      // Only mark as checked if we successfully completed the verification process
      setIs2FAChecked(true);
      setLastCheckedUserId(user?.id || null);
      hasCheckedRef.current = true;
    } catch (error) {
      console.error('❌ [2FA-GUARD] Error checking 2FA status:', error);
      // On error, allow access to prevent blocking the user
      setIs2FAChecked(true);
      setRequires2FA(false);
      setLastCheckedUserId(user?.id || null);
      hasCheckedRef.current = true;
    } finally {
      isCheckingRef.current = false;
    }
  }, [user?.id, pathname, router]);

  // Reset check state when user changes
  useEffect(() => {
    if (lastCheckedUserId !== user?.id) {
      if (process.env.NODE_ENV === 'development') {
        console.log('👤 [2FA-GUARD] User changed, resetting check state');
      }
      setIs2FAChecked(false);
      setRequires2FA(false);
      hasCheckedRef.current = false;
      isCheckingRef.current = false;
    }
  }, [user?.id, lastCheckedUserId]);

  // Main effect for 2FA checking
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('🛡️ [2FA-GUARD] Effect triggered:', {
        isLoaded,
        userId: user?.id,
        pathname,
        shouldSkip,
        is2FAChecked,
        isChecking: isCheckingRef.current,
      });
    }

    // Skip checks for auth pages
    if (shouldSkip) {
      setIs2FAChecked(true);
      setRequires2FA(false);
      return;
    }

    // If not loaded yet, wait
    if (!isLoaded) {
      return;
    }

    // If no user, allow access
    if (!user) {
      setIs2FAChecked(true);
      setRequires2FA(false);
      setLastCheckedUserId(null);
      hasCheckedRef.current = false;
      return;
    }

    // Only check if we haven't checked yet for this user
    if (!is2FAChecked && !isCheckingRef.current) {
      check2FA();
    }
  }, [isLoaded, user?.id, pathname, shouldSkip, is2FAChecked, check2FA]);

  // Listen for force recheck events
  useEffect(() => {
    const handleForceRecheck = () => {
      console.log('🔄 [2FA-GUARD] Force recheck triggered');
      setIs2FAChecked(false);
      setRequires2FA(false);
      hasCheckedRef.current = false;
      isCheckingRef.current = false;
    };

    window.addEventListener('force-2fa-recheck', handleForceRecheck);
    return () =>
      window.removeEventListener('force-2fa-recheck', handleForceRecheck);
  }, []);

  // Always skip if on auth/verification pages
  if (shouldSkip) {
    return <>{children}</>;
  }

  // Show loading while Clerk is loading
  if (!isLoaded) {
    return (
      <div className='flex items-center justify-center min-h-screen bg-gray-900'>
        <div className='text-center'>
          <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-400 mx-auto mb-4'></div>
          <div className='text-gray-300'>Loading...</div>
        </div>
      </div>
    );
  }

  // Allow access if no user (public pages)
  if (!user) {
    return <>{children}</>;
  }

  // Show checking state when actively checking 2FA
  if (isCheckingRef.current) {
    return (
      <div className='flex items-center justify-center min-h-screen bg-gray-900'>
        <div className='text-center'>
          <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-400 mx-auto mb-4'></div>
          <div className='text-gray-300'>Verifying 2FA status...</div>
        </div>
      </div>
    );
  }

  // BLOCK ACCESS: 2FA is required but not verified
  if (requires2FA) {
    console.log(
      '🚫 [2FA-GUARD] Blocking access - 2FA required but not verified'
    );
    return (
      <div className='flex items-center justify-center min-h-screen bg-gray-900'>
        <div className='text-center'>
          <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-400 mx-auto mb-4'></div>
          <div className='text-gray-300'>
            Redirecting to 2FA verification...
          </div>
        </div>
      </div>
    );
  }

  // Show loading if we haven't checked 2FA yet for this user
  if (!is2FAChecked) {
    return (
      <div className='flex items-center justify-center min-h-screen bg-gray-900'>
        <div className='text-center'>
          <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-400 mx-auto mb-4'></div>
          <div className='text-gray-300'>Checking authentication...</div>
        </div>
      </div>
    );
  }

  // Allow access - all checks passed
  console.log('✅ [2FA-GUARD] Allowing access - all checks passed');
  return <>{children}</>;
}

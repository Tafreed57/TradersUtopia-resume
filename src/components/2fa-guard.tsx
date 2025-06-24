"use client";

import { useUser } from '@clerk/nextjs';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

interface TwoFactorGuardProps {
  children: React.ReactNode;
}

export function TwoFactorGuard({ children }: TwoFactorGuardProps) {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const [is2FAChecked, setIs2FAChecked] = useState(false);
  const [requires2FA, setRequires2FA] = useState(false);
  const [lastUserId, setLastUserId] = useState<string | null>(null);

  // ✅ DEBUG: Log component rendering
  console.log('🛡️ [2FA-GUARD] Component rendered', { 
    pathname, 
    isLoaded, 
    userId: user?.id, 
    is2FAChecked, 
    requires2FA,
    lastUserId 
  });

  useEffect(() => {
    console.log('🔄 [2FA-GUARD] useEffect triggered', { isLoaded, userId: user?.id, lastUserId, pathname });
    
    // Skip 2FA check ONLY for auth pages and 2FA verify page - never skip for signed-in users
    const alwaysSkipRoutes = [
      '/2fa-verify', 
      '/sign-in', 
      '/sign-up'
    ];
    const shouldSkipAuthCheck = alwaysSkipRoutes.some(route => {
      return pathname === route || pathname.startsWith(route + '/');
    });
    
    // Always skip 2FA checks on auth pages to prevent redirect loops
    if (shouldSkipAuthCheck) {
      console.log('⏭️ [2FA-GUARD] Auth/verification page - skipping checks');
      setIs2FAChecked(true);
      setRequires2FA(false);
      return;
    }
    
    // If user is not loaded yet, wait
    if (!isLoaded) {
      console.log('⏳ [2FA-GUARD] Waiting for Clerk to load...');
      return;
    }
    
    // If no user is signed in, allow access to public pages
    if (!user) {
      console.log('👤 [2FA-GUARD] No user signed in - allowing public access');
      setIs2FAChecked(true);
      setRequires2FA(false);
      setLastUserId(null);
      return;
    }
    
    // ✅ USER IS SIGNED IN - Check 2FA immediately regardless of route
    console.log('🔐 [2FA-GUARD] User is signed in - checking 2FA status on route:', pathname);

    // ✅ SECURITY: Force re-check if user has changed (new login session)
    if (lastUserId && lastUserId !== user.id) {
      console.log('🔄 [2FA-GUARD] User session changed, forcing 2FA re-check');
      setIs2FAChecked(false);
      setRequires2FA(false);
    }
    
    // ✅ SECURITY: Force re-check if user ID has changed from null (new login)
    if (!lastUserId && user.id) {
      console.log('🆕 [2FA-GUARD] New user session detected, forcing 2FA re-check');
      setIs2FAChecked(false);
      setRequires2FA(false);
    }
    
    setLastUserId(user.id);

    const handleForceRecheck = () => {
      console.log('🔄 [2FA-GUARD] Force recheck triggered');
      setIs2FAChecked(false);
      setRequires2FA(false);
    };

    // Listen for custom event to force re-check
    window.addEventListener('force-2fa-recheck', handleForceRecheck);
    
    // ✅ SECURITY: Listen for signout events to immediately clear 2FA state
    const handleSignout = () => {
      console.log('👋 [2FA-GUARD] User signout detected, clearing 2FA state');
      setIs2FAChecked(false);
      setRequires2FA(false);
      setLastUserId(null);
    };
    
    window.addEventListener('user-signout', handleSignout);
    
    const cleanup = () => {
      window.removeEventListener('force-2fa-recheck', handleForceRecheck);
      window.removeEventListener('user-signout', handleSignout);
    };

    console.log('🔐 [2FA-GUARD] Processing 2FA check for signed-in user on route:', pathname);

    const check2FAStatus = async () => {
      try {
        console.log('🔍 [2FA-GUARD] Starting 2FA status check for user:', user.id);
        
        // Add timeout to prevent hanging
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout')), 5000)
        );

        // Check if user has 2FA enabled
        const profilePromise = fetch('/api/user/profile', {
          // Disable cache to ensure fresh data
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
          }
        });
        const profileResponse = await Promise.race([profilePromise, timeoutPromise]) as Response;
        
        if (!profileResponse.ok) {
          console.warn('⚠️ [2FA-GUARD] Failed to fetch user profile');
          setIs2FAChecked(true);
          return;
        }

        const profile = await profileResponse.json();
        console.log('👤 [2FA-GUARD] Profile 2FA status:', profile.twoFactorEnabled);

        if (profile.twoFactorEnabled) {
          // Check verification status using secure server-side API
          const statusPromise = fetch('/api/2fa/status', {
            // Disable cache to ensure fresh verification status
            cache: 'no-store',
            headers: {
              'Cache-Control': 'no-cache',
            }
          });
          const statusResponse = await Promise.race([statusPromise, timeoutPromise]) as Response;
          
          if (!statusResponse.ok) {
            console.warn('⚠️ [2FA-GUARD] Failed to fetch 2FA status');
            setIs2FAChecked(true);
            return;
          }

          const statusData = await statusResponse.json();
          console.log('🔒 [2FA-GUARD] 2FA verification status:', statusData);

          if (!statusData.verified) {
            console.log('❌ [2FA-GUARD] 2FA not verified, redirecting to verification');
            setRequires2FA(true);
            const redirectUrl = `/2fa-verify?redirect=${encodeURIComponent(pathname)}`;
            router.push(redirectUrl);
            return;
          } else {
            console.log('✅ [2FA-GUARD] 2FA verified successfully');
          }
        } else {
          console.log('ℹ️ [2FA-GUARD] 2FA not enabled for user');
        }

        setIs2FAChecked(true);
      } catch (error) {
        console.error('❌ [2FA-GUARD] Error checking 2FA status:', error);
        // On error, skip 2FA check to prevent blocking the user
        setIs2FAChecked(true);
        setRequires2FA(false);
      }
    };

    // ✅ SECURITY: Always check 2FA status on user change or route change for protected routes
    if (!is2FAChecked || lastUserId !== user.id) {
      console.log('🔒 [2FA-GUARD] Running 2FA status check - reason:', {
        notChecked: !is2FAChecked,
        userChanged: lastUserId !== user.id
      });
      check2FAStatus();
    }

    return cleanup;
  }, [isLoaded, user?.id, pathname, router, is2FAChecked]); // ✅ FIX: Removed lastUserId from deps to prevent infinite loops

  // ✅ DEBUG: Add global functions for testing (development only)
  useEffect(() => {
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
      (window as any).test2FA = {
        clearVerification: () => {
          console.log('🧪 [TEST] Clearing 2FA verification state');
          window.dispatchEvent(new CustomEvent('force-2fa-recheck'));
        },
        checkStatus: () => {
          console.log('🧪 [TEST] Current 2FA status:', {
            is2FAChecked,
            requires2FA,
            lastUserId,
            currentUserId: user?.id
          });
        },
        forceRedirect: () => {
          console.log('🧪 [TEST] Force redirecting to 2FA verification');
          router.push(`/2fa-verify?redirect=${encodeURIComponent(pathname)}`);
        }
      };
    }
  }, [is2FAChecked, requires2FA, lastUserId, user?.id, router, pathname]);

  // Don't show loading/redirect messages ONLY on auth pages
  const authRoutes = [
    '/2fa-verify', 
    '/sign-in', 
    '/sign-up'
  ];
  const isAuthPage = authRoutes.some(route => {
    return pathname === route || pathname.startsWith(route + '/');
  });

  // Show loading state while checking 2FA for signed-in users (but not on auth pages)
  if (!isAuthPage && isLoaded && user && !is2FAChecked) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Checking authentication...</div>
      </div>
    );
  }

  // Show loading while Clerk is loading (but not on auth pages)
  if (!isAuthPage && !isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  // Don't render children if 2FA verification is required (but not on auth pages)
  if (requires2FA && !isAuthPage) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Redirecting to 2FA verification...</div>
      </div>
    );
  }

  return <>{children}</>;
} 
'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { useUnifiedAuth } from '@/contexts/unified-auth-provider';
import { Loader2 } from 'lucide-react';

function AutoRouteAfterSignInClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentPath = usePathname();
  const { isLoaded, isSignedIn, user } = useUser();
  const [isAutoRouting, setIsAutoRouting] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);

  // ✅ OPTIMIZED: Use unified auth instead of making separate API call
  const { hasAccess, isLoading: authLoading, refetch } = useUnifiedAuth();

  // Check if this is an auto-route scenario
  const shouldAutoRoute = searchParams.get('auto_route') === 'true';

  useEffect(() => {
    const checkAndRoute = async () => {
      // Only auto-route if:
      // 1. User just signed in (isLoaded && isSignedIn && user)
      // 2. We have the auto_route parameter
      // 3. We haven't already checked
      // 4. We're on the homepage (to prevent loops)
      if (
        !isLoaded ||
        !isSignedIn ||
        !user ||
        !shouldAutoRoute ||
        hasChecked ||
        isAutoRouting ||
        currentPath !== '/' ||
        authLoading
      ) {
        return;
      }

      setHasChecked(true);
      setIsAutoRouting(true);

      console.log(
        '🔄 [AUTO-ROUTE] User returned from sign-in, checking subscription status...'
      );

      try {
        // ✅ OPTIMIZED: Use unified auth data instead of making API call
        // If auth data is still loading, wait a moment for it to load
        if (authLoading) {
          console.log('⏳ [AUTO-ROUTE] Waiting for auth data to load...');
          setTimeout(() => checkAndRoute(), 500);
          return;
        }

        // ✅ OPTIMIZED: Use cached auth data or force refresh if needed
        console.log(
          '⚡ [AUTO-ROUTE] Using unified auth data for routing decision'
        );

        // Route based on subscription status
        if (hasAccess) {
          console.log('✅ [AUTO-ROUTE] Access granted, routing to dashboard');
          setTimeout(() => {
            router.push('/dashboard');
          }, 1000);
        } else {
          console.log('❌ [AUTO-ROUTE] No access, routing to pricing');
          setTimeout(() => {
            router.push('/pricing');
          }, 1000);
        }
      } catch (error) {
        console.error('❌ Error in auto-route check:', error);
        setIsAutoRouting(false);
        // On error, don't redirect - let user use the button manually
      }
    };

    checkAndRoute();
  }, [
    isLoaded,
    isSignedIn,
    user,
    hasChecked,
    searchParams,
    router,
    currentPath,
    shouldAutoRoute,
    isAutoRouting,
    hasAccess,
    authLoading,
  ]);

  // Show auto-routing overlay if we're in the process
  if (isAutoRouting && shouldAutoRoute && currentPath === '/') {
    return (
      <div className='fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center'>
        <div className='bg-white dark:bg-gray-800 rounded-xl p-8 shadow-2xl max-w-md mx-4'>
          <div className='text-center'>
            <Loader2 className='w-12 h-12 animate-spin mx-auto mb-4 text-blue-500' />
            <h3 className='text-xl font-semibold mb-2 text-gray-900 dark:text-white'>
              Welcome back! 🎉
            </h3>
            <p className='text-gray-600 dark:text-gray-300 mb-4'>
              ✅ Successfully signed in
            </p>
            <p className='text-sm text-gray-500 dark:text-gray-400'>
              ⚡ Using optimized authentication cache
            </p>
            <div className='mt-4 flex items-center justify-center gap-2'>
              <div className='w-2 h-2 bg-blue-500 rounded-full animate-pulse' />
              <div className='w-2 h-2 bg-blue-500 rounded-full animate-pulse delay-75' />
              <div className='w-2 h-2 bg-blue-500 rounded-full animate-pulse delay-150' />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

export function AutoRouteAfterSignIn() {
  return <AutoRouteAfterSignInClient />;
}

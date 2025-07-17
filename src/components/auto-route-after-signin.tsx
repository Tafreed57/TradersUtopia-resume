'use client';

import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { TRADING_ALERT_PRODUCTS } from '@/lib/product-config';

function AutoRouteAfterSignInClient() {
  const { isLoaded, isSignedIn, user } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentPath =
    typeof window !== 'undefined' ? window.location.pathname : '';

  const [hasChecked, setHasChecked] = useState(false);
  const [isAutoRouting, setIsAutoRouting] = useState(false);

  // Check if auto-routing is requested
  const shouldAutoRoute = searchParams?.get('auto_route') === 'true';

  useEffect(() => {
    const checkAndRoute = async () => {
      // Only run auto-routing once and if requested
      if (!shouldAutoRoute || hasChecked || isAutoRouting) {
        return;
      }

      // Wait for Clerk to fully load
      if (!isLoaded) {
        return;
      }

      // Only run for signed-in users
      if (!isSignedIn || !user) {
        setHasChecked(true);
        return;
      }

      // Don't auto-route if we're already on dashboard or servers
      if (
        currentPath.includes('/dashboard') ||
        currentPath.includes('/servers')
      ) {
        setHasChecked(true);
        return;
      }

      setHasChecked(true);
      setIsAutoRouting(true);

      console.log(
        '🔄 [AUTO-ROUTE] Starting automatic routing check for user:',
        user.emailAddresses[0]?.emailAddress
      );
      console.log('🎯 [AUTO-ROUTE] Checking products:', TRADING_ALERT_PRODUCTS);

      try {
        // Add timeout to prevent hanging
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Auto-route timeout')), 5000)
        );

        // Check subscription status
        const productPromise = fetch('/api/check-product-subscription', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            allowedProductIds: TRADING_ALERT_PRODUCTS, // ✅ UPDATED: Use client-safe config
          }),
        });

        const productResponse = (await Promise.race([
          productPromise,
          timeoutPromise,
        ])) as Response;
        const productResult = await productResponse.json();
        console.log('📊 Auto-check subscription result:', productResult);

        // Route based on subscription status
        if (productResult.hasAccess) {
          console.log('✅ User has subscription, auto-routing to dashboard...');
          setTimeout(() => {
            router.push('/dashboard');
          }, 1000);
        } else {
          console.log('❌ User needs subscription, auto-routing to pricing...');
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
  ]);

  // Show loading state only when auto-routing is active
  if (shouldAutoRoute && isAutoRouting) {
    return (
      <div className='fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center'>
        <div className='bg-gray-900/90 backdrop-blur-md rounded-2xl p-8 border border-gray-700/50 shadow-2xl max-w-sm w-full mx-4'>
          <div className='text-center space-y-4'>
            <div className='w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto shadow-lg'>
              <div className='w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin'></div>
            </div>
            <div>
              <h3 className='text-xl font-bold text-white mb-2'>
                🔄 Setting Up Your Access
              </h3>
              <p className='text-gray-300 text-sm'>
                Checking your subscription and preparing your dashboard...
              </p>
            </div>
            <div className='flex items-center justify-center gap-1'>
              <div className='w-2 h-2 bg-blue-400 rounded-full animate-pulse'></div>
              <div className='w-2 h-2 bg-purple-400 rounded-full animate-pulse delay-100'></div>
              <div className='w-2 h-2 bg-blue-400 rounded-full animate-pulse delay-200'></div>
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

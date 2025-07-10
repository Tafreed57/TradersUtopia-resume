'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter, useSearchParams } from 'next/navigation';

function AutoRouteAfterSignInClient() {
  const { isLoaded, isSignedIn, user } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [hasChecked, setHasChecked] = useState(false);
  const [isAutoRouting, setIsAutoRouting] = useState(false);
  const [currentPath, setCurrentPath] = useState('');

  // Safely get pathname after hydration
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCurrentPath(window.location.pathname);
    }
  }, []);

  useEffect(() => {
    const checkAndRoute = async () => {
      // Only run this check once per page load and only if user is signed in
      if (!isLoaded || !isSignedIn || hasChecked) {
        return;
      }

      // Only run auto-routing when user is on the homepage
      if (currentPath !== '/') {
        console.log(
          `🚫 Auto-route: Not on homepage (current: ${currentPath}), skipping auto-routing`
        );
        setHasChecked(true);
        return;
      }

      // Check if user just came from sign-in and should be auto-routed
      const autoRoute = searchParams?.get('auto_route');
      const hasRedirectParam = searchParams?.get('redirect_url') !== null;
      const hasClerkParam = searchParams?.get('__clerk_redirect_url') !== null;
      const shouldAutoRoute =
        autoRoute === 'true' || hasRedirectParam || hasClerkParam;

      if (!shouldAutoRoute) {
        setHasChecked(true);
        return;
      }

      console.log(
        '🎯 User returned from sign-in, automatically checking subscription...'
      );
      setHasChecked(true);
      setIsAutoRouting(true);

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
            allowedProductIds: ['prod_SWIyAf2tfVrJao'],
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
  ]);

  // Show loading overlay while auto-routing
  if (isAutoRouting) {
    return (
      <div className='fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 safe-area-full'>
        <div className='bg-gray-900 rounded-lg p-8 shadow-2xl text-center'>
          <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mx-auto mb-4'></div>
          <p className='text-white font-medium'>
            Checking your subscription status...
          </p>
          <p className='text-gray-400 text-sm mt-2'>
            This will only take a moment
          </p>
        </div>
      </div>
    );
  }

  return null;
}

export function AutoRouteAfterSignIn() {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return null;
  }

  return <AutoRouteAfterSignInClient />;
}

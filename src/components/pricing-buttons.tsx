'use client';

import { Button } from './ui/button';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useExtendedUser } from '@/hooks/use-extended-user';

interface PricingButtonsProps {
  // ... existing code ...
}

export function PricingButtons(
  {
    // ... existing code ...
  }: PricingButtonsProps
) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // ✅ ENHANCED: Use extended user hook with comprehensive service data
  const {
    isSignedIn,
    user,
    hasAccess,
    subscriptionData,
    isLoading: authLoading,
  } = useExtendedUser();

  const handleFreeClick = async () => {
    setLoading(true);
    router.push('/dashboard');
  };

  const handlePremiumClick = async () => {
    setLoading(true);

    try {
      if (isSignedIn) {
        // ✅ OPTIMIZED: Use cached auth data to determine redirect
        if (hasAccess) {
          router.push('/dashboard');
        } else {
          router.push('/payment-verification');
        }
      } else {
        // Redirect to sign-up with pricing page as the redirect destination
        router.push('/sign-up?redirect_url=' + encodeURIComponent('/pricing'));
      }
    } catch (error) {
      console.error('Error in premium click:', error);
      // Fallback to sign-up with pricing page as redirect destination
      router.push('/sign-up?redirect_url=' + encodeURIComponent('/pricing'));
    } finally {
      setLoading(false);
    }
  };

  // ✅ PERFORMANCE: Show loading state while auth data loads
  const isLoadingState = loading || authLoading;

  return (
    <div className='flex flex-col sm:flex-row gap-4 justify-center items-center w-full max-w-md mx-auto'>
      <Button
        onClick={handleFreeClick}
        disabled={isLoadingState}
        variant='outline'
        size='lg'
        className='w-full sm:w-auto bg-gray-800/50 border-gray-600 text-white hover:bg-gray-700 hover:border-gray-500 min-h-[48px] px-8'
      >
        {isLoadingState ? 'Loading...' : 'View Free Content'}
      </Button>

      <Button
        onClick={handlePremiumClick}
        disabled={isLoadingState}
        size='lg'
        className='w-full sm:w-auto bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-black font-bold min-h-[48px] px-8'
      >
        {isLoadingState
          ? 'Loading...'
          : hasAccess
            ? 'Access Dashboard'
            : 'Get Premium Access'}
      </Button>

      {/* ✅ PERFORMANCE: Show optimization indicator */}
      {!isLoadingState && (
        <div className='text-xs text-gray-500 mt-2 text-center'>
          ⚡ Optimized loading
        </div>
      )}
    </div>
  );
}

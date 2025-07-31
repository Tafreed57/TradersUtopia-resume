'use client';

import { Button } from './ui/button';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useExtendedUser } from '@/hooks/use-extended-user';
import { useUser } from '@clerk/nextjs';

// Declare global Rewardful types
declare global {
  interface Window {
    rewardful: (event: string, callback: () => void) => void;
    Rewardful: {
      referral: any;
    };
  }
}

interface PricingButtonsProps {
  // ... existing code ...
}

export function PricingButtons({}: // ... existing code ...
PricingButtonsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [referral, setReferral] = useState<any | null>(null);

  // ✅ ENHANCED: Use extended user hook with comprehensive service data
  const { isSignedIn, hasAccess, isLoading: authLoading } = useExtendedUser();

  // Get user data for email access
  const { user } = useUser();

  // Initialize Rewardful integration
  useEffect(() => {
    // Check if Rewardful is available before using it
    if (typeof window !== 'undefined' && window.rewardful) {
      window.rewardful('ready', function () {
        if (window.Rewardful) {
          setReferral(window.Rewardful.referral);
        }
      });
    }
  }, []);

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
          // Direct redirect to Stripe checkout with email and referral integration
          handleStripeRedirect();
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

  const handleStripeRedirect = () => {
    const checkoutUrl = process.env.NEXT_PUBLIC_STRIPE_CHECKOUT_URL;

    if (!checkoutUrl) {
      console.error(
        'NEXT_PUBLIC_STRIPE_CHECKOUT_URL environment variable not found'
      );
      // Fallback: redirect to pricing page
      router.push('/pricing');
      return;
    }

    const userEmail = user?.emailAddresses[0]?.emailAddress;

    if (userEmail) {
      try {
        // Add prefilled_email and client_reference_id parameters to the Stripe URL
        const url = new URL(checkoutUrl);
        url.searchParams.set('locked_prefilled_email', userEmail);

        // Add client_reference_id based on referral status
        if (referral) {
          url.searchParams.set('client_reference_id', referral);
        }

        // Open in new tab with prefilled email and client reference
        window.open(url.toString(), '_blank');
      } catch (error) {
        console.error('Invalid URL:', error);
        // Fallback to original URL if there's an error
        window.open(checkoutUrl, '_blank');
      }
    } else {
      // Fallback if no email is available
      window.open(checkoutUrl, '_blank');
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
    </div>
  );
}

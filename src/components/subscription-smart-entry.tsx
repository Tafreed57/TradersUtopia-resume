'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { LogIn, Loader2, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

interface SubscriptionSmartEntryProps {
  customContent?: string;
}

export function SubscriptionSmartEntry({
  customContent,
}: SubscriptionSmartEntryProps) {
  const { isSignedIn, isLoaded } = useAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [hasSubscription, setHasSubscription] = useState<boolean | null>(null);
  const [hasChecked, setHasChecked] = useState(false);

  // Check subscription status when user loads - ONLY ONCE
  useEffect(() => {
    if (isLoaded && isSignedIn && !hasChecked) {
      checkSubscriptionStatus();
    }
  }, [isLoaded, isSignedIn, hasChecked]);

  const checkSubscriptionStatus = async () => {
    setHasChecked(true); // Mark as checked immediately to prevent re-runs

    try {
      const response = await fetch('/api/check-product-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          allowedProductIds: ['prod_SWIyAf2tfVrJao'],
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setHasSubscription(result.hasAccess);
      } else {
        setHasSubscription(false);
      }
    } catch (error) {
      console.error('❌ Error checking subscription:', error);
      setHasSubscription(false);
    }
  };

  const handleClick = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setIsLoading(true);

    if (!isLoaded) {
      return;
    }

    if (!isSignedIn) {
      router.push('/sign-up');
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/subscription/check');
      if (!response.ok) {
        throw new Error('Subscription check failed');
      }

      const data = await response.json();
      if (data.hasAccess) {
        // User has an active subscription, ensure they are in the server
        const serverResponse = await fetch('/api/servers/ensure-default', {
          method: 'POST',
        });
        const serverData = await serverResponse.json();
        if (serverData.success) {
          router.push(`/servers/${serverData.server.id}`);
        } else {
          throw new Error('Failed to access server');
        }
      } else {
        router.push('/pricing');
      }
    } catch (error: any) {
      toast.error('An error occurred', {
        description: error.message || 'Please try again later.',
      });
      // Fallback to pricing page on any error
      router.push('/pricing');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isLoaded || (!hasChecked && isSignedIn)) {
    return (
      <Button
        size='lg'
        disabled
        className='bg-gradient-to-r from-yellow-500 to-yellow-600 text-black px-6 sm:px-8 md:px-12 py-4 sm:py-6 text-lg sm:text-xl font-bold rounded-lg opacity-50 border border-yellow-400/50 w-full sm:w-auto'
      >
        <Loader2 className='h-4 h-4 sm:h-5 sm:w-5 animate-spin mr-2' />
        <span className='hidden xs:inline'>Checking access...</span>
        <span className='xs:hidden'>Loading...</span>
      </Button>
    );
  }

  const buttonText =
    customContent ||
    (!isSignedIn
      ? 'Access Trading Platform'
      : hasSubscription
        ? 'Access Trading Platform'
        : 'Get Access - View Pricing');

  const buttonClass = !isSignedIn
    ? 'bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-black border border-yellow-400/50'
    : hasSubscription
      ? 'bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white border border-green-500/50'
      : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white border border-blue-500/50';

  return (
    <Button
      size='lg'
      onClick={handleClick}
      disabled={isLoading}
      className={`${buttonClass} px-6 sm:px-8 md:px-12 py-4 sm:py-6 text-lg sm:text-xl font-bold rounded-lg transition-all duration-200 transform hover:scale-105 shadow-2xl disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none w-full sm:w-auto`}
    >
      {isLoading ? (
        <div className='flex items-center gap-2'>
          <Loader2 className='h-4 h-4 sm:h-5 sm:w-5 animate-spin' />
          <span className='hidden sm:inline'>
            {!isSignedIn
              ? 'Redirecting...'
              : hasSubscription
                ? 'Accessing Trading Platform...'
                : 'Loading Pricing...'}
          </span>
          <span className='sm:hidden'>Loading...</span>
        </div>
      ) : (
        <div className='flex items-center gap-2'>
          {!isSignedIn ? (
            <LogIn className='h-4 h-4 sm:h-5 sm:w-5' />
          ) : (
            <ChevronRight className='h-4 h-4 sm:h-5 sm:w-5' />
          )}
          <span className='hidden sm:inline'>{buttonText}</span>
          <span className='sm:hidden'>
            {!isSignedIn
              ? 'Access Platform'
              : hasSubscription
                ? 'Access Platform'
                : 'View Pricing'}
          </span>
        </div>
      )}
    </Button>
  );
}

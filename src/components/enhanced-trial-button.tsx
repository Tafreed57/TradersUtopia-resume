'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ExternalLink, CheckCircle, Loader2, ArrowRight } from 'lucide-react';
import { useUser } from '@clerk/nextjs';

interface EnhancedTrialButtonProps {
  isSignedIn?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function EnhancedTrialButton({
  isSignedIn = false,
  className = '',
  children,
}: EnhancedTrialButtonProps) {
  const router = useRouter();
  const { user } = useUser();
  const [isProcessing, setIsProcessing] = useState(false);
  const [subscriptionData, setSubscriptionData] = useState<any>(null);
  const [checkingStatus, setCheckingStatus] = useState(true);

  useEffect(() => {
    async function checkSubscription() {
      if (!user) {
        setCheckingStatus(false);
        return;
      }

      try {
        const response = await fetch('/api/check-payment-status');
        const data = await response.json();
        setSubscriptionData(data);
      } catch (error) {
        console.error('Error checking subscription:', error);
        // If check fails, assume no subscription
        setSubscriptionData({
          hasAccess: false,
          status: 'ERROR',
          canStartTrial: false,
        });
      } finally {
        setCheckingStatus(false);
      }
    }

    checkSubscription();
  }, [user]);

  const handleSubscribeClick = () => {
    setIsProcessing(true);

    // If user has subscription, go to dashboard
    if (subscriptionData?.hasAccess) {
      console.log('✅ User has subscription, redirecting to dashboard...');
      router.push('/dashboard');
      return;
    }

    // If user doesn't have subscription, go to payment verification page
    console.log(
      '❌ User has no subscription, redirecting to payment verification page...'
    );
    router.push('/payment-verification');
  };

  // Show loading state while checking subscription
  if (checkingStatus) {
    return (
      <Button
        size='lg'
        disabled
        className={`w-full bg-gray-600 text-white py-3 sm:py-4 text-base sm:text-lg font-semibold rounded-lg sm:rounded-full transition-all duration-200 touch-manipulation min-h-[44px] ${className}`}
      >
        <div className='flex items-center gap-2'>
          <Loader2 className='h-4 w-4 sm:h-5 sm:w-5 animate-spin' />
          <span>Checking Status...</span>
        </div>
      </Button>
    );
  }

  // If user has active subscription, show "Go to Dashboard" button
  if (subscriptionData?.hasAccess) {
    return (
      <Button
        size='lg'
        onClick={handleSubscribeClick}
        disabled={isProcessing}
        className={`w-full bg-blue-600 hover:bg-blue-700 text-white py-3 sm:py-4 text-base sm:text-lg font-semibold rounded-lg sm:rounded-full transition-all duration-200 transform hover:scale-105 shadow-xl disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none touch-manipulation min-h-[44px] ${className}`}
      >
        {isProcessing ? (
          <div className='flex items-center gap-2'>
            <Loader2 className='h-4 w-4 sm:h-5 sm:w-5 animate-spin' />
            <span>Loading...</span>
          </div>
        ) : (
          <div className='flex items-center gap-2'>
            <ArrowRight className='h-4 w-4 sm:h-5 sm:w-5' />
            <span>Go to Dashboard</span>
          </div>
        )}
      </Button>
    );
  }

  // If user doesn't have subscription, show "Subscribe Now" button that goes to payment verification page
  return (
    <Button
      size='lg'
      onClick={handleSubscribeClick}
      disabled={isProcessing}
      className={`w-full bg-green-600 hover:bg-green-700 text-white py-3 sm:py-4 text-base sm:text-lg font-semibold rounded-lg sm:rounded-full transition-all duration-200 transform hover:scale-105 shadow-xl disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none touch-manipulation min-h-[44px] ${className}`}
    >
      {isProcessing ? (
        <div className='flex items-center gap-2'>
          <Loader2 className='h-4 w-4 sm:h-5 sm:w-5 animate-spin' />
          <span>Loading...</span>
        </div>
      ) : (
        <div className='flex items-center gap-2'>
          <ExternalLink className='h-4 w-4 sm:h-5 sm:w-5' />
          <span>{children}</span>
        </div>
      )}
    </Button>
  );
}

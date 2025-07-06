'use client';

import { Button } from './ui/button';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useAuth, useUser } from '@clerk/nextjs';

interface PricingButtonsProps {
  // ... existing code ...
}

export function PricingButtons(
  {
    // ... existing code ...
  }: PricingButtonsProps
) {
  const { isSignedIn } = useAuth();
  const { user } = useUser();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [subscriptionData, setSubscriptionData] = useState<any>(null);
  const [checkingStatus, setCheckingStatus] = useState(true);

  useEffect(() => {
    async function checkSubscription() {
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

    if (user) {
      checkSubscription();
    } else {
      setCheckingStatus(false);
    }
  }, [user]);

  const handleFreeClick = async () => {
    setLoading(true);

    if (isSignedIn) {
      router.push('/dashboard');
    } else {
      router.push('/sign-up');
    }
  };

  const handleSubscribeClick = () => {
    setLoading(true);

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

  const handleBuyNow = () => {
    router.push('/checkout');
  };

  if (checkingStatus) {
    return (
      <div className='space-y-4'>
        <Button
          size='lg'
          className='w-full bg-gray-600 text-white py-4 text-lg font-semibold rounded-full'
          disabled
        >
          Checking status...
        </Button>
      </div>
    );
  }

  // User has active subscription
  if (subscriptionData?.hasAccess) {
    return (
      <div className='space-y-4'>
        <Button
          size='lg'
          onClick={() => router.push('/dashboard')}
          className='w-full bg-blue-600 hover:bg-blue-700 text-white py-4 text-lg font-semibold rounded-full transition-all duration-200 transform hover:scale-105 shadow-xl'
        >
          Go to Dashboard
        </Button>
        <p className='text-green-400 text-sm text-center'>
          ✅ You have access to Traders Utopia
        </p>
      </div>
    );
  }

  // User doesn't have subscription - show subscribe button that goes to payment verification page
  return (
    <div className='space-y-4'>
      <Button
        size='lg'
        onClick={handleSubscribeClick}
        disabled={loading}
        className='w-full bg-green-600 hover:bg-green-700 text-white py-4 text-lg font-semibold rounded-full transition-all duration-200 transform hover:scale-105 shadow-xl'
      >
        {loading ? 'Loading...' : 'Subscribe Now'}
      </Button>
      <Button
        size='lg'
        onClick={handleBuyNow}
        variant='outline'
        className='w-full border-white/30 text-white hover:bg-white/10 py-4 text-lg font-semibold rounded-full'
      >
        Buy Now - $149.99/month
      </Button>
      <p className='text-gray-400 text-sm text-center'>
        Complete payment verification to access your subscription
      </p>
    </div>
  );
}

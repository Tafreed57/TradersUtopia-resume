'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useExtendedUser } from '@/hooks/use-extended-user';

import { CheckCircle, Crown, Star, Loader2 } from 'lucide-react';
import { SmartEntryButton } from '@/components/smart-entry-button';

// Declare global Rewardful types
declare global {
  interface Window {
    rewardful: (event: string, callback: () => void) => void;
    Rewardful: {
      referral: any;
    };
  }
}

interface ComprehensivePricingSectionProps {
  isSignedIn: boolean;
}

export function ComprehensivePricingSection({
  isSignedIn,
}: ComprehensivePricingSectionProps) {
  const { user } = useUser();
  const router = useRouter();
  const [subscriptionData, setSubscriptionData] = useState<any>(null);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [loading, setLoading] = useState(false);
  const [referral, setReferral] = useState<any | null>(null);

  // ✅ ENHANCED: Use extended user hook with comprehensive service data
  const { hasAccess, isLoading: authLoading } = useExtendedUser();

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

  useEffect(() => {
    async function checkSubscription() {
      if (!user) {
        setCheckingStatus(false);
        return;
      }

      try {
        const response = await fetch('/api/subscription?status=true');
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

        // Open on the same page with prefilled email and client reference
        window.location.href = url.toString();
      } catch (error) {
        console.error('Invalid URL:', error);
        // Fallback to original URL if there's an error
        window.location.href = checkoutUrl;
      }
    } else {
      // Fallback if no email is available
      window.location.href = checkoutUrl;
    }
  };

  const handlePremiumAccessClick = async () => {
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

  // ✅ PERFORMANCE: Show loading state while auth data loads
  const isLoadingState = loading || authLoading;

  // Show loading state while checking subscription for signed-in users
  if (isSignedIn && checkingStatus) {
    return (
      <div className='bg-gradient-to-br from-gray-800/80 via-gray-800/60 to-gray-900/80 backdrop-blur-md rounded-2xl sm:rounded-3xl p-6 sm:p-8 lg:p-10 max-w-4xl w-full border border-gray-600/30 shadow-2xl'>
        <div className='text-center py-8'>
          <Loader2 className='w-8 h-8 animate-spin mx-auto mb-4 text-blue-400' />
          <p className='text-gray-300'>Checking your membership status...</p>
        </div>
      </div>
    );
  }

  return (
    <div className='bg-gradient-to-br from-gray-800/80 via-gray-800/60 to-gray-900/80 backdrop-blur-md rounded-2xl sm:rounded-3xl p-6 sm:p-8 lg:p-10 max-w-4xl w-full border border-gray-600/30 shadow-2xl hover:shadow-3xl transition-all duration-500 hover:border-yellow-400/50'>
      {/* Membership Status Banner - Show for signed-in users with subscription */}
      {isSignedIn && subscriptionData?.hasAccess && (
        <div className='bg-gradient-to-r from-green-600/20 to-emerald-600/20 border border-green-400/30 rounded-xl p-4 sm:p-6 mb-6 sm:mb-8'>
          <div className='flex items-center gap-4'>
            <div className='w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center flex-shrink-0'>
              <Star className='w-6 h-6 text-green-400' />
            </div>
            <div className='flex-1'>
              <h3 className='text-green-300 font-bold text-lg sm:text-xl mb-1'>
                ✅ Active Membership
              </h3>
              <p className='text-green-200 text-sm sm:text-base'>
                You already have access to Traders Utopia premium features!
              </p>
            </div>
            <SmartEntryButton className='bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-semibold transition-all duration-200 hover:scale-105' />
          </div>
        </div>
      )}

      {/* Card Header - Mobile-First */}
      <div className='text-center mb-8 sm:mb-12'>
        <div className='flex items-center justify-center mb-4 sm:mb-6'>
          <div className='w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-yellow-400 via-yellow-500 to-orange-500 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-2xl'>
            <Crown className='w-8 h-8 sm:w-10 sm:h-10 text-black' />
          </div>
        </div>

        <h2 className='text-xl xs:text-2xl sm:text-3xl md:text-4xl font-bold mb-4 sm:mb-6 px-2'>
          <span className='bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent'>
            🌟 Premium Trading Alerts
          </span>
        </h2>

        <div className='text-3xl xs:text-4xl sm:text-5xl md:text-6xl font-bold mb-3 sm:mb-4'>
          <span className='bg-gradient-to-r from-white to-gray-200 bg-clip-text text-transparent'>
            $149.99
          </span>
          <span className='text-base sm:text-lg md:text-xl text-gray-400 font-normal'>
            /month
          </span>
        </div>

        <button
          onClick={handlePremiumAccessClick}
          disabled={isLoadingState}
          className='inline-flex items-center gap-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed px-4 sm:px-6 py-2 sm:py-3 rounded-full text-sm sm:text-base transition-all duration-200 hover:scale-105 hover:shadow-lg cursor-pointer'
        >
          <CheckCircle className='w-4 h-4 sm:w-5 sm:h-5' />
          <span className='font-semibold'>
            {isLoadingState ? 'Loading...' : 'Get Premium Access'}
          </span>
        </button>
      </div>

      {/* Enhanced Features List - Mobile-Optimized */}
      <div className='grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-8 sm:mb-12'>
        <div className='space-y-4 sm:space-y-6'>
          <div className='flex items-start gap-3 sm:gap-4 p-4 sm:p-6 bg-gradient-to-r from-blue-600/20 to-blue-700/20 rounded-xl sm:rounded-2xl border border-blue-400/30 hover:border-blue-400/50 transition-all duration-300 hover:shadow-lg hover:shadow-blue-400/20 touch-manipulation'>
            <div className='w-10 h-10 sm:w-12 sm:h-12 bg-blue-500/20 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0'>
              <span className='text-xl sm:text-2xl'>📈</span>
            </div>
            <div>
              <p className='text-white font-semibold text-base sm:text-lg mb-1 sm:mb-2'>
                Real-Time Swing Trade Alerts
              </p>
              <p className='text-blue-200 text-xs sm:text-sm'>
                Only high-probability setups, no spam
              </p>
            </div>
          </div>

          <div className='flex items-start gap-4 p-6 bg-gradient-to-r from-purple-600/20 to-purple-700/20 rounded-2xl border border-purple-400/30 hover:border-purple-400/50 transition-all duration-300 hover:shadow-lg hover:shadow-purple-400/20'>
            <div className='w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center flex-shrink-0'>
              <span className='text-2xl'>💎</span>
            </div>
            <div>
              <p className='text-white font-semibold text-lg mb-2'>
                Bonus Investing Alerts
              </p>
              <p className='text-purple-200 text-sm'>
                Targeting 30–50%+ returns with long-term plays
              </p>
            </div>
          </div>

          <div className='flex items-start gap-4 p-6 bg-gradient-to-r from-green-600/20 to-green-700/20 rounded-2xl border border-green-400/30 hover:border-green-400/50 transition-all duration-300 hover:shadow-lg hover:shadow-green-400/20'>
            <div className='w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center flex-shrink-0'>
              <span className='text-2xl'>🎙️</span>
            </div>
            <div>
              <p className='text-white font-semibold text-lg mb-2'>
                Live Daily Classes
              </p>
              <p className='text-green-200 text-sm'>
                Monday to Friday, 9:00–9:30 PM EST, hosted in live voice chat
                sessions
              </p>
            </div>
          </div>
        </div>

        <div className='space-y-6'>
          <div className='flex items-start gap-4 p-6 bg-gradient-to-r from-orange-600/20 to-orange-700/20 rounded-2xl border border-orange-400/30 hover:border-orange-400/50 transition-all duration-300 hover:shadow-lg hover:shadow-orange-400/20'>
            <div className='w-12 h-12 bg-orange-500/20 rounded-xl flex items-center justify-center flex-shrink-0'>
              <span className='text-2xl'>🔒</span>
            </div>
            <div>
              <p className='text-white font-semibold text-lg mb-2'>
                Private Access Channels
              </p>
              <p className='text-orange-200 text-sm'>
                Get alerts and insights that free members can't see
              </p>
            </div>
          </div>

          <div className='flex items-start gap-4 p-6 bg-gradient-to-r from-teal-600/20 to-teal-700/20 rounded-2xl border border-teal-400/30 hover:border-teal-400/50 transition-all duration-300 hover:shadow-lg hover:shadow-teal-400/20'>
            <div className='w-12 h-12 bg-teal-500/20 rounded-xl flex items-center justify-center flex-shrink-0'>
              <span className='text-2xl'>🤝</span>
            </div>
            <div>
              <p className='text-white font-semibold text-lg mb-2'>
                Supportive Network
              </p>
              <p className='text-teal-200 text-sm'>
                Learn from experienced traders and level up faster
              </p>
            </div>
          </div>

          <div className='flex items-start gap-4 p-6 bg-gradient-to-r from-indigo-600/20 to-indigo-700/20 rounded-2xl border border-indigo-400/30 hover:border-indigo-400/50 transition-all duration-300 hover:shadow-lg hover:shadow-indigo-400/20'>
            <div className='w-12 h-12 bg-indigo-500/20 rounded-xl flex items-center justify-center flex-shrink-0'>
              <span className='text-2xl'>🌐</span>
            </div>
            <div>
              <p className='text-white font-semibold text-lg mb-2'>
                Community Only Resources
              </p>
              <p className='text-indigo-200 text-sm'>
                Exclusive tools, discussions, and education
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Mail, AlertTriangle, ExternalLink } from 'lucide-react';
import { useUser } from '@clerk/nextjs';
import { BaseModal } from './base';
import { useStore } from '@/store/store';

// Declare global Rewardful types
declare global {
  interface Window {
    rewardful: (event: string, callback: () => void) => void;
    Rewardful: {
      referral: any;
    };
  }
}

export function EmailWarningModal() {
  const { user } = useUser();
  const [hasConfirmed, setHasConfirmed] = useState(false);
  const [referral, setReferral] = useState<any | null>(null);

  const data = useStore(state => state.data);
  const stripeUrl = data.stripeUrl || '';

  const userEmail = user?.emailAddresses[0]?.emailAddress;

  const handleProceed = () => {
    if (stripeUrl && userEmail) {
      try {
        // Add prefilled_email and client_reference_id parameters to the Stripe URL
        const url = new URL(stripeUrl);
        url.searchParams.set('prefilled_email', userEmail);

        // Add client_reference_id based on referral status
        if (referral) {
          url.searchParams.set('client_reference_id', referral.id);
        }

        // open in new tab with prefilled email and client reference
        window.open(url.toString(), '_blank');
      } catch (error) {
        console.error('Invalid URL:', error);
        // Fallback to original URL if there's an error
        window.open(stripeUrl, '_blank');
      }
    } else if (stripeUrl) {
      // Fallback if no email is available
      window.open(stripeUrl, '_blank');
    }
  };

  useEffect(() => {
    // Check if Rewardful is available before using it
    if (typeof window !== 'undefined' && window.rewardful) {
      window.rewardful('ready', function () {
        if (window.Rewardful) {
          setReferral(window.Rewardful.referral);
        }
        console.log('Referral:', window.Rewardful.referral);
      });
      console.log('Referral:', window.Rewardful.referral);
    }
  }, []);

  return (
    <BaseModal
      type='emailWarning'
      title='⚠️ CRITICAL: Email Address Match Required'
      description='This is extremely important for your account security and access.'
      className='max-w-[92vw] sm:max-w-lg max-h-[92vh] bg-gradient-to-br from-gray-800/95 via-gray-800/90 to-gray-900/95 backdrop-blur-md border border-gray-600/40 text-white'
      size='lg'
    >
      <div className='space-y-3 sm:space-y-4 text-center mb-6'>
        <div className='w-16 h-16 bg-gradient-to-br from-yellow-400 via-orange-500 to-red-500 rounded-2xl flex items-center justify-center mx-auto shadow-2xl'>
          <AlertTriangle className='w-8 h-8 text-black' />
        </div>
      </div>

      <div className='space-y-4 sm:space-y-6'>
        {/* Current Account Email */}
        <div className='bg-blue-600/20 border border-blue-400/40 rounded-lg sm:rounded-xl p-3 sm:p-4'>
          <div className='flex items-center gap-2 sm:gap-3 mb-2'>
            <Mail className='w-4 h-4 sm:w-5 sm:h-5 text-blue-400 flex-shrink-0' />
            <span className='text-blue-300 font-semibold text-sm sm:text-base'>
              Your Trader Utopia Email:
            </span>
          </div>
          <div className='bg-blue-900/30 rounded-lg p-2 sm:p-3 border border-blue-500/30'>
            <p className='text-white font-mono text-xs sm:text-sm break-all leading-relaxed'>
              {userEmail || 'Email not found'}
            </p>
          </div>
        </div>

        {/* Single Warning */}
        <Alert className='border-yellow-500/40 bg-yellow-600/20 p-4 sm:p-6'>
          <AlertTriangle className='h-5 w-5 text-yellow-400 flex-shrink-0' />
          <AlertDescription className='text-yellow-100 font-medium text-sm sm:text-base'>
            <p className='text-center leading-relaxed'>
              Please use the <strong>same email address</strong> you used to
              sign up on Trader Utopia when checking out with Stripe to ensure
              your subscription is properly linked to your account.
            </p>
          </AlertDescription>
        </Alert>

        {/* Confirmation Checkbox */}
        <div className='bg-green-600/20 border border-green-400/40 rounded-lg sm:rounded-xl p-3 sm:p-4'>
          <label className='flex items-start gap-2 sm:gap-3 cursor-pointer group touch-manipulation'>
            <input
              type='checkbox'
              checked={hasConfirmed}
              onChange={e => setHasConfirmed(e.target.checked)}
              className='mt-1 w-5 h-5 text-green-500 rounded border-2 border-green-400 focus:ring-green-500 focus:ring-2 bg-transparent flex-shrink-0'
            />
            <div className='flex-1 min-w-0'>
              <p className='text-green-200 font-medium group-hover:text-green-100 transition-colors text-xs sm:text-sm leading-relaxed'>
                I will use the same email address ({''}
                <span className='font-mono bg-green-900/40 px-1 sm:px-2 py-1 rounded text-green-100 text-xs sm:text-sm break-all'>
                  {userEmail}
                </span>
                ) when checking out
              </p>
            </div>
          </label>
        </div>

        {/* Action Button */}
        <div className='flex flex-col gap-2 sm:gap-3 w-full'>
          {referral ? (
            <input type='hidden' name='referral' value={referral} />
          ) : null}
          <Button
            onClick={handleProceed}
            disabled={!hasConfirmed}
            data-rewardful
            className='w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold py-3 transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none touch-manipulation min-h-[48px] active:scale-95'
          >
            <div className='flex items-center justify-center gap-2 px-2'>
              <ExternalLink className='w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0' />
              <span className='text-xs sm:text-sm font-medium leading-tight text-center'>
                Proceed to Checkout
              </span>
            </div>
          </Button>
        </div>
      </div>
    </BaseModal>
  );
}

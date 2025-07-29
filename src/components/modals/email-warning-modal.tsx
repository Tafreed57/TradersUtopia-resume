'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Mail, AlertTriangle, CheckCircle, ExternalLink } from 'lucide-react';
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

interface EmailWarningModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmProceed: () => void;
  stripeUrl: string;
}

export function EmailWarningModal({
  isOpen,
  onClose,
  onConfirmProceed,
  stripeUrl,
}: EmailWarningModalProps) {
  const { user } = useUser();
  const [hasConfirmed, setHasConfirmed] = useState(false);
  const [referral, setReferral] = useState(null);

  const userEmail = user?.emailAddresses[0]?.emailAddress;

  const handleProceed = () => {
    onConfirmProceed();
    onClose();
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
    }
  }, []);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className='max-w-[92vw] sm:max-w-lg max-h-[92vh] bg-gradient-to-br from-gray-800/95 via-gray-800/90 to-gray-900/95 backdrop-blur-md border border-gray-600/40 text-white rounded-xl sm:rounded-2xl p-4 sm:p-6 overflow-y-auto fixed top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%] z-50'>
        <DialogHeader className='space-y-3 sm:space-y-4 text-center'>
          <div className='w-16 h-16 bg-gradient-to-br from-yellow-400 via-orange-500 to-red-500 rounded-2xl flex items-center justify-center mx-auto shadow-2xl'>
            <AlertTriangle className='w-8 h-8 text-black' />
          </div>

          <DialogTitle className='text-lg sm:text-xl lg:text-2xl font-bold text-center leading-tight'>
            <span className='bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent'>
              ⚠️ CRITICAL: Email Address Match Required
            </span>
          </DialogTitle>

          <DialogDescription className='text-gray-300 text-sm sm:text-base leading-relaxed px-2 sm:px-0'>
            This is extremely important for your account security and access.
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4 sm:space-y-6'>
          {/* Current Account Email */}
          <div className='bg-blue-600/20 border border-blue-400/40 rounded-lg sm:rounded-xl p-3 sm:p-4'>
            <div className='flex items-center gap-2 sm:gap-3 mb-2'>
              <Mail className='w-4 h-4 sm:w-5 sm:h-5 text-blue-400 flex-shrink-0' />
              <span className='text-blue-300 font-semibold text-sm sm:text-base'>
                Your Current Account Email:
              </span>
            </div>
            <div className='bg-blue-900/30 rounded-lg p-2 sm:p-3 border border-blue-500/30'>
              <p className='text-white font-mono text-xs sm:text-sm break-all leading-relaxed'>
                {userEmail || 'Email not found'}
              </p>
            </div>
          </div>

          {/* Warning Alert */}
          <Alert className='border-red-500/40 bg-red-600/20 p-3 sm:p-4'>
            <AlertTriangle className='h-4 w-4 sm:h-5 sm:w-5 text-red-400 flex-shrink-0' />
            <AlertDescription className='text-red-200 font-medium text-sm sm:text-base'>
              <div className='space-y-2'>
                <p className='font-bold text-red-100 text-sm sm:text-base'>
                  YOU MUST USE THE EXACT SAME EMAIL ADDRESS
                </p>
                <p className='text-xs sm:text-sm leading-relaxed'>
                  When you complete your payment in Stripe, use:{' '}
                  <span className='font-mono bg-red-900/40 px-1 sm:px-2 py-1 rounded text-red-100 text-xs sm:text-sm break-all'>
                    {userEmail}
                  </span>
                </p>
              </div>
            </AlertDescription>
          </Alert>

          {/* Why This Matters */}
          <div className='bg-gray-700/40 border border-gray-600/30 rounded-lg sm:rounded-xl p-3 sm:p-4'>
            <h4 className='text-white font-semibold mb-2 sm:mb-3 flex items-center gap-2 text-sm sm:text-base'>
              <CheckCircle className='w-4 h-4 sm:w-5 sm:h-5 text-green-400 flex-shrink-0' />
              Why This Is Critical:
            </h4>
            <ul className='space-y-1 sm:space-y-2 text-xs sm:text-sm text-gray-300'>
              <li className='flex items-start gap-2'>
                <span className='text-red-400 font-bold mt-0.5 flex-shrink-0'>
                  •
                </span>
                <span className='leading-relaxed'>
                  Different emails = No access to your servers
                </span>
              </li>
              <li className='flex items-start gap-2'>
                <span className='text-red-400 font-bold mt-0.5 flex-shrink-0'>
                  •
                </span>
                <span className='leading-relaxed'>
                  Your subscription won't link to your account
                </span>
              </li>
              <li className='flex items-start gap-2'>
                <span className='text-red-400 font-bold mt-0.5 flex-shrink-0'>
                  •
                </span>
                <span className='leading-relaxed'>
                  You'll lose access to all your data
                </span>
              </li>
              <li className='flex items-start gap-2'>
                <span className='text-green-400 font-bold mt-0.5 flex-shrink-0'>
                  •
                </span>
                <span className='leading-relaxed'>
                  Same email = Instant access after payment
                </span>
              </li>
            </ul>
          </div>

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
                  ✅ I understand and confirm I will use the email:{' '}
                  <span className='font-mono bg-green-900/40 px-1 sm:px-2 py-1 rounded text-green-100 text-xs sm:text-sm break-all'>
                    {userEmail}
                  </span>{' '}
                  when paying in Stripe
                </p>
              </div>
            </label>
          </div>

          {/* Action Buttons */}
          <div className='flex flex-col gap-2 sm:gap-3 w-full'>
            <Button
              variant='outline'
              onClick={onClose}
              className='w-full border-gray-500 text-gray-300 hover:bg-gray-700/50 hover:text-white transition-all duration-300 py-3 touch-manipulation min-h-[48px] text-sm sm:text-base'
            >
              Cancel
            </Button>
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
                <span className='text-xs sm:text-sm font-medium leading-tight text-center whitespace-nowrap'>
                  <span className='block sm:hidden'>Proceed to Payment</span>
                  <span className='hidden sm:block'>
                    I Understand - Proceed to Payment
                  </span>
                </span>
              </div>
            </Button>
          </div>

          {/* Final Reminder */}
          <div className='text-center text-xs sm:text-sm text-gray-400 bg-gray-800/50 p-2 sm:p-3 rounded-lg border border-gray-600/30'>
            <p className='font-medium text-gray-300 mb-1 text-xs sm:text-sm'>
              🔒 Remember
            </p>
            <p className='leading-relaxed'>
              Use the SAME email in Stripe for instant access after payment
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

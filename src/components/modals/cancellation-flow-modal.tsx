'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertTriangle,
  CheckCircle,
  DollarSign,
  Flame,
  ArrowLeft,
  X,
  Clock,
  DollarSign as Dollar,
  Frown,
  TrendingUp,
  HelpCircle,
  Heart,
  Loader2,
} from 'lucide-react';
import { showToast } from '@/lib/notifications-client';
import { makeSecureRequest } from '@/lib/csrf-client';

interface CancellationFlowModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (action: 'cancelled' | 'retained' | 'discounted') => void;
  subscription?: {
    status: string;
    productId: string;
    customerId: string;
    subscriptionStart: string;
    subscriptionEnd: string;
    product?: {
      id: string;
      name: string;
      description: string;
      images: string[];
    };
    stripe?: {
      id: string;
      status: string;
      currentPeriodStart: string;
      currentPeriodEnd: string;
      cancelAtPeriodEnd: boolean;
      autoRenew: boolean;
      amount: number;
      originalAmount?: number;
      currency: string;
      interval: string;
      hasDiscount?: boolean;
      discountPercent?: number;
      discountAmount?: number;
      discountDetails?: {
        id: string;
        name: string;
        percentOff: number;
        amountOff: number;
        duration: string;
        valid: boolean;
      };
    };
    customer?: {
      id: string;
      email: string;
      created: string;
    };
  };
}

type CancellationStep =
  | 'reason'
  | 'retention'
  | 'price'
  | 'final-offer'
  | 'password';

interface CancellationReason {
  id: string;
  text: string;
  icon: React.ReactNode;
  retentionMessage: {
    title: string;
    content: string;
  };
}

const cancellationReasons: CancellationReason[] = [
  {
    id: 'nevermind',
    text: 'Never mind, I decided to stay',
    icon: <Heart className='w-5 h-5' />,
    retentionMessage: {
      title: 'Great choice!',
      content:
        "We're so glad you're staying with us. You're making the right decision to continue your journey towards financial success!",
    },
  },
  {
    id: 'no-time',
    text: "I don't have enough time",
    icon: <Clock className='w-5 h-5' />,
    retentionMessage: {
      title: "Good news — you don't need much time at all.",
      content:
        "This isn't day trading. These are swing trades built specifically for people with full-time jobs.\n\nMost members spend just 5-15 minutes a month copying alerts — and even if you're a little late to enter, it's fine. We look for big moves and often hold positions for weeks or even months.\n\nYou get exact entries, exits, and updates. No overthinking. No screen-watching.\n\nTruth is, saying \"I don't have time\" is just an excuse. Even Elon Musk could make time for this.",
    },
  },
  {
    id: 'cant-afford',
    text: "I can't afford it",
    icon: <Dollar className='w-5 h-5' />,
    retentionMessage: {
      title: 'This is exactly why you need to stay!',
      content:
        "If you can't afford our service, you definitely can't afford to NOT have multiple income streams. This is your path to financial freedom - don't let a temporary budget constraint stop your long-term wealth building.",
    },
  },
  {
    id: 'not-ready',
    text: "I'm not ready yet",
    icon: <Frown className='w-5 h-5' />,
    retentionMessage: {
      title: "Let's be real...",
      content:
        "Let me be real with you — 'I'm not ready yet' is just another excuse.\n\nThis isn't rocket science. You're not building a business from scratch — you're getting trade alerts.\n\nIf you don't know how to use them, we've got tutorial videos that walk you through everything step-by-step.\n\nYou don't need to be 'ready.' You just need to stop hesitating.\n\nMost people who say this stay stuck for years... or forever.",
    },
  },
  {
    id: 'already-make-money',
    text: 'I already make money',
    icon: <TrendingUp className='w-5 h-5' />,
    retentionMessage: {
      title: 'Hold Up...',
      content:
        "If you already make money, then why the hell did you sign up in the first place?\n\nLet's be real — people who are actually winning don't cancel a service designed to help them win more.\n\nYou didn't join because you needed charity — you joined because you knew something was missing. Now you're quitting and hiding behind the 'I'm good now' excuse? Nah. That's not it.\n\nThis isn't about money. It's about mindset. And right now, yours is slipping.",
    },
  },
  {
    id: 'dont-know',
    text: "I don't know what to do",
    icon: <HelpCircle className='w-5 h-5' />,
    retentionMessage: {
      title: "That's exactly why you should stay!",
      content:
        "Saying 'I don't know what to do' is exactly why you shouldn't quit.\n\nWe literally made this foolproof — just click the #start-here section and follow the steps. That's it.\n\nIt explains exactly how to use the alerts, how to get help, and how to get results — step by step.\n\nYou don't need to figure anything out. You just need to follow instructions.\n\nDon't give up before even starting.",
    },
  },
];

export function CancellationFlowModal({
  isOpen,
  onClose,
  onComplete,
  subscription,
}: CancellationFlowModalProps) {
  const [step, setStep] = useState<CancellationStep>('reason');
  const [selectedReason, setSelectedReason] =
    useState<CancellationReason | null>(null);
  const [priceInput, setPriceInput] = useState<string>('');
  const [currentOffer, setCurrentOffer] = useState<number | null>(null);
  const [password, setPassword] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  // Debug subscription data when modal opens
  useEffect(() => {
    if (isOpen) {
      console.log(
        '🔍 Cancellation Modal Opened - Subscription Data:',
        subscription
      );
    }
  }, [isOpen, subscription]);

  // Reset all state when modal closes
  const resetState = () => {
    setStep('reason');
    setSelectedReason(null);
    setPriceInput('');
    setCurrentOffer(null);
    setPassword('');
    setIsLoading(false);
  };

  // Enhanced onClose that resets state
  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleReasonSelect = (reason: CancellationReason) => {
    setSelectedReason(reason);
    if (reason.id === 'nevermind') {
      handleClose();
      showToast.success('Welcome back!', "We're glad you decided to stay!");
      return;
    }
    // Skip retention message for "can't afford" - go straight to price negotiation
    if (reason.id === 'cant-afford') {
      setStep('price');
      return;
    }
    setStep('retention');
  };

  const handlePriceSubmit = async () => {
    const inputPrice = parseFloat(priceInput);

    console.log('🎯 Price Submit:', { inputPrice, priceInput });

    if (isNaN(inputPrice) || inputPrice <= 0) {
      showToast.error('Error', 'Please enter a valid price');
      return;
    }

    // Calculate offer: $5 less than their input (minimum $19.99)
    let offerPrice = Math.max(19.99, inputPrice - 5);

    // If they can already afford the full price, keep them at current price
    if (inputPrice >= 150) {
      showToast.info(
        'Great!',
        "Since you can afford the full price, we'll keep you at your current rate!"
      );
      handleClose();
      return;
    }

    console.log('💰 Calculated offer:', offerPrice);
    console.log('🔄 Applying discount immediately...');

    setCurrentOffer(offerPrice);
    setIsLoading(true);

    try {
      if (!subscription?.stripe) {
        showToast.error(
          'Error',
          'Subscription data not available. Please refresh the page and try again.'
        );
        return;
      }

      // Use 150 as the original price since that's our actual service price
      const originalPrice = 150;
      const currentDiscountedPrice = subscription.stripe.amount / 100;

      const totalDiscountAmount = originalPrice - offerPrice;
      const percentOff = Math.round(
        (totalDiscountAmount / originalPrice) * 100
      );

      console.log('💰 Discount calculation:', {
        originalPrice,
        currentDiscountedPrice,
        offerPrice,
        totalDiscountAmount,
        percentOff,
      });

      const response = await makeSecureRequest(
        '/api/subscription/create-coupon',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            percentOff,
            newMonthlyPrice: offerPrice,
            currentPrice: currentDiscountedPrice,
            originalPrice: originalPrice,
            customerId: subscription.customer?.id,
            subscriptionId: subscription.stripe?.id,
          }),
        }
      );

      const data = await response.json();
      console.log('📡 API Response:', { response: response.ok, data });

      if (response.ok) {
        console.log('✅ Discount successfully applied:', data);

        // Show success with detailed information
        showToast.success(
          '🎉 Custom Discount Applied!',
          `Your negotiated rate of $${offerPrice}/month has been permanently applied!`
        );

        // Create a notification for the user about the permanent discount
        try {
          await makeSecureRequest('/api/notifications', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'create',
              type: 'PAYMENT',
              title: 'Custom Discount Applied! 🎉',
              message: `Your negotiated rate of $${offerPrice}/month has been permanently applied. This discount will continue for the lifetime of your subscription.`,
            }),
          });
        } catch (notifError) {
          console.log(
            'Note: Could not create notification, but discount was applied successfully'
          );
        }

        onComplete('discounted');
        handleClose();
      } else {
        console.error('❌ API Error:', data);
        showToast.error(
          'Failed to Apply Custom Discount',
          data.message || data.error || 'Please try again or contact support.'
        );

        // If discount failed, offer to go to final offer
        showToast.info(
          'Alternative Option',
          'Would you like to see our final $19.99 offer instead?'
        );
        setTimeout(() => {
          setStep('final-offer');
          setCurrentOffer(19.99);
        }, 2000);
      }
    } catch (error) {
      console.error('❌ Network Error:', error);
      showToast.error(
        'Connection Error',
        'Failed to apply custom discount. Please check your connection and try again.'
      );

      // If error, offer to go to final offer
      setTimeout(() => {
        setStep('final-offer');
        setCurrentOffer(19.99);
      }, 2000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAcceptOffer = async () => {
    // Use finalOfferPrice or default to 19.99 for the final offer
    const finalOfferPrice = currentOffer || 19.99;

    console.log('🎯 Accept Offer clicked:', {
      currentOffer,
      finalOfferPrice,
      subscription,
    });

    if (!subscription?.stripe) {
      showToast.error(
        'Error',
        'Subscription data not available. Please refresh the page and try again.'
      );
      return;
    }

    setIsLoading(true);

    try {
      // Use 150 as the original price since that's our actual service price
      const originalPrice = 150;
      const currentDiscountedPrice = subscription.stripe.amount / 100;

      const totalDiscountAmount = originalPrice - finalOfferPrice;
      const percentOff = Math.round(
        (totalDiscountAmount / originalPrice) * 100
      );

      console.log('💰 Discount calculation:', {
        originalPrice,
        currentDiscountedPrice,
        finalOfferPrice,
        totalDiscountAmount,
        percentOff,
      });

      const response = await makeSecureRequest(
        '/api/subscription/create-coupon',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            percentOff,
            newMonthlyPrice: finalOfferPrice,
            currentPrice: currentDiscountedPrice,
            originalPrice: originalPrice,
            customerId: subscription.customer?.id,
            subscriptionId: subscription.stripe?.id,
          }),
        }
      );

      const data = await response.json();
      console.log('📡 API Response:', { response: response.ok, data });

      if (response.ok) {
        console.log('✅ Discount successfully applied:', data);

        // Show success with detailed information
        showToast.success(
          '🎉 Discount Applied Successfully!',
          `Your subscription has been updated to $${finalOfferPrice}/month. Check your Stripe dashboard or next invoice to confirm the discount.`
        );

        // Create a notification for the user about the permanent discount
        try {
          await makeSecureRequest('/api/notifications', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'create',
              type: 'PAYMENT',
              title: 'Permanent Discount Applied! 🎉',
              message: `Your negotiated rate of $${finalOfferPrice}/month has been permanently applied. This discount will continue for the lifetime of your subscription.`,
            }),
          });
        } catch (notifError) {
          console.log(
            'Note: Could not create notification, but discount was applied successfully'
          );
        }

        onComplete('discounted');
        handleClose();
      } else {
        console.error('❌ API Error:', data);
        showToast.error(
          'Failed to Apply Discount',
          data.message || data.error || 'Please try again or contact support.'
        );
      }
    } catch (error) {
      console.error('❌ Network Error:', error);
      showToast.error(
        'Connection Error',
        'Failed to apply discount. Please check your connection and try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleFinalCancel = async () => {
    if (!password.trim()) {
      showToast.error('Error', 'Password is required to cancel subscription');
      return;
    }

    setIsLoading(true);
    try {
      const response = await makeSecureRequest('/api/subscription/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: password,
          confirmCancel: true,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        showToast.success('✅ Auto-Renewal Disabled', data.message);
        onComplete('cancelled');
        handleClose();
      } else {
        showToast.error('Unable to Disable Auto-Renewal', data.error);
      }
    } catch (error) {
      showToast.error('Error', 'Failed to disable auto-renewal');
    } finally {
      setIsLoading(false);
    }
  };

  const renderReasonSelection = () => (
    <div className='relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white rounded-2xl shadow-2xl'>
      {/* Background Pattern */}
      <div className='absolute inset-0 bg-gradient-to-br from-blue-600/5 to-purple-600/5'></div>
      <div className='absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-blue-500/10 to-transparent rounded-full blur-3xl'></div>

      <div className='relative z-10 p-6 sm:p-10 space-y-6 sm:space-y-8'>
        {/* Header */}
        <div className='text-center space-y-4 sm:space-y-6'>
          <div className='mx-auto w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center shadow-xl animate-pulse'>
            <AlertTriangle className='w-8 h-8 sm:w-10 sm:h-10 text-white' />
          </div>

          <div className='space-y-3'>
            <h2 className='text-2xl sm:text-3xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent leading-tight'>
              Wait! Before you go...
            </h2>
            <p className='text-gray-300 text-base sm:text-lg max-w-md mx-auto leading-relaxed'>
              Help us understand what's not working so we can make it better for
              you
            </p>
          </div>

          {/* Value Reminder */}
          <div className='bg-gradient-to-r from-emerald-500/10 to-blue-500/10 border border-emerald-500/20 rounded-xl p-4 mx-auto max-w-lg'>
            <div className='flex items-center justify-center gap-2 text-emerald-400 font-semibold text-sm sm:text-base'>
              <div className='w-2 h-2 bg-emerald-400 rounded-full animate-pulse'></div>
              You're about to lose access to exclusive trading insights
            </div>
          </div>
        </div>

        {/* Reason Options */}
        <div className='space-y-3 sm:space-y-4'>
          {cancellationReasons.map((reason, index) => (
            <button
              key={reason.id}
              onClick={() => handleReasonSelect(reason)}
              className='w-full group relative overflow-hidden bg-gradient-to-r from-slate-800/50 to-slate-700/50 hover:from-slate-700/70 hover:to-slate-600/70 border border-slate-600/50 hover:border-slate-500/70 rounded-xl p-4 sm:p-5 transition-all duration-300 text-left min-h-[60px] touch-manipulation backdrop-blur-sm'
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className='absolute inset-0 bg-gradient-to-r from-blue-600/5 to-purple-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300'></div>

              <div className='relative flex items-center gap-4'>
                <div className='flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-slate-600 to-slate-700 group-hover:from-slate-500 group-hover:to-slate-600 rounded-xl transition-all duration-300 flex-shrink-0 shadow-lg'>
                  {reason.icon}
                </div>
                <span className='text-white font-medium text-sm sm:text-base leading-tight group-hover:text-gray-100 transition-colors'>
                  {reason.text}
                </span>
                <div className='ml-auto opacity-0 group-hover:opacity-100 transition-opacity duration-300'>
                  <div className='w-2 h-2 bg-blue-400 rounded-full'></div>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Trust Signals */}
        <div className='text-center pt-4 border-t border-slate-700/50'>
          <p className='text-slate-400 text-xs sm:text-sm'>
            🔒 Your data is secure • ⚡ Instant process • 💬 We're here to help
          </p>
        </div>
      </div>
    </div>
  );

  // Get the right theme colors based on the selected reason
  const getRetentionTheme = () => {
    switch (selectedReason?.id) {
      case 'no-time':
        return {
          bgColor: 'bg-blue-100',
          iconColor: 'text-blue-600',
          titleColor: 'text-blue-600',
          icon: <Clock className='w-6 h-6 sm:w-8 sm:h-8 text-blue-600' />,
          highlight: 'Want to give it another shot?',
          highlightBg: 'bg-green-100 border-green-200',
          highlightText: 'text-green-800',
        };
      case 'not-ready':
        return {
          bgColor: 'bg-orange-100',
          iconColor: 'text-orange-600',
          titleColor: 'text-orange-600',
          icon: (
            <AlertTriangle className='w-6 h-6 sm:w-8 sm:h-8 text-orange-600' />
          ),
          highlight: "💪 Hit 'Go Back' if you're done quitting on yourself.",
          highlightBg: 'bg-blue-100 border-blue-200',
          highlightText: 'text-blue-800',
        };
      case 'already-make-money':
        return {
          bgColor: 'bg-red-100',
          iconColor: 'text-red-600',
          titleColor: 'text-red-600',
          icon: <X className='w-6 h-6 sm:w-8 sm:h-8 text-red-600' />,
          highlight:
            "💡 Hit 'Go Back' if you're not ready to settle for average.",
          highlightBg: 'bg-blue-100 border-blue-200',
          highlightText: 'text-blue-800',
        };
      case 'dont-know':
        return {
          bgColor: 'bg-purple-100',
          iconColor: 'text-purple-600',
          titleColor: 'text-purple-600',
          icon: (
            <CheckCircle className='w-6 h-6 sm:w-8 sm:h-8 text-purple-600' />
          ),
          highlight: "👋 Hit 'Go Back' — I'll walk with you the whole way.",
          highlightBg: 'bg-green-100 border-green-200',
          highlightText: 'text-green-800',
        };
      default:
        return {
          bgColor: 'bg-gray-100',
          iconColor: 'text-gray-600',
          titleColor: 'text-gray-600',
          icon: <CheckCircle className='w-6 h-6 sm:w-8 sm:h-8 text-gray-600' />,
          highlight: '',
          highlightBg: 'bg-gray-100',
          highlightText: 'text-gray-800',
        };
    }
  };

  const theme = getRetentionTheme();

  const renderRetentionMessage = () => (
    <div className='relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white rounded-2xl shadow-2xl'>
      {/* Background Pattern */}
      <div className='absolute inset-0 bg-gradient-to-br from-blue-600/5 to-purple-600/5'></div>
      <div className='absolute top-0 left-0 w-64 h-64 bg-gradient-to-br from-emerald-500/10 to-transparent rounded-full blur-3xl'></div>

      <div className='relative z-10 p-6 sm:p-10 space-y-6 sm:space-y-8'>
        {/* Header */}
        <div className='text-center space-y-4 sm:space-y-6'>
          <div
            className={`mx-auto w-16 h-16 sm:w-20 sm:h-20 ${theme.bgColor} rounded-2xl flex items-center justify-center shadow-xl`}
          >
            {theme.icon}
          </div>

          <h2 className='text-2xl sm:text-3xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent leading-tight'>
            {selectedReason?.retentionMessage.title}
          </h2>
        </div>

        {/* Retention Content */}
        <div className='bg-gradient-to-br from-white to-gray-50 p-6 sm:p-8 rounded-2xl text-gray-900 shadow-xl border border-gray-200/20'>
          <div className='space-y-4 sm:space-y-6'>
            {selectedReason?.retentionMessage.content
              .split('\n\n')
              .map((paragraph, index) => (
                <p
                  key={index}
                  className='text-gray-700 leading-relaxed text-base sm:text-lg'
                >
                  {paragraph}
                </p>
              ))}
          </div>

          {theme.highlight && (
            <div
              className={`mt-6 p-4 sm:p-6 ${theme.highlightBg} border-2 rounded-xl shadow-lg`}
            >
              <p
                className={`${theme.highlightText} font-semibold text-base sm:text-lg text-center`}
              >
                {theme.highlight}
              </p>
            </div>
          )}
        </div>

        {/* Social Proof Section */}
        <div className='bg-gradient-to-r from-emerald-500/10 to-blue-500/10 border border-emerald-500/20 rounded-xl p-4 sm:p-6'>
          <div className='text-center space-y-3'>
            <h3 className='text-lg sm:text-xl font-semibold text-emerald-400'>
              Why our members stay:
            </h3>
            <div className='grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm sm:text-base'>
              <div className='text-center'>
                <div className='text-2xl font-bold text-white'>1,000+</div>
                <div className='text-gray-300'>Active Members</div>
              </div>
              <div className='text-center'>
                <div className='text-2xl font-bold text-white'>Daily</div>
                <div className='text-gray-300'>Trade Alerts</div>
              </div>
              <div className='text-center'>
                <div className='text-2xl font-bold text-white'>24/7</div>
                <div className='text-gray-300'>Support Access</div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className='flex flex-col sm:flex-row gap-3 sm:gap-4'>
          <Button
            onClick={() => {
              handleClose();
              showToast.success(
                'Welcome back!',
                "We're glad you decided to stay!"
              );
            }}
            className='w-full sm:flex-1 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-semibold py-3 sm:py-4 rounded-xl shadow-lg transition-all duration-300 hover:shadow-xl hover:scale-105 min-h-[48px]'
          >
            <Heart className='w-5 h-5 mr-2' />I want to stay!
          </Button>
          <Button
            variant='outline'
            onClick={() => setStep('reason')}
            className='w-full sm:flex-1 bg-transparent border-2 border-slate-600 text-slate-300 hover:bg-slate-700 hover:border-slate-500 min-h-[44px] rounded-xl'
          >
            <ArrowLeft className='w-4 h-4 mr-2' />
            Go Back
          </Button>
          <Button
            onClick={() => setStep('price')}
            className='w-full sm:flex-1 bg-slate-600 hover:bg-slate-700 text-white min-h-[44px] rounded-xl'
          >
            Continue Anyway
          </Button>
        </div>

        {/* Trust Signal */}
        <div className='text-center pt-4 border-t border-slate-700/50'>
          <p className='text-slate-400 text-xs sm:text-sm'>
            💎 Join 1,000+ active traders • 🏆 Proven trading community
          </p>
        </div>
      </div>
    </div>
  );

  const renderPriceNegotiation = () => (
    <div className='relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white rounded-2xl shadow-2xl'>
      {/* Background Pattern */}
      <div className='absolute inset-0 bg-gradient-to-br from-emerald-600/5 to-green-600/5'></div>
      <div className='absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-emerald-500/10 to-transparent rounded-full blur-3xl'></div>

      <div className='relative z-10 p-6 sm:p-10 space-y-6 sm:space-y-8'>
        {/* Header */}
        <div className='text-center space-y-4 sm:space-y-6'>
          <div className='mx-auto w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-emerald-400 to-green-500 rounded-2xl flex items-center justify-center shadow-xl'>
            <DollarSign className='w-8 h-8 sm:w-10 sm:h-10 text-white' />
          </div>

          <div className='space-y-3'>
            <h2 className='text-2xl sm:text-3xl font-bold bg-gradient-to-r from-emerald-400 to-green-300 bg-clip-text text-transparent leading-tight'>
              Let's find a price that works for you
            </h2>
            <p className='text-gray-300 text-base sm:text-lg max-w-md mx-auto leading-relaxed'>
              We want to keep you as part of our trading family. What would make
              this sustainable for your budget?
            </p>
          </div>
        </div>

        {/* Price Input Section */}
        <div className='bg-gradient-to-br from-white to-gray-50 p-6 sm:p-8 rounded-2xl text-gray-900 shadow-xl border border-gray-200/20'>
          <div className='space-y-6'>
            <div className='text-center'>
              <Label className='text-gray-700 text-lg sm:text-xl font-semibold block mb-2'>
                Your ideal monthly price
              </Label>
              <p className='text-gray-500 text-sm sm:text-base'>
                Be honest - we'll work with your budget
              </p>
            </div>

            <div className='flex items-center justify-center gap-3 mb-6'>
              <span className='text-3xl sm:text-4xl font-bold text-emerald-600'>
                $
              </span>
              <Input
                type='number'
                step='0.01'
                min='0'
                placeholder='0.00'
                value={priceInput}
                onChange={e => setPriceInput(e.target.value)}
                className='text-3xl sm:text-4xl font-black text-gray-900 bg-white border-3 border-emerald-300 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-200 rounded-2xl h-16 sm:h-20 px-6 shadow-2xl placeholder:text-gray-400 placeholder:font-normal caret-emerald-600 text-center'
                style={{ fontSize: '2rem' }}
              />
            </div>

            <div className='bg-gradient-to-r from-emerald-50 to-green-50 border-2 border-emerald-200 rounded-xl p-4 sm:p-6'>
              <div className='flex items-start gap-3'>
                <div className='w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5'>
                  <span className='text-white text-sm font-bold'>💡</span>
                </div>
                <div>
                  <p className='text-emerald-800 font-semibold text-base mb-1'>
                    Smart pricing guarantee
                  </p>
                  <p className='text-emerald-700 text-sm'>
                    We'll create a custom offer based on your budget. Most
                    members save 40-60% with our personalized pricing.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Value Reminder */}
        <div className='bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-xl p-4 sm:p-6'>
          <div className='text-center space-y-3'>
            <h3 className='text-lg sm:text-xl font-semibold text-blue-400'>
              What you keep with any price:
            </h3>
            <div className='grid grid-cols-2 gap-4 text-sm sm:text-base'>
              <div className='flex items-center gap-2'>
                <div className='w-2 h-2 bg-emerald-400 rounded-full'></div>
                <span className='text-gray-300'>Daily trade alerts</span>
              </div>
              <div className='flex items-center gap-2'>
                <div className='w-2 h-2 bg-emerald-400 rounded-full'></div>
                <span className='text-gray-300'>Private Discord access</span>
              </div>
              <div className='flex items-center gap-2'>
                <div className='w-2 h-2 bg-emerald-400 rounded-full'></div>
                <span className='text-gray-300'>Market analysis</span>
              </div>
              <div className='flex items-center gap-2'>
                <div className='w-2 h-2 bg-emerald-400 rounded-full'></div>
                <span className='text-gray-300'>24/7 support</span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className='flex flex-col sm:flex-row gap-3 sm:gap-4'>
          <Button
            onClick={handlePriceSubmit}
            disabled={!priceInput || parseFloat(priceInput) <= 0 || isLoading}
            className='w-full sm:flex-1 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-semibold py-3 sm:py-4 rounded-xl shadow-lg transition-all duration-300 hover:shadow-xl hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none min-h-[48px]'
          >
            {isLoading ? (
              <div className='flex items-center gap-2'>
                <Loader2 className='w-5 h-5 animate-spin' />
                Applying Discount...
              </div>
            ) : (
              '✨ Get My Custom Offer'
            )}
          </Button>
          <Button
            variant='outline'
            onClick={() => {
              if (selectedReason?.id === 'cant-afford') {
                setStep('reason');
              } else {
                setStep('retention');
              }
            }}
            className='w-full sm:flex-1 bg-transparent border-2 border-slate-600 text-slate-300 hover:bg-slate-700 hover:border-slate-500 min-h-[44px] rounded-xl'
          >
            <ArrowLeft className='w-4 h-4 mr-2' />
            Back
          </Button>
          <Button
            onClick={() => setStep('final-offer')}
            className='w-full sm:flex-1 bg-slate-600 hover:bg-slate-700 text-white min-h-[44px] rounded-xl'
          >
            Skip to Cancel
          </Button>
        </div>

        {/* Trust Signal */}
        <div className='text-center pt-4 border-t border-slate-700/50'>
          <p className='text-slate-400 text-xs sm:text-sm'>
            🤝 No commitment • 💰 Price locked forever • 📞 Cancel anytime
          </p>
        </div>
      </div>
    </div>
  );

  const renderFinalOffer = () => {
    // Ensure we have a final offer price (default to $19.99 if not set)
    const finalOfferPrice = currentOffer || 19.99;

    return (
      <div className='relative overflow-hidden bg-gradient-to-br from-red-900 via-red-800 to-orange-900 text-white rounded-2xl shadow-2xl'>
        {/* Animated Background */}
        <div className='absolute inset-0 bg-gradient-to-br from-red-600/10 to-orange-600/10'></div>
        <div className='absolute top-0 left-0 w-full h-full bg-gradient-to-r from-red-500/5 to-orange-500/5 animate-pulse'></div>
        <div className='absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-orange-500/20 to-transparent rounded-full blur-3xl animate-pulse'></div>

        <div className='relative z-10 p-4 sm:p-6 space-y-4 sm:space-y-5'>
          {/* Urgent Header */}
          <div className='text-center space-y-3 sm:space-y-4'>
            <div className='mx-auto w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-red-400 to-orange-500 rounded-2xl flex items-center justify-center shadow-2xl animate-bounce'>
              <Flame className='w-8 h-8 sm:w-10 sm:h-10 text-white' />
            </div>

            <div className='space-y-3'>
              <h2 className='text-2xl sm:text-4xl font-black bg-gradient-to-r from-red-200 to-orange-200 bg-clip-text text-transparent leading-tight animate-pulse'>
                🚨 FINAL OFFER
              </h2>
              <div className='bg-gradient-to-r from-red-500/20 to-orange-500/20 border border-red-400/30 rounded-xl p-3 sm:p-4 mx-auto max-w-lg'>
                <p className='text-red-200 text-base sm:text-lg font-semibold'>
                  This is the absolute lowest price we'll ever offer
                </p>
                <p className='text-red-300 text-sm'>
                  No games. No second chances. Take it or lose it forever.
                </p>
              </div>
            </div>
          </div>

          {/* Dramatic Price Display */}
          <div className='bg-gradient-to-br from-white to-gray-100 border-4 border-red-400 rounded-2xl p-4 sm:p-6 text-gray-900 shadow-2xl transform hover:scale-105 transition-transform duration-300'>
            <div className='text-center space-y-4'>
              {/* Countdown Effect */}
              <div className='flex items-center justify-center gap-2 text-red-600 font-bold text-sm sm:text-base'>
                <div className='w-3 h-3 bg-red-500 rounded-full animate-ping'></div>
                LIMITED TIME • EXPIRES WHEN YOU LEAVE
              </div>

              <div className='relative'>
                <div className='text-5xl sm:text-6xl font-black text-red-600 animate-pulse'>
                  ${finalOfferPrice.toFixed(2)}
                </div>
                <div className='text-lg sm:text-xl text-gray-600 font-semibold'>
                  per month • locked in forever
                </div>

                {/* Savings Badge */}
                <div className='absolute -top-4 -right-4 sm:-top-6 sm:-right-6 bg-gradient-to-r from-emerald-500 to-green-500 text-white px-3 py-1 sm:px-4 sm:py-2 rounded-full text-xs sm:text-sm font-bold transform rotate-12 shadow-lg'>
                  SAVE ${Math.round(150 - finalOfferPrice)}
                </div>
              </div>

              {/* Feature Badges */}
              <div className='flex flex-wrap items-center justify-center gap-3 sm:gap-4'>
                <div className='flex items-center gap-2 bg-red-100 px-3 py-2 rounded-full border border-red-200'>
                  <Flame className='w-4 h-4 text-red-500' />
                  <span className='font-semibold text-red-700 text-sm'>
                    Final Offer
                  </span>
                </div>
                <div className='flex items-center gap-2 bg-green-100 px-3 py-2 rounded-full border border-green-200'>
                  <span className='text-green-600'>🔒</span>
                  <span className='font-semibold text-green-700 text-sm'>
                    Price Locked
                  </span>
                </div>
                <div className='flex items-center gap-2 bg-blue-100 px-3 py-2 rounded-full border border-blue-200'>
                  <span className='text-blue-600'>⚡</span>
                  <span className='font-semibold text-blue-700 text-sm'>
                    Instant Access
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Urgency Message */}
          <div className='bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border-2 border-yellow-400/50 rounded-xl p-3 sm:p-4'>
            <div className='text-center space-y-1'>
              <p className='text-yellow-200 font-bold text-base sm:text-lg'>
                ⚠️ This offer disappears forever when you close this window
              </p>
              <p className='text-yellow-300 text-sm'>
                You will NEVER see a price this low again. This is your final
                chance to secure premium access for just $
                {finalOfferPrice.toFixed(2)}/month.
              </p>
            </div>
          </div>

          {/* Value Stack */}
          <div className='bg-gradient-to-br from-slate-800/50 to-slate-700/50 border border-slate-600/50 rounded-xl p-4 sm:p-6'>
            <h3 className='text-center text-lg sm:text-xl font-semibold text-white mb-4'>
              What you get for just ${finalOfferPrice.toFixed(2)}/month:
            </h3>
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm sm:text-base'>
              {[
                '📈 Daily trade alerts & signals',
                '💬 Private Discord community access',
                '📊 Weekly market analysis',
                '🎯 Trading guidance & support',
                '📱 Mobile app & notifications',
                '⚡ Real-time trade updates',
              ].map((item, index) => (
                <div
                  key={index}
                  className='flex items-center gap-2 text-gray-300'
                >
                  <div className='w-2 h-2 bg-emerald-400 rounded-full flex-shrink-0'></div>
                  <span>{item}</span>
                </div>
              ))}
            </div>
            <div className='mt-4 pt-4 border-t border-slate-600/50 text-center'>
              <div className='text-gray-400 text-sm line-through'>
                Regular price: $150/month
              </div>
              <div className='text-emerald-400 text-xl font-bold'>
                Your final offer: ${finalOfferPrice.toFixed(2)}/month
              </div>
              <div className='text-orange-300 text-sm font-semibold mt-1'>
                Save ${Math.round(150 - finalOfferPrice)}/month (
                {Math.round(((150 - finalOfferPrice) / 150) * 100)}% off)
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className='flex flex-col gap-3 sm:gap-4'>
            {/* Primary Action Button */}
            <Button
              onClick={handleAcceptOffer}
              disabled={isLoading}
              className='w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-black text-base sm:text-lg py-3 sm:py-4 rounded-xl shadow-2xl transition-all duration-300 hover:shadow-3xl hover:scale-105 disabled:opacity-50 disabled:transform-none min-h-[48px] animate-pulse'
            >
              {isLoading ? (
                <div className='flex items-center gap-2'>
                  <Loader2 className='w-5 h-5 animate-spin' />
                  Processing...
                </div>
              ) : (
                <div className='flex items-center gap-2'>
                  ✅ SECURE THIS DEAL NOW
                </div>
              )}
            </Button>

            {/* Secondary Action Buttons */}
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4'>
              <Button
                variant='outline'
                onClick={() => setStep('price')}
                className='w-full bg-transparent border-2 border-slate-500 text-slate-300 hover:bg-slate-600 hover:border-slate-400 min-h-[44px] rounded-xl'
              >
                <ArrowLeft className='w-4 h-4 mr-2' />
                Back
              </Button>
              <Button
                onClick={() => setStep('password')}
                className='w-full bg-slate-700 hover:bg-slate-600 text-slate-300 min-h-[44px] rounded-xl text-sm sm:text-base'
              >
                Cancel Subscription
              </Button>
            </div>
          </div>

          {/* Final Trust Signal */}
          <div className='text-center pt-4 border-t border-red-700/50'>
            <p className='text-red-200 text-xs sm:text-sm'>
              🛡️ Money-back guarantee • 🔐 Secure checkout • ⭐ Trusted by
              1,000+ traders
            </p>
          </div>
        </div>
      </div>
    );
  };

  const renderPasswordConfirmation = () => (
    <div className='relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white rounded-2xl shadow-2xl'>
      {/* Background Pattern */}
      <div className='absolute inset-0 bg-gradient-to-br from-orange-600/5 to-red-600/5'></div>
      <div className='absolute top-0 left-0 w-64 h-64 bg-gradient-to-br from-orange-500/10 to-transparent rounded-full blur-3xl'></div>

      <div className='relative z-10 p-6 sm:p-10 space-y-6 sm:space-y-8'>
        {/* Header */}
        <div className='text-center space-y-4 sm:space-y-6'>
          <div className='mx-auto w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-orange-400 to-red-500 rounded-2xl flex items-center justify-center shadow-xl'>
            <AlertTriangle className='w-8 h-8 sm:w-10 sm:h-10 text-white' />
          </div>

          <div className='space-y-3'>
            <h2 className='text-2xl sm:text-3xl font-bold bg-gradient-to-r from-orange-300 to-red-300 bg-clip-text text-transparent leading-tight'>
              Final Confirmation Required
            </h2>
            <p className='text-gray-300 text-base sm:text-lg max-w-md mx-auto leading-relaxed'>
              You're about to disable auto-renewal. Here's what happens next:
            </p>
          </div>
        </div>

        {/* What Happens Section */}
        <div className='bg-gradient-to-br from-white to-gray-50 p-6 sm:p-8 rounded-2xl text-gray-900 shadow-xl border border-gray-200/20'>
          <h3 className='text-lg sm:text-xl font-semibold text-gray-800 mb-6 text-center'>
            Your subscription timeline:
          </h3>
          <div className='space-y-4 sm:space-y-5'>
            <div className='flex items-center gap-4'>
              <div className='w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg'>
                <span className='text-white text-sm font-bold'>✓</span>
              </div>
              <div>
                <span className='text-base sm:text-lg font-semibold block'>
                  Your subscription stays{' '}
                  <span className='text-emerald-600'>active</span> until{' '}
                  {subscription?.stripe?.currentPeriodEnd
                    ? new Date(
                        subscription.stripe.currentPeriodEnd
                      ).toLocaleDateString('en-US', {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    : 'period end'}
                </span>
                <span className='text-gray-600 text-sm'>
                  Continue enjoying all premium features
                </span>
              </div>
            </div>

            <div className='flex items-center gap-4'>
              <div className='w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg'>
                <span className='text-white text-sm font-bold'>i</span>
              </div>
              <div>
                <span className='text-base sm:text-lg font-semibold block'>
                  <span className='text-blue-600'>
                    You can re-enable auto-renewal
                  </span>{' '}
                  anytime
                </span>
                <span className='text-gray-600 text-sm'>
                  Simply toggle it back on before expiration
                </span>
              </div>
            </div>

            <div className='flex items-center gap-4'>
              <div className='w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg'>
                <span className='text-white text-sm font-bold'>!</span>
              </div>
              <div>
                <span className='text-base sm:text-lg font-semibold block'>
                  Access expires only if auto-renewal stays disabled
                </span>
                <span className='text-gray-600 text-sm'>
                  You're always in control
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Reassurance Message */}
        <div className='bg-gradient-to-r from-blue-500/10 to-emerald-500/10 border border-blue-500/20 rounded-xl p-4 sm:p-6'>
          <div className='text-center'>
            <h3 className='text-lg sm:text-xl font-semibold text-blue-400 mb-2'>
              💡 This is completely reversible
            </h3>
            <p className='text-blue-200 text-sm sm:text-base'>
              You can re-enable auto-renewal anytime from your settings. This is
              just turning off automatic billing - not deleting your account.
            </p>
          </div>
        </div>

        {/* Password Input */}
        <div className='bg-gradient-to-br from-white to-gray-50 p-6 sm:p-8 rounded-2xl text-gray-900 shadow-xl border border-gray-200/20'>
          <div className='space-y-4 sm:space-y-5'>
            <div className='text-center'>
              <Label className='text-gray-700 text-lg sm:text-xl font-semibold block mb-2'>
                Confirm with your password
              </Label>
              <p className='text-gray-500 text-sm sm:text-base'>
                For your security, please enter your account password
              </p>
            </div>

            <div className='relative'>
              <Input
                type='password'
                placeholder='Enter your password'
                value={password}
                onChange={e => setPassword(e.target.value)}
                className='w-full h-12 sm:h-14 text-base sm:text-lg border-2 border-gray-300 focus:border-orange-400 focus:ring-2 focus:ring-orange-200 rounded-xl px-4 shadow-lg'
              />
              <div className='absolute right-3 top-1/2 transform -translate-y-1/2'>
                <div className='w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center'>
                  <span className='text-gray-600 text-xs'>🔒</span>
                </div>
              </div>
            </div>

            <p className='text-xs sm:text-sm text-gray-600 text-center'>
              🛡️ Your password is encrypted and secure
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className='flex flex-col sm:flex-row gap-3 sm:gap-4'>
          <Button
            onClick={() => {
              handleClose();
              showToast.success(
                'Welcome back!',
                "We're glad you decided to stay!"
              );
            }}
            className='w-full sm:flex-1 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-semibold py-3 sm:py-4 rounded-xl shadow-lg transition-all duration-300 hover:shadow-xl hover:scale-105 min-h-[48px]'
          >
            <Heart className='w-5 h-5 mr-2' />
            Actually, I want to stay!
          </Button>
          <Button
            variant='outline'
            onClick={() => setStep('final-offer')}
            className='w-full sm:flex-1 bg-transparent border-2 border-slate-600 text-slate-300 hover:bg-slate-700 hover:border-slate-500 min-h-[44px] rounded-xl'
          >
            <ArrowLeft className='w-4 h-4 mr-2' />
            Go Back
          </Button>
          <Button
            onClick={handleFinalCancel}
            disabled={isLoading || !password.trim()}
            className='w-full sm:flex-1 bg-orange-600 hover:bg-orange-700 text-white disabled:opacity-50 disabled:cursor-not-allowed font-medium min-h-[44px] rounded-xl'
          >
            {isLoading ? (
              <div className='flex items-center gap-2'>
                <Loader2 className='w-4 h-4 animate-spin' />
                Processing...
              </div>
            ) : (
              'Disable Auto-Renewal'
            )}
          </Button>
        </div>

        {/* Final Trust Signal */}
        <div className='text-center pt-4 border-t border-slate-700/50'>
          <p className='text-slate-400 text-xs sm:text-sm'>
            🔐 Secure process • 🔄 Fully reversible • 📧 Confirmation email sent
          </p>
        </div>
      </div>
    </div>
  );

  const renderStep = () => {
    switch (step) {
      case 'reason':
        return renderReasonSelection();
      case 'retention':
        return renderRetentionMessage();
      case 'price':
        return renderPriceNegotiation();
      case 'final-offer':
        // Ensure we have a default offer when going to final offer step
        if (!currentOffer) {
          console.log('🔧 Setting default final offer to 19.99');
          setCurrentOffer(19.99);
        }
        return renderFinalOffer();
      case 'password':
        return renderPasswordConfirmation();
      default:
        return renderReasonSelection();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className='max-w-2xl max-h-[90vh] sm:max-h-[85vh] bg-transparent border-none p-0 w-[calc(100vw-1rem)] sm:w-full flex flex-col'>
        <div className='relative flex-1 overflow-y-auto p-2 sm:p-4'>
          {/* Custom X button that actually works */}
          <button
            onClick={handleClose}
            className='absolute right-4 top-4 z-50 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md border border-white/40 hover:border-white/60 flex items-center justify-center transition-all duration-200 hover:scale-110 shadow-lg'
            aria-label='Close modal'
            type='button'
          >
            <X className='h-4 w-4 sm:h-5 sm:w-5 text-white drop-shadow-lg' />
          </button>
          <div className='w-full pb-4'>{renderStep()}</div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

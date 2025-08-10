'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertTriangle,
  CheckCircle,
  DollarSign,
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
import { OfferConfirmationModal } from './offer-confirmation-modal';
import { useUser } from '@clerk/nextjs';
import { formatCurrency, centsToDollars, dollarsToCents } from '@/lib/utils';

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
    stripeSubscriptionId?: string; // Added for new webhook data
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
  const [currentOfferCents, setCurrentOfferCents] = useState<number | null>(
    null
  );
  const [password, setPassword] = useState<string>('');
  const [confirmationText, setConfirmationText] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [showOfferConfirmation, setShowOfferConfirmation] = useState(false);
  const { user } = useUser();
  const [offerDetails, setOfferDetails] = useState<{
    originalPriceCents: number;
    userInputCents: number;
    offerPriceCents: number;
    savingsCents: number;
    percentOff: number;
  } | null>(null);

  // ✅ NEW: State for improved cancellation flow
  const [hasStoredOffer, setHasStoredOffer] = useState(false);
  const [storedOfferDetails, setStoredOfferDetails] = useState<{
    id: string;
    originalPriceCents: number;
    userInputCents: number;
    offerPriceCents: number;
    discountPercent: number;
    savingsCents: number;
    expiresAt: string;
  } | null>(null);
  const [showFinalOffer, setShowFinalOffer] = useState(false);
  const [currentStep, setCurrentStep] = useState<
    'generated' | 'stored' | 'final'
  >('generated');
  const [subscriptionEndDate, setSubscriptionEndDate] = useState<string | null>(
    null
  );

  // ✅ NEW: Fetch subscription end date when reaching final confirmation
  useEffect(() => {
    const fetchSubscriptionEndDate = async () => {
      if (step === 'password') {
        try {
          // First try to use existing subscription data if complete
          if (subscription?.stripe?.currentPeriodEnd) {
            const endDate = new Date(subscription.stripe.currentPeriodEnd);
            setSubscriptionEndDate(
              endDate.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })
            );
            return;
          }

          // Fetch fresh data from status API to get subscription end date
          const response = await fetch('/api/subscription?status=true', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
          });

          if (response.ok) {
            const data = await response.json();
            if (data.subscriptionEnd) {
              const endDate = new Date(data.subscriptionEnd);
              setSubscriptionEndDate(
                endDate.toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })
              );
            }
          }
        } catch (error) {
          console.error('Failed to fetch subscription end date:', error);
        }
      }
    };

    fetchSubscriptionEndDate();
  }, [step, subscription]);

  // ✅ NEW: Fetch fresh subscription data from both endpoints
  const fetchFreshSubscriptionData = async () => {
    try {
      // Get comprehensive subscription data
      const [comprehensiveResponse, statusResponse] = await Promise.all([
        fetch('/api/subscription?comprehensive=true', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        }),
        fetch('/api/subscription?status=true', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        }),
      ]);

      const comprehensiveData = comprehensiveResponse.ok
        ? await comprehensiveResponse.json()
        : null;
      const statusData = statusResponse.ok ? await statusResponse.json() : null;

      // Combine data from both endpoints
      if (comprehensiveData?.success && comprehensiveData.subscription) {
        return {
          ...comprehensiveData.subscription,
          subscriptionEnd: statusData?.subscriptionEnd || null,
        };
      } else {
        throw new Error(
          comprehensiveData?.error || 'No subscription data returned'
        );
      }
    } catch (error) {
      console.error(
        '❌ [FRESH-STRIPE] Failed to fetch subscription data:',
        error
      );
      return null;
    }
  };

  // ✅ ENHANCED: Create stripe data with fresh API calls as fallback
  const getStripeData = async () => {
    // First try to use existing subscription data if complete
    if (subscription?.stripe?.amount && subscription?.stripe?.id) {
      return subscription.stripe;
    }

    const freshData = await fetchFreshSubscriptionData();

    if (freshData) {
      return {
        id: freshData.id,
        amount: freshData.amount, // Already in cents from Stripe
        originalAmount: freshData.originalAmount || freshData.amount,
        currency: freshData.currency || 'usd',
        interval: freshData.interval || 'month',
        customerId: freshData.customerId,
        currentPeriodEnd: freshData.subscriptionEnd,
      };
    }

    // Final fallback - try to construct from available data
    if (subscription?.status === 'active') {
      return {
        id: subscription.stripeSubscriptionId || 'unknown',
        amount: 14999, // $149.99 in cents
        originalAmount: 14999, // $149.99 in cents
        currency: 'usd',
        interval: 'month',
        customerId: subscription.customerId || subscription.customer?.id,
        currentPeriodEnd: (subscription as any).currentPeriodEnd,
      };
    }

    return null;
  };

  // ✅ NEW: Generate random discount between 5-10%
  const generateRandomDiscount = (userInputCents: number) => {
    const minDiscount = 5;
    const maxDiscount = 10;
    const discountPercent =
      Math.random() * (maxDiscount - minDiscount) + minDiscount;
    const discountAmount = Math.round(userInputCents * (discountPercent / 100));
    const offerPriceCents = userInputCents - discountAmount;

    return {
      discountPercent: Math.round(discountPercent * 100) / 100,
      offerPriceCents,
      savingsCents: discountAmount,
    };
  };

  // ✅ NEW: Check for existing stored offer
  const checkForStoredOffer = async (subscriptionId: string) => {
    try {
      const response = await fetch(
        `/api/subscription/custom-offer?subscriptionId=${subscriptionId}`,
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        }
      );

      const data = await response.json();

      if (response.ok && data.success && data.hasOffer) {
        return data.offer;
      }

      return null;
    } catch (error) {
      console.error('Error checking for stored offer:', error);
      return null;
    }
  };

  // ✅ NEW: Store rejected offer
  const storeRejectedOffer = async (offerData: {
    subscriptionId: string;
    originalPriceCents: number;
    userInputCents: number;
    offerPriceCents: number;
    discountPercent: number;
  }) => {
    try {
      const response = await fetch('/api/subscription/custom-offer/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(offerData),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        return data.offer;
      }

      throw new Error(data.error || 'Failed to store rejected offer');
    } catch (error) {
      console.error('Error storing rejected offer:', error);
      throw error;
    }
  };

  // ✅ NEW: Accept custom offer
  const acceptCustomOffer = async (offerId: string) => {
    try {
      // 1. Accept the offer in database
      const acceptResponse = await fetch(
        '/api/subscription/custom-offer/accept',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ offerId }),
        }
      );

      const acceptData = await acceptResponse.json();

      if (!acceptResponse.ok) {
        throw new Error(acceptData.error || 'Failed to accept offer');
      }

      // 2. Apply the discount via Stripe
      const couponResponse = await fetch('/api/subscription/apply-coupon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(acceptData.applyCouponData),
      });

      const couponData = await couponResponse.json();

      if (!couponResponse.ok) {
        throw new Error(
          couponData.error || 'Failed to apply discount to Stripe'
        );
      }

      return { acceptData, couponData };
    } catch (error) {
      console.error('Error accepting custom offer:', error);
      throw error;
    }
  };

  // Reset all state when modal closes
  const resetState = () => {
    setStep('reason');
    setSelectedReason(null);
    setPriceInput('');
    setCurrentOfferCents(null);
    setPassword('');
    setConfirmationText('');
    setIsLoading(false);
    setShowOfferConfirmation(false);
    setOfferDetails(null);
    // ✅ NEW: Reset improved flow state
    setHasStoredOffer(false);
    setStoredOfferDetails(null);
    setShowFinalOffer(false);
    setCurrentStep('generated');
    setSubscriptionEndDate(null);
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

  // ✅ UPDATED: New improved price submission flow
  const handlePriceSubmit = async () => {
    const inputPriceDollars = parseFloat(priceInput);

    if (isNaN(inputPriceDollars) || inputPriceDollars <= 0) {
      showToast.error('Error', 'Please enter a valid price');
      return;
    }

    // Convert input to cents for all calculations
    const inputPriceCents = dollarsToCents(inputPriceDollars);

    // If they can already afford the full price, keep them at current price
    if (inputPriceDollars >= 150) {
      showToast.info(
        'Great!',
        "Since you can afford the full price, we'll keep you at your current rate!"
      );
      handleClose();
      return;
    }

    setIsLoading(true);

    try {
      // Get subscription ID for API calls
      const stripeData = await getStripeData();
      if (!stripeData?.id) {
        showToast.error('Error', 'Unable to retrieve subscription information');
        setIsLoading(false);
        return;
      }

      // 1. Check for existing stored offer first
      const existingOffer = await checkForStoredOffer(stripeData.id);

      if (existingOffer) {
        // User has a stored offer, show it
        setStoredOfferDetails(existingOffer);
        setHasStoredOffer(true);
        setCurrentStep('stored');
        setShowOfferConfirmation(true);
      } else {
        // No stored offer, generate new random discount (5-10%)
        const originalPriceCents = 15000; // $150.00 in cents

        // Generate random discount with $20 minimum enforcement
        const minOfferPriceCents = 2000; // $20 minimum

        // If user input is already at or below minimum, show minimum price
        if (inputPriceCents <= minOfferPriceCents) {
          setOfferDetails({
            originalPriceCents,
            userInputCents: inputPriceCents,
            offerPriceCents: minOfferPriceCents,
            savingsCents: 0,
            percentOff: 0,
          });
          setCurrentOfferCents(minOfferPriceCents);
          setHasStoredOffer(false);
          setCurrentStep('generated');
          setShowOfferConfirmation(true);
          return;
        }

        const discountData = generateRandomDiscount(inputPriceCents);

        // Ensure minimum price of $20
        let finalOfferPriceCents = Math.max(
          minOfferPriceCents,
          discountData.offerPriceCents
        );

        const finalSavingsCents = inputPriceCents - finalOfferPriceCents;
        const finalPercentOff =
          finalSavingsCents > 0
            ? Math.round((finalSavingsCents / inputPriceCents) * 100)
            : 0;

        // Store offer details for the modal
        setOfferDetails({
          originalPriceCents,
          userInputCents: inputPriceCents,
          offerPriceCents: finalOfferPriceCents,
          savingsCents: finalSavingsCents,
          percentOff: finalPercentOff,
        });
        setCurrentOfferCents(finalOfferPriceCents);
        setHasStoredOffer(false);
        setCurrentStep('generated');
        setShowOfferConfirmation(true);
      }
    } catch (error) {
      console.error('Error in price submission:', error);
      showToast.error(
        'Error',
        'Failed to process your request. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  // ✅ NEW: Handle accepting offers (both stored and generated)
  const handleOfferAccept = async () => {
    setIsLoading(true);
    setShowOfferConfirmation(false);

    try {
      if (hasStoredOffer && storedOfferDetails) {
        // Accept stored offer
        await acceptCustomOffer(storedOfferDetails.id);

        showToast.success(
          '🎉 Custom Discount Applied!',
          `Your saved offer of ${formatCurrency(
            storedOfferDetails.offerPriceCents
          )}/month has been applied!`
        );
      } else if (offerDetails) {
        // For generated offers, we need to "accept" them by applying directly
        // (since they weren't stored until now)
        const stripeData = await getStripeData();
        if (!stripeData) {
          throw new Error('Unable to retrieve subscription data');
        }

        const response = await fetch('/api/subscription/apply-coupon', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            percentOff: offerDetails.percentOff,
            newMonthlyPrice: offerDetails.offerPriceCents,
            currentPrice: stripeData.amount,
            originalPrice: offerDetails.originalPriceCents,
            customerId:
              (stripeData as any).customerId ||
              subscription?.customer?.id ||
              subscription?.customerId,
            subscriptionId: stripeData.id,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to apply discount');
        }

        showToast.success(
          '🎉 Custom Discount Applied!',
          `Your negotiated rate of ${formatCurrency(
            offerDetails.offerPriceCents
          )}/month has been applied!`
        );
      }

      // Create notification
      try {
        const priceAmount = hasStoredOffer
          ? storedOfferDetails?.offerPriceCents
          : offerDetails?.offerPriceCents;
        await fetch('/api/notifications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            action: 'create',
            type: 'PAYMENT',
            title: 'Custom Discount Applied! 🎉',
            message: `Your negotiated rate of ${formatCurrency(
              priceAmount || 0
            )}/month has been permanently applied.`,
          }),
        });
      } catch (notifError) {
        console.log(
          'Note: Could not create notification, but discount was applied successfully'
        );
      }

      onComplete('discounted');
      handleClose();
    } catch (error) {
      console.error('Error accepting offer:', error);
      showToast.error('Error', 'Failed to apply discount. Please try again.');

      // Show final offer as fallback
      setShowFinalOffer(true);
      setCurrentStep('final');
      setCurrentOfferCents(2000); // $20 final offer
    } finally {
      setIsLoading(false);
    }
  };

  // ✅ NEW: Handle declining offers
  const handleOfferDecline = async () => {
    // Immediately show final offer, then store in background
    setShowFinalOffer(true);
    setCurrentStep('final');
    setCurrentOfferCents(2000); // $20 final offer
    setShowOfferConfirmation(false);

    // Store the rejected offer in background (don't show loading state)
    if (!hasStoredOffer && offerDetails) {
      try {
        const stripeData = await getStripeData();
        if (stripeData) {
          await storeRejectedOffer({
            subscriptionId: stripeData.id,
            originalPriceCents: offerDetails.originalPriceCents,
            userInputCents: offerDetails.userInputCents,
            offerPriceCents: offerDetails.offerPriceCents,
            discountPercent: offerDetails.percentOff,
          });
        }
      } catch (error) {
        console.error('Error storing rejected offer in background:', error);
        // Continue silently - user already sees final offer
      }
    }
  };

  // ✅ NEW: Handle accepting final $20 offer
  const handleFinalOfferAccept = async () => {
    setIsLoading(true);

    try {
      const stripeData = await getStripeData();
      if (!stripeData) {
        throw new Error('Unable to retrieve subscription data');
      }

      const finalOfferPriceCents = 2000; // $20
      const originalPriceCents = 15000; // $150
      const percentOff = Math.round(
        ((originalPriceCents - finalOfferPriceCents) / originalPriceCents) * 100
      );

      const response = await fetch('/api/subscription/apply-coupon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          percentOff,
          newMonthlyPrice: finalOfferPriceCents,
          currentPrice: stripeData.amount,
          originalPrice: originalPriceCents,
          customerId:
            (stripeData as any).customerId ||
            subscription?.customer?.id ||
            subscription?.customerId,
          subscriptionId: stripeData.id,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to apply final discount');
      }

      showToast.success(
        '🎉 Final Offer Accepted!',
        'Your subscription has been updated to $20/month!'
      );

      onComplete('discounted');
      handleClose();
    } catch (error) {
      console.error('Error accepting final offer:', error);
      showToast.error(
        'Error',
        'Failed to apply final discount. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  // ✅ NEW: Handle declining final offer (proceed to cancellation)
  const handleFinalOfferDecline = () => {
    setStep('password');
    setShowFinalOffer(false);
  };

  const handleAcceptOffer = async () => {
    // Use finalOfferPrice or default to $20.00 (2000 cents) for the final offer
    const finalOfferPriceCents = currentOfferCents || 2000;

    // ✅ NEW: Use direct Stripe API calls instead of webhook cache
    if (!subscription || subscription.status !== 'active') {
      showToast.error('Error', 'No active subscription found');
      return;
    }

    setIsLoading(true);

    try {
      const stripeData = await getStripeData();

      if (!stripeData) {
        showToast.error(
          'Error',
          'Unable to retrieve subscription data from Stripe. Please try again.'
        );
        return;
      }

      // All calculations in cents
      const originalPriceCents = 15000; // $150.00 in cents
      const currentDiscountedPriceCents = stripeData.amount; // Keep in cents
      const currentDiscountedPriceDollars = centsToDollars(
        currentDiscountedPriceCents
      ); // For API compatibility

      const totalDiscountCents = originalPriceCents - finalOfferPriceCents;
      const percentOff = Math.round(
        (totalDiscountCents / originalPriceCents) * 100
      );

      const response = await fetch('/api/subscription/apply-coupon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          percentOff,
          newMonthlyPrice: finalOfferPriceCents, // Send in cents as API expects
          currentPrice: currentDiscountedPriceCents, // Send in cents as API expects
          originalPrice: originalPriceCents, // Send in cents as API expects
          // ✅ NEW: Use fresh Stripe data identifiers
          customerId:
            (stripeData as any).customerId ||
            subscription?.customer?.id ||
            subscription?.customerId,
          subscriptionId: stripeData.id,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        showToast.success(
          '🎉 Discount Applied Successfully!',
          `Your subscription has been updated to ${formatCurrency(
            finalOfferPriceCents
          )}/month. Check your Stripe dashboard or next invoice to confirm the discount.`
        );

        // Create a notification for the user about the permanent discount
        try {
          await fetch('/api/notifications', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              action: 'create',
              type: 'PAYMENT',
              title: 'Permanent Discount Applied! 🎉',
              message: `Your negotiated rate of ${formatCurrency(
                finalOfferPriceCents
              )}/month has been permanently applied. This discount will continue for the lifetime of your subscription.`,
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
    if (confirmationText.trim().toLowerCase() !== 'cancel subscription') {
      showToast.error('Error', 'Please type "cancel subscription" to confirm');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/subscription/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          confirmCancel: true,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        showToast.success('✅ Subscription Cancelled', data.message);
        onComplete('cancelled');
        handleClose();
      } else {
        showToast.error('Unable to Cancel Subscription', data.error);
      }
    } catch (error) {
      showToast.error('Error', 'Failed to cancel subscription');
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
                <div className='text-2xl font-bold text-white'>Daily</div>
                <div className='text-gray-300'>Live Trade Alerts</div>
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
                Building your offer...
              </div>
            ) : (
              'Next'
            )}
          </Button>
          <Button
            variant='outline'
            onClick={handleClose}
            className='w-full sm:flex-1 bg-transparent border-2 border-slate-600 text-slate-300 hover:bg-slate-700 hover:border-slate-500 min-h-[44px] rounded-xl'
          >
            Cancel
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

  const renderPasswordConfirmation = () => (
    <div className='relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white rounded-2xl shadow-2xl'>
      {/* Background Pattern */}
      <div className='absolute inset-0 bg-gradient-to-br from-red-600/5 to-orange-600/5'></div>
      <div className='absolute top-0 left-0 w-64 h-64 bg-gradient-to-br from-red-500/10 to-transparent rounded-full blur-3xl'></div>

      <div className='relative z-10 p-6 sm:p-10 space-y-6 sm:space-y-8'>
        {/* Header */}
        <div className='text-center space-y-4 sm:space-y-6'>
          <div className='mx-auto w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-red-400 to-orange-500 rounded-2xl flex items-center justify-center shadow-xl'>
            <AlertTriangle className='w-8 h-8 sm:w-10 sm:h-10 text-white' />
          </div>

          <div className='space-y-3'>
            <h2 className='text-2xl sm:text-3xl font-bold bg-gradient-to-r from-red-300 to-orange-300 bg-clip-text text-transparent leading-tight'>
              Final Confirmation
            </h2>
            <p className='text-gray-300 text-base sm:text-lg max-w-md mx-auto leading-relaxed'>
              You're about to cancel your subscription
            </p>
          </div>
        </div>

        {/* Warning Section */}
        <div className='bg-gradient-to-br from-white to-gray-50 p-6 sm:p-8 rounded-2xl text-gray-900 shadow-xl border border-gray-200/20'>
          <h3 className='text-lg sm:text-xl font-semibold text-gray-800 mb-6 text-center'>
            ⚠️ This action cannot be undone
          </h3>
          <div className='space-y-4 sm:space-y-5'>
            <div className='flex items-center gap-4'>
              <div className='w-8 h-8 bg-red-500 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg'>
                <span className='text-white text-sm font-bold'>✗</span>
              </div>
              <div>
                <span className='text-base sm:text-lg font-semibold block'>
                  Your subscription will be{' '}
                  <span className='text-red-600'>cancelled at period end</span>
                </span>
                <span className='text-gray-600 text-sm'>
                  {subscriptionEndDate
                    ? `You'll lose access on ${subscriptionEndDate}`
                    : "You'll lose access when your current billing period expires"}
                </span>
              </div>
            </div>

            <div className='flex items-center gap-4'>
              <div className='w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg'>
                <span className='text-white text-sm font-bold'>!</span>
              </div>
              <div>
                <span className='text-base sm:text-lg font-semibold block'>
                  No refunds will be processed
                </span>
                <span className='text-gray-600 text-sm'>
                  All payments are final
                </span>
              </div>
            </div>

            <div className='flex items-center gap-4'>
              <div className='w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg'>
                <span className='text-white text-sm font-bold'>💰</span>
              </div>
              <div>
                <span className='text-base sm:text-lg font-semibold block'>
                  <span className='text-purple-600'>No future discounts</span>{' '}
                  if you re-subscribe
                </span>
                <span className='text-gray-600 text-sm'>
                  You'll pay full price ($150/month) with no special offers
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Confirmation Input */}
        <div className='bg-gradient-to-br from-white to-gray-50 p-6 sm:p-8 rounded-2xl text-gray-900 shadow-xl border border-gray-200/20'>
          <div className='space-y-4 sm:space-y-5'>
            <div className='text-center'>
              <Label className='text-gray-700 text-lg sm:text-xl font-semibold block mb-2'>
                Type "cancel subscription" to confirm
              </Label>
              <p className='text-gray-500 text-sm sm:text-base'>
                This ensures you really want to proceed with cancellation
              </p>
            </div>

            <div className='relative'>
              <Input
                type='text'
                placeholder='cancel subscription'
                value={confirmationText}
                onChange={e => setConfirmationText(e.target.value)}
                className='w-full h-12 sm:h-14 text-base sm:text-lg border-2 border-gray-300 focus:border-red-400 focus:ring-2 focus:ring-red-200 rounded-xl px-4 shadow-lg text-center text-gray-900 bg-white placeholder:text-gray-500'
              />
            </div>

            <p className='text-xs sm:text-sm text-gray-600 text-center'>
              💭 Make sure you really want to cancel before typing this
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
            onClick={handleFinalCancel}
            disabled={
              isLoading ||
              confirmationText.trim().toLowerCase() !== 'cancel subscription'
            }
            className='w-full sm:flex-1 bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 disabled:cursor-not-allowed font-medium min-h-[44px] rounded-xl'
          >
            {isLoading ? (
              <div className='flex items-center gap-2'>
                <Loader2 className='w-4 h-4 animate-spin' />
                Processing...
              </div>
            ) : (
              'Cancel Subscription'
            )}
          </Button>
        </div>

        {/* Final Trust Signal */}
        <div className='text-center pt-4 border-t border-slate-700/50'>
          <p className='text-slate-400 text-xs sm:text-sm'>
            ⚠️ Final step • 🔐 Secure process • 📧 Confirmation email sent
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

      case 'password':
        return renderPasswordConfirmation();
      default:
        return renderReasonSelection();
    }
  };

  return (
    <>
      <Dialog
        open={isOpen}
        onOpenChange={open => {
          if (!open) handleClose();
        }}
      >
        <DialogContent
          onInteractOutside={e => e.preventDefault()}
          onPointerDownOutside={e => e.preventDefault()}
          className='max-w-2xl max-h-[90vh] sm:max-h-[85vh] bg-transparent border-none p-0 w-[calc(100vw-1rem)] sm:w-full flex flex-col'
        >
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

      {/* Offer Confirmation Modal */}
      {showOfferConfirmation && (
        <OfferConfirmationModal
          isOpen={showOfferConfirmation}
          onClose={() => setShowOfferConfirmation(false)}
          onAccept={handleOfferAccept}
          onDecline={handleOfferDecline}
          originalPrice={
            hasStoredOffer && storedOfferDetails
              ? centsToDollars(storedOfferDetails.originalPriceCents)
              : offerDetails
              ? centsToDollars(offerDetails.originalPriceCents)
              : 150
          }
          userInput={
            hasStoredOffer && storedOfferDetails
              ? centsToDollars(storedOfferDetails.userInputCents)
              : offerDetails
              ? centsToDollars(offerDetails.userInputCents)
              : 0
          }
          offerPrice={
            hasStoredOffer && storedOfferDetails
              ? centsToDollars(storedOfferDetails.offerPriceCents)
              : offerDetails
              ? centsToDollars(offerDetails.offerPriceCents)
              : 0
          }
          savings={
            hasStoredOffer && storedOfferDetails
              ? centsToDollars(storedOfferDetails.savingsCents)
              : offerDetails
              ? centsToDollars(offerDetails.savingsCents)
              : 0
          }
          percentOff={
            hasStoredOffer && storedOfferDetails
              ? storedOfferDetails.discountPercent
              : offerDetails
              ? offerDetails.percentOff
              : 0
          }
          isStoredOffer={hasStoredOffer}
          isLoading={isLoading}
        />
      )}

      {/* Final $20 Offer Modal */}
      {showFinalOffer && (
        <OfferConfirmationModal
          isOpen={showFinalOffer}
          onClose={() => setShowFinalOffer(false)}
          onAccept={handleFinalOfferAccept}
          onDecline={handleFinalOfferDecline}
          originalPrice={150}
          userInput={0}
          offerPrice={20}
          savings={130}
          percentOff={87}
          isStoredOffer={false}
          isLoading={isLoading}
          isFinalOffer={true}
        />
      )}
    </>
  );
}

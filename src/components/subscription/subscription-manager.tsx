'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useUser, useAuth } from '@clerk/nextjs';
import { useComprehensiveLoading } from '@/hooks/use-comprehensive-loading';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import {
  CreditCard,
  RefreshCw,
  Loader2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { showToast } from '@/lib/notifications-client';
import { makeSecureRequest } from '@/lib/csrf-client';
import { CancellationFlowModal } from '@/components/modals/cancellation-flow-modal';

interface SubscriptionDetails {
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
}

export function SubscriptionManager() {
  const { user } = useUser();
  const { userId, isLoaded } = useAuth();
  const apiLoading = useComprehensiveLoading('api');
  const [isLoading, setIsLoading] = useState(true);
  const [subscription, setSubscription] = useState<SubscriptionDetails | null>(
    null
  );
  const [isUpdatingAutoRenew, setIsUpdatingAutoRenew] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelPassword, setCancelPassword] = useState('');
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showInvoiceHistory, setShowInvoiceHistory] = useState(false);
  const [showFullHistory, setShowFullHistory] = useState(false);
  const [showCancellationFlow, setShowCancellationFlow] = useState(false);

  // Multi-step cancellation flow (legacy - keeping for backwards compatibility)
  const [cancelStep, setCancelStep] = useState<
    'reason' | 'confirmation' | 'intermediate' | 'auth'
  >('reason');
  const [selectedReason, setSelectedReason] = useState<string>('');

  // Price negotiation flow (legacy - keeping for backwards compatibility)
  const [priceInput, setPriceInput] = useState<string>('');
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [currentOffer, setCurrentOffer] = useState<number | null>(null);
  const [showFinalOffer, setShowFinalOffer] = useState(false);
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);

  const handlePriceSubmit = () => {
    const inputPrice = parseFloat(priceInput);

    if (isNaN(inputPrice) || inputPrice <= 0) {
      showToast.error('Please enter a valid price');
      return;
    }

    // Calculate offer: $5 cheaper than what they typed
    let offerPrice = inputPrice - 5;

    // Minimum offer is $19.99, but if they typed less than $24.99, offer $15
    if (inputPrice < 24.99) {
      offerPrice = 15;
    } else if (offerPrice < 19.99) {
      offerPrice = 19.99;
    }

    setCurrentOffer(offerPrice);
    setShowOfferModal(true);
  };

  const handleFinalOffer = () => {
    setShowFinalOffer(true);
  };

  const createAndApplyCoupon = async (newPrice: number) => {
    setIsApplyingCoupon(true);
    try {
      // Get the actual current discounted price the user is paying
      const currentDiscountedPrice = subscription?.stripe?.amount
        ? subscription.stripe.amount / 100
        : 0;

      // Get the original price (before any discounts)
      const originalPrice = subscription?.stripe?.originalAmount
        ? subscription.stripe.originalAmount / 100
        : currentDiscountedPrice;

      console.log(
        `🔍 Price Analysis: Original: $${originalPrice}, Current: $${currentDiscountedPrice}, Target: $${newPrice}`
      );

      if (newPrice >= currentDiscountedPrice) {
        showToast.error('Error', 'New price must be lower than current price');
        return false;
      }

      // Calculate the percentage discount needed to go from ORIGINAL price to TARGET price
      const totalDiscountAmount = originalPrice - newPrice;
      const percentOff = Math.round(
        (totalDiscountAmount / originalPrice) * 100
      );

      console.log(
        `🎯 Creating coupon: Original: $${originalPrice}, Target: $${newPrice}, Total Discount: ${percentOff}%`
      );

      const response = await makeSecureRequest(
        '/api/subscription/create-coupon',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            percentOff,
            newMonthlyPrice: newPrice,
            currentPrice: currentDiscountedPrice,
            originalPrice: originalPrice,
            customerId: subscription?.customer?.id,
            subscriptionId: subscription?.stripe?.id,
          }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        showToast.success(
          '🎉 Discount Applied!',
          `Your new rate of $${newPrice}/month has been locked in permanently!`
        );
        await refreshAndSync(); // Refresh to show new pricing
        return true;
      } else {
        showToast.error('Failed to Apply Discount', data.error);
        return false;
      }
    } catch (error) {
      console.error('❌ Error creating coupon:', error);
      showToast.error('Error', 'Failed to apply discount');
      return false;
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  const fetchSubscriptionDetails = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/subscription/details');
      if (!response.ok) {
        throw new Error('Failed to fetch subscription details');
      }
      const result = await response.json();
      if (result.success) {
        console.log('📊 Subscription details received:', result.subscription);
        console.log(
          '📅 Current period end value:',
          result.subscription?.stripe?.currentPeriodEnd
        );
        setSubscription(result.subscription);
      } else {
        throw new Error(result.message || 'Failed to get subscription data');
      }
    } catch (err: any) {
      setError(
        err.message || 'An error occurred while fetching subscription details.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  const refreshAndSync = async () => {
    if (isLoading) return; // Prevent multiple simultaneous refreshes

    setIsLoading(true);
    try {
      // First, try to sync with Stripe to get the latest data
      try {
        const syncResponse = await makeSecureRequest('/api/subscription/sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (syncResponse.ok) {
          showToast.success('🔄 Synced', 'Subscription data synchronized!');
        } else {
          const syncData = await syncResponse.json();

          showToast.warning(
            '⚠️ Partial Sync',
            'Refreshing with available data...'
          );
        }
      } catch (syncError) {
        console.log(
          '⚠️ Sync error, proceeding with refresh anyway...',
          syncError
        );
        showToast.warning('⚠️ Sync Issue', 'Refreshing with available data...');
      }

      // Always fetch subscription details (even if sync failed)
      const response = await fetch('/api/subscription/details');
      if (!response.ok) {
        throw new Error(
          `Failed to refresh subscription details: ${response.status}`
        );
      }

      const data = await response.json();

      setSubscription(data.subscription);

      showToast.success('✅ Refreshed', 'Subscription data updated!');
    } catch (error) {
      console.error('❌ Error refreshing subscription:', error);
      showToast.error(
        '❌ Refresh Error',
        'Failed to refresh subscription data'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const toggleAutoRenew = async (autoRenew: boolean) => {
    setIsUpdatingAutoRenew(true);
    try {
      const response = await makeSecureRequest(
        '/api/subscription/toggle-autorenew',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ autoRenew }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        showToast.success(
          autoRenew ? '🎉 Auto-Renewal Re-enabled' : '⚠️ Auto-Renewal Disabled',
          data.message
        );
        // Update local state
        if (subscription?.stripe) {
          setSubscription({
            ...subscription,
            stripe: {
              ...subscription.stripe,
              autoRenew: data.autoRenew,
              cancelAtPeriodEnd: !data.autoRenew,
            },
          });
        }
      } else {
        showToast.error(
          'Error',
          data.error || 'Failed to update auto-renewal setting'
        );
        // Reset local state to prevent UI inconsistency and refresh current state
        if (subscription?.stripe) {
          setSubscription({
            ...subscription,
            stripe: {
              ...subscription.stripe,
              autoRenew: !autoRenew, // Reset to opposite of what user tried to set
              cancelAtPeriodEnd: autoRenew, // Reset cancel flag too
            },
          });
        }
        await fetchSubscriptionDetails();
      }
    } catch (error) {
      console.error('❌ Frontend: Auto-renewal toggle error:', error);
      showToast.error('Error', 'Failed to toggle auto-renewal');
      // Reset local state on error
      if (subscription?.stripe) {
        setSubscription({
          ...subscription,
          stripe: {
            ...subscription.stripe,
            autoRenew: !autoRenew, // Reset to opposite of what user tried to set
            cancelAtPeriodEnd: autoRenew, // Reset cancel flag too
          },
        });
      }
      await fetchSubscriptionDetails();
    } finally {
      setIsUpdatingAutoRenew(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!cancelPassword.trim()) {
      showToast.error('Error', 'Password is required to cancel subscription');
      return;
    }

    setIsCancelling(true);
    try {
      const response = await makeSecureRequest('/api/subscription/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          password: cancelPassword,
          confirmCancel: true,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        showToast.success('✅ Auto-Renewal Disabled', data.message);
        setShowCancelDialog(false);
        setCancelPassword('');
        // Refresh subscription details
        await fetchSubscriptionDetails();
      } else {
        showToast.error('Unable to Disable Auto-Renewal', data.error);
      }
    } catch (error) {
      showToast.error('Error', 'Failed to disable auto-renewal');
    } finally {
      setIsCancelling(false);
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  const handleSync = async () => {
    try {
      setIsSyncing(true);
      await refreshAndSync();
    } catch (err: any) {
      setError(err.message || 'An error occurred while updating settings.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleToggleAutoRenew = async () => {
    const newAutoRenewValue = !subscription?.stripe?.autoRenew;

    // If user is trying to disable auto-renewal, show cancellation flow
    if (!newAutoRenewValue && subscription?.stripe?.autoRenew) {
      setShowCancellationFlow(true);
      return;
    }

    // If user is enabling auto-renewal, proceed directly
    try {
      setIsLoading(true);
      await toggleAutoRenew(newAutoRenewValue);
    } catch (err: any) {
      setError(err.message || 'Failed to toggle auto-renewal');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancellationFlowComplete = async (
    action: 'cancelled' | 'retained' | 'discounted'
  ) => {
    setShowCancellationFlow(false);

    if (action === 'cancelled') {
      // Refresh subscription details to show updated state
      await fetchSubscriptionDetails();
    } else if (action === 'discounted') {
      // Refresh subscription details to show new pricing
      await fetchSubscriptionDetails();
    }
    // If retained, just close the modal (no changes needed)
  };

  useEffect(() => {
    if (isLoaded && userId) {
      fetchSubscriptionDetails();
    }
  }, [isLoaded, userId, fetchSubscriptionDetails]);

  const cardClasses =
    'bg-white dark:bg-gray-800/50 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700/60 p-4 sm:p-8 transition-all duration-300 hover:shadow-xl hover:border-gray-300 dark:hover:border-gray-600 backdrop-blur-sm';

  const statusConfig = useMemo(() => {
    if (!subscription || !subscription.status) {
      return {
        bgColor: 'bg-green-100 dark:bg-green-900/30',
        textColor: 'text-green-600',
        textColorCls: 'text-green-600 dark:text-green-400',
        title: 'Active',
        description: (date: string) =>
          `Your subscription is active until ${date}`,
        Icon: () => (
          <div className='w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-green-500 flex items-center justify-center'>
            <svg
              className='w-4 h-4 sm:w-5 sm:h-5 text-white'
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M5 13l4 4L19 7'
              />
            </svg>
          </div>
        ),
      };
    }

    switch (subscription.status.toLowerCase()) {
      case 'active':
        return {
          bgColor: 'bg-green-100 dark:bg-green-900/30',
          textColor: 'text-green-600',
          textColorCls: 'text-green-600 dark:text-green-400',
          title: 'Active',
          description: (date: string) =>
            `Your subscription is active until ${date}`,
          Icon: () => (
            <div className='w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-green-500 flex items-center justify-center'>
              <svg
                className='w-4 h-4 sm:w-5 sm:h-5 text-white'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M5 13l4 4L19 7'
                />
              </svg>
            </div>
          ),
        };
      case 'trialing':
        return {
          bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
          textColor: 'text-yellow-600',
          textColorCls: 'text-yellow-600 dark:text-yellow-400',
          title: 'Trialing',
          description: (date: string) => `Your trial ends on ${date}`,
          Icon: () => (
            <div className='w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-yellow-500 flex items-center justify-center'>
              <svg
                className='w-4 h-4 sm:w-5 sm:h-5 text-white'
                fill='currentColor'
                viewBox='0 0 24 24'
              >
                <path d='M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z' />
              </svg>
            </div>
          ),
        };
      case 'cancelled':
        return {
          bgColor: 'bg-red-100 dark:bg-red-900/30',
          textColor: 'text-red-600',
          textColorCls: 'text-red-600 dark:text-red-400',
          title: 'Cancelled',
          description: (date: string) =>
            `Your subscription was cancelled on ${date}`,
          Icon: () => (
            <div className='w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-red-500 flex items-center justify-center'>
              <svg
                className='w-4 h-4 sm:w-5 sm:h-5 text-white'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M6 18L18 6M6 6l12 12'
                />
              </svg>
            </div>
          ),
        };
      case 'unpaid':
      case 'past_due':
        return {
          bgColor: 'bg-red-100 dark:bg-red-900/30',
          textColor: 'text-red-600',
          textColorCls: 'text-red-600 dark:text-red-400',
          title: 'Past Due',
          description: (date: string) =>
            `Your subscription is past due. Payment is required by ${date}`,
          Icon: () => (
            <div className='w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-red-500 flex items-center justify-center'>
              <svg
                className='w-4 h-4 sm:w-5 sm:h-5 text-white'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z'
                />
              </svg>
            </div>
          ),
        };
      default:
        return {
          bgColor: 'bg-gray-100 dark:bg-gray-700/30',
          textColor: 'text-gray-600',
          textColorCls: 'text-gray-600 dark:text-gray-400',
          title: 'Unknown',
          description: (date: string) =>
            `Subscription status unknown. Last updated on ${date}`,
          Icon: () => (
            <div className='w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-gray-500 flex items-center justify-center'>
              <svg
                className='w-4 h-4 sm:w-5 sm:h-5 text-white'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
                />
              </svg>
            </div>
          ),
        };
    }
  }, [subscription]);

  const renderInvoices = () => {
    return (
      <div className='text-center py-6 sm:py-8'>
        <div className='w-12 h-12 sm:w-16 sm:h-16 bg-gray-100 dark:bg-gray-700 rounded-2xl flex items-center justify-center mx-auto mb-4'>
          <CreditCard className='w-6 h-6 sm:w-8 sm:h-8 text-gray-400' />
        </div>
        <p className='text-gray-600 dark:text-gray-400 font-medium mb-2 text-sm sm:text-base'>
          No invoices available
        </p>
        <p className='text-xs sm:text-sm text-gray-500 dark:text-gray-400'>
          Your invoice history will appear here once generated
        </p>
      </div>
    );
  };

  if (!isLoaded || isLoading) {
    return (
      <Card>
        <CardContent className='flex items-center justify-center py-6'>
          <div className='flex items-center gap-2'>
            <Loader2 className='h-4 w-4 animate-spin' />
            <span>Loading subscription details...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!userId) {
    return null;
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <CreditCard className='h-5 w-5' />
            Subscription
          </CardTitle>
          <CardDescription>No subscription found</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!subscription) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <CreditCard className='h-5 w-5' />
            Subscription
          </CardTitle>
          <CardDescription>No subscription found</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const { stripe: stripeData } = subscription;

  return (
    <div className='max-w-5xl mx-auto p-3 sm:p-6 space-y-4 sm:space-y-8'>
      {/* Header Section */}
      <div className='relative overflow-hidden'>
        <div className='absolute inset-0 bg-gradient-to-r from-blue-600/10 to-purple-600/10 dark:from-blue-400/10 dark:to-purple-400/10 rounded-2xl sm:rounded-3xl'></div>
        <div
          className={`${cardClasses} relative border-2 border-blue-200/50 dark:border-blue-700/50`}
        >
          <div className='flex flex-col gap-4 sm:gap-6'>
            <div className='flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6'>
              <div className='flex items-center gap-3 sm:gap-4 w-full sm:w-auto'>
                <div className='w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg'>
                  <CreditCard className='w-6 h-6 sm:w-8 sm:h-8 text-white' />
                </div>
                <div className='flex-1 sm:flex-initial'>
                  <h2 className='text-xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-1'>
                    Subscription Management
                  </h2>
                  <p className='text-sm sm:text-lg text-gray-600 dark:text-gray-400'>
                    Manage your premium membership and billing details
                  </p>
                </div>
              </div>
              <div className='flex items-center gap-3 w-full sm:w-auto'>
                <Button
                  onClick={handleSync}
                  variant='outline'
                  size='default'
                  disabled={isSyncing}
                  className='bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm border-gray-300 dark:border-gray-600 hover:bg-white dark:hover:bg-gray-700 transition-all duration-200 shadow-md w-full sm:w-auto min-h-[44px]'
                >
                  {isSyncing ? (
                    <Loader2 className='w-4 h-4 mr-2 animate-spin' />
                  ) : (
                    <RefreshCw className='w-4 h-4 mr-2' />
                  )}
                  Refresh
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-8'>
        {/* Current Plan Card */}
        <div className={`${cardClasses} relative overflow-hidden`}>
          <div className='absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-green-400/20 to-emerald-500/20 rounded-full blur-2xl'></div>
          <div className='relative z-10'>
            <div className='flex items-center gap-3 mb-4 sm:mb-6'>
              <div className='w-3 h-3 bg-green-500 rounded-full animate-pulse'></div>
              <h3 className='font-bold text-lg sm:text-xl text-gray-800 dark:text-gray-200'>
                Current Plan
              </h3>
            </div>
            <div className='flex items-center gap-4 sm:gap-6 mb-4 sm:mb-6'>
              <div className='flex items-center justify-center'>
                <statusConfig.Icon />
              </div>
              <div className='flex-1'>
                <p
                  className={`text-xl sm:text-2xl font-bold ${statusConfig.textColorCls} mb-1`}
                >
                  {statusConfig.title}
                </p>
                <p className='text-sm sm:text-lg text-gray-600 dark:text-gray-400'>
                  Premium Plan
                </p>
              </div>
            </div>
            <div className='bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 sm:p-4'>
              <p className='text-sm sm:text-base text-gray-700 dark:text-gray-300 font-medium leading-relaxed'>
                {statusConfig.description(
                  stripeData?.currentPeriodEnd
                    ? (() => {
                        try {
                          const date = new Date(stripeData.currentPeriodEnd);
                          if (
                            isNaN(date.getTime()) ||
                            date.getFullYear() < 2020
                          ) {
                            return 'your next billing period';
                          }
                          return date.toLocaleDateString('en-US', {
                            month: 'long',
                            day: 'numeric',
                            year: 'numeric',
                          });
                        } catch (error) {
                          return 'your next billing period';
                        }
                      })()
                    : 'your next billing period'
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Billing Details Card */}
        <div className={`${cardClasses} relative overflow-hidden`}>
          <div className='absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-400/20 to-purple-500/20 rounded-full blur-2xl'></div>
          <div className='relative z-10'>
            <div className='flex items-center gap-3 mb-4 sm:mb-6'>
              <div className='w-3 h-3 bg-blue-500 rounded-full animate-pulse'></div>
              <h3 className='font-bold text-lg sm:text-xl text-gray-800 dark:text-gray-200'>
                Billing Details
              </h3>
            </div>
            {stripeData ? (
              <div className='space-y-4 sm:space-y-6'>
                {/* Price Section */}
                <div
                  className={`rounded-2xl p-4 sm:p-6 ${
                    stripeData.hasDiscount
                      ? 'bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 border-2 border-emerald-200 dark:border-emerald-700/50'
                      : 'bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20'
                  }`}
                >
                  {stripeData.hasDiscount ? (
                    // Discount Active Display
                    <div className='space-y-4'>
                      {/* Current Discounted Price */}
                      <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2'>
                        <div className='flex items-center gap-2'>
                          <span className='text-gray-600 dark:text-gray-400 font-medium text-sm sm:text-base'>
                            Your Discounted Price
                          </span>
                          <div className='flex items-center gap-1 bg-emerald-100 dark:bg-emerald-800/30 px-2 py-1 rounded-full'>
                            <div className='w-2 h-2 bg-emerald-500 rounded-full animate-pulse'></div>
                            <span className='text-xs font-semibold text-emerald-700 dark:text-emerald-300'>
                              {stripeData.discountPercent}% OFF
                            </span>
                          </div>
                        </div>
                        <div className='text-left sm:text-right'>
                          <span className='text-2xl sm:text-3xl font-bold text-emerald-600 dark:text-emerald-400'>
                            ${(stripeData.amount / 100).toFixed(2)}
                          </span>
                          <span className='text-gray-500 dark:text-gray-400 text-base sm:text-lg'>
                            /{stripeData.interval}
                          </span>
                        </div>
                      </div>

                      {/* Original Price Comparison */}
                      {stripeData.originalAmount && (
                        <div className='bg-white/60 dark:bg-gray-800/60 rounded-xl p-3 border border-emerald-200/50 dark:border-emerald-700/50'>
                          <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm'>
                            <span className='text-gray-600 dark:text-gray-400'>
                              Original Price
                            </span>
                            <div className='flex items-center gap-2'>
                              <span className='text-gray-500 dark:text-gray-400 line-through'>
                                ${(stripeData.originalAmount / 100).toFixed(2)}/
                                {stripeData.interval}
                              </span>
                              <span className='text-emerald-600 dark:text-emerald-400 font-semibold'>
                                Save $
                                {(
                                  (stripeData.originalAmount -
                                    stripeData.amount) /
                                  100
                                ).toFixed(2)}
                                /month
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Discount Details */}
                      <div className='bg-emerald-100/50 dark:bg-emerald-800/20 rounded-xl p-3'>
                        <div className='flex items-center gap-2 text-sm'>
                          <div className='w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center'>
                            <svg
                              className='w-3 h-3 text-white'
                              fill='none'
                              stroke='currentColor'
                              viewBox='0 0 24 24'
                            >
                              <path
                                strokeLinecap='round'
                                strokeLinejoin='round'
                                strokeWidth={2}
                                d='M5 13l4 4L19 7'
                              />
                            </svg>
                          </div>
                          <span className='text-emerald-700 dark:text-emerald-300 font-medium'>
                            Permanent discount applied - this rate is locked in
                            forever!
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    // No Discount Display
                    <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2'>
                      <span className='text-gray-600 dark:text-gray-400 font-medium text-sm sm:text-base'>
                        Monthly Price
                      </span>
                      <div className='text-left sm:text-right'>
                        <span className='text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white'>
                          ${(stripeData.amount / 100).toFixed(2)}
                        </span>
                        <span className='text-gray-500 dark:text-gray-400 text-base sm:text-lg'>
                          /{stripeData.interval}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Billing Date Section */}
                <div className='bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 sm:p-4'>
                  <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0'>
                    <span className='text-gray-600 dark:text-gray-400 font-medium text-sm sm:text-base'>
                      Next Billing Date
                    </span>
                    <span className='font-bold text-gray-900 dark:text-white text-base sm:text-lg'>
                      {(() => {
                        if (!stripeData.currentPeriodEnd) {
                          return 'Not available';
                        }
                        try {
                          const date = new Date(stripeData.currentPeriodEnd);
                          if (isNaN(date.getTime())) {
                            return 'Invalid date';
                          }
                          if (date.getFullYear() < 2020) {
                            return 'Date error';
                          }
                          return date.toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          });
                        } catch (error) {
                          return 'Parse error';
                        }
                      })()}
                    </span>
                  </div>
                </div>

                {/* Auto-renewal Section */}
                <div className='bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 sm:p-4'>
                  <div className='flex items-center justify-between gap-4'>
                    <div className='flex-1'>
                      <span className='text-gray-600 dark:text-gray-400 font-medium block text-sm sm:text-base'>
                        Auto-renewal
                      </span>
                      <span className='text-xs sm:text-sm text-gray-500 dark:text-gray-400'>
                        {stripeData.autoRenew
                          ? 'Subscription will auto-renew'
                          : 'Will expire at period end'}
                      </span>
                    </div>
                    <Switch
                      checked={stripeData.autoRenew}
                      onCheckedChange={handleToggleAutoRenew}
                      className='data-[state=checked]:bg-green-500 scale-110 sm:scale-125'
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className='text-center py-6 sm:py-8'>
                <div className='w-12 h-12 sm:w-16 sm:h-16 bg-gray-200 dark:bg-gray-700 rounded-2xl flex items-center justify-center mx-auto mb-4'>
                  <CreditCard className='w-6 h-6 sm:w-8 sm:h-8 text-gray-400' />
                </div>
                <p className='text-gray-500 dark:text-gray-400 font-medium text-sm sm:text-base'>
                  No active subscription found
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Invoice History */}
      <div className={`${cardClasses} relative overflow-hidden`}>
        <div className='absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-gray-400/10 to-gray-600/10 rounded-full blur-2xl'></div>
        <div className='relative z-10'>
          <div
            className='flex items-center justify-between cursor-pointer group'
            onClick={() => setShowInvoiceHistory(!showInvoiceHistory)}
          >
            <div className='flex items-center gap-3'>
              <div className='w-3 h-3 bg-gray-500 rounded-full'></div>
              <h3 className='font-bold text-lg sm:text-xl text-gray-800 dark:text-gray-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors'>
                Invoice History
              </h3>
            </div>
            <div className='flex items-center gap-2'>
              <span className='text-xs sm:text-sm text-gray-500 dark:text-gray-400 hidden sm:block'>
                {showInvoiceHistory ? 'Hide' : 'Show'} History
              </span>
              {showInvoiceHistory ? (
                <ChevronUp className='w-5 h-5 text-gray-500 group-hover:text-blue-500 transition-colors' />
              ) : (
                <ChevronDown className='w-5 h-5 text-gray-500 group-hover:text-blue-500 transition-colors' />
              )}
            </div>
          </div>
          {showInvoiceHistory && (
            <div className='mt-4 sm:mt-6 border-t border-gray-200 dark:border-gray-700 pt-4 sm:pt-6'>
              {renderInvoices()}
            </div>
          )}
        </div>
      </div>

      {/* Cancellation Flow Modal */}
      <CancellationFlowModal
        isOpen={showCancellationFlow}
        onClose={() => setShowCancellationFlow(false)}
        onComplete={handleCancellationFlowComplete}
        subscription={subscription}
      />
    </div>
  );
}

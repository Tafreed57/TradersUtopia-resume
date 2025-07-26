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
  Sparkles,
  Crown,
  TrendingDown,
  CheckCircle,
  AlertTriangle,
  Clock,
  Tag,
  Download,
  Eye,
} from 'lucide-react';
import { showToast } from '@/lib/notifications-client';
import { makeSecureRequest } from '@/lib/csrf-client';
import { CancellationFlowModal } from '@/components/modals/cancellation-flow-modal';

interface DiscountDetails {
  id: string;
  couponId?: string;
  name: string;
  percentOff?: number;
  amountOff?: number | null;
  duration: string;
  durationInMonths?: number;
  valid: boolean;
  start?: string;
  end?: string;
  currency?: string;
  maxRedemptions?: number;
  redeemBy?: string;
  timesRedeemed?: number;
  created?: string;
}

interface InvoiceData {
  id: string;
  number: string;
  status: string;
  created: string;
  due_date?: string;
  amount_paid: number;
  amount_due: number;
  total: number;
  currency: string;
  hosted_invoice_url?: string;
  invoice_pdf?: string;
  description?: string;
  period_start?: string;
  period_end?: string;
}

interface SubscriptionDetails {
  status: string;
  productId: string;
  customerId: string;
  subscriptionStart: string;
  subscriptionEnd: string;
  // Additional fields from database
  stripeSubscriptionId?: string;
  subscriptionAmount?: number;
  originalAmount?: number;
  subscriptionCurrency?: string;
  subscriptionInterval?: string;
  stripePriceId?: string;
  discountPercent?: number;
  discountName?: string;
  discountDetails?: DiscountDetails;
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
    discountDetails?: DiscountDetails;
  };
  customer?: {
    id: string;
    email: string;
    created: string;
  };
  isAdminAccess?: boolean;
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

  // ✅ NEW: Invoice-related state
  const [invoices, setInvoices] = useState<InvoiceData[]>([]);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(false);
  const [invoiceError, setInvoiceError] = useState<string | null>(null);
  const [hasLoadedInvoices, setHasLoadedInvoices] = useState(false);

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
      // ✅ ENHANCED: First check if we have sufficient subscription data
      if (!subscription || subscription.status !== 'ACTIVE') {
        showToast.error('Error', 'No active subscription found');
        return false;
      }

      // ✅ ENHANCED: Check for required subscription identifiers
      const customerId = subscription?.customer?.id || subscription?.customerId;
      const subscriptionId =
        subscription?.stripe?.id || subscription?.stripeSubscriptionId;

      if (!customerId && !subscriptionId) {
        // Try to sync data automatically first
        showToast.info('🔄 Syncing', 'Refreshing subscription data...');

        try {
          await refreshAndSync();
          showToast.success(
            '✅ Synced',
            'Please try applying the discount again.'
          );
        } catch (syncError) {
          showToast.error(
            'Error',
            'Subscription data incomplete. Please refresh the page and try again.'
          );
        }

        return false;
      }

      // ✅ NEW: Fetch fresh subscription data directly from Stripe API
      let stripeData = null;

      try {
        const response = await makeSecureRequest(
          '/api/subscription/stripe-direct',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'get_subscription_data' }),
          }
        );

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.subscription) {
            stripeData = {
              amount: data.subscription.amount,
              originalAmount: data.subscription.originalAmount,
              id: data.subscription.id,
              customerId: data.subscription.customerId,
            };
          } else {
            throw new Error(data.error || 'No subscription data returned');
          }
        } else {
          throw new Error(`API response not ok: ${response.status}`);
        }
      } catch (apiError) {
        // Fallback to existing subscription data if API fails
        if (subscription?.stripe?.amount) {
          stripeData = subscription.stripe;
        } else {
          showToast.error(
            'Error',
            'Unable to retrieve current subscription pricing. Please refresh and try again.'
          );
          return false;
        }
      }

      if (!stripeData || !stripeData.amount) {
        showToast.error(
          'Error',
          'Unable to retrieve subscription pricing data'
        );
        return false;
      }

      // Get the actual current discounted price the user is paying
      const currentDiscountedPrice = stripeData.amount / 100;

      // Get the original price (before any discounts)
      const originalPrice = stripeData.originalAmount
        ? stripeData.originalAmount / 100
        : currentDiscountedPrice;

      // ✅ ENHANCED: Better price validation
      if (originalPrice <= 0 || currentDiscountedPrice <= 0) {
        showToast.error('Error', 'Invalid pricing data detected');
        return false;
      }

      if (newPrice >= currentDiscountedPrice) {
        showToast.error(
          'Error',
          'New price must be lower than your current price'
        );
        return false;
      }

      if (newPrice <= 0) {
        showToast.error('Error', 'Price must be greater than $0');
        return false;
      }

      // Calculate the percentage discount needed to go from ORIGINAL price to TARGET price
      const totalDiscountAmount = originalPrice - newPrice;
      const percentOff = Math.round(
        (totalDiscountAmount / originalPrice) * 100
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
            customerId: (stripeData as any).customerId || customerId,
            subscriptionId: stripeData.id || subscriptionId,
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

  const statusConfig = useMemo(() => {
    if (!subscription || !subscription.status) {
      return {
        bgColor: 'bg-gray-100 dark:bg-gray-700/30',
        textColor: 'text-gray-600',
        textColorCls: 'text-gray-600 dark:text-gray-400',
        title: 'No Subscription',
        description: () => 'You do not have an active subscription',
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
                d='M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636'
              />
            </svg>
          </div>
        ),
      };
    }

    // Check for admin access first
    if (
      subscription.isAdminAccess ||
      subscription.productId === 'admin_access'
    ) {
      return {
        bgColor:
          'bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30',
        textColor: 'text-purple-600',
        textColorCls: 'text-purple-600 dark:text-purple-400',
        title: 'Admin Access',
        description: () => 'Full premium access as an administrator',
        Icon: () => (
          <div className='w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center'>
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
                d='M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z'
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
      case 'cancelled':
        return {
          bgColor:
            'bg-gradient-to-r from-orange-100 to-red-100 dark:from-orange-900/30 dark:to-red-900/30',
          textColor: 'text-orange-600',
          textColorCls: 'text-orange-600 dark:text-orange-400',
          title: 'Subscription Cancelled',
          description: (date: string) => {
            const endDate = stripeData?.currentPeriodEnd;
            if (endDate) {
              try {
                const expiryDate = new Date(endDate);
                const now = new Date();
                const isExpired = expiryDate < now;

                if (isExpired) {
                  return `Your subscription expired on ${expiryDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}. Premium access has ended.`;
                } else {
                  const daysLeft = Math.ceil(
                    (expiryDate.getTime() - now.getTime()) /
                      (1000 * 60 * 60 * 24)
                  );
                  return `Access continues until ${expiryDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} (${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} remaining)`;
                }
              } catch (error) {
                return 'Your subscription has been cancelled and will not renew';
              }
            }
            return 'Your subscription has been cancelled and will not renew';
          },
          Icon: () => (
            <div className='w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-gradient-to-r from-orange-500 to-red-500 flex items-center justify-center'>
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
                  d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.314 16.5c-.77.833.192 2.5 1.732 2.5z'
                />
              </svg>
            </div>
          ),
        };
      case 'free':
        return {
          bgColor: 'bg-blue-100 dark:bg-blue-900/30',
          textColor: 'text-blue-600',
          textColorCls: 'text-blue-600 dark:text-blue-400',
          title: 'Free Account',
          description: () => 'You have access to free content only',
          Icon: () => (
            <div className='w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-blue-500 flex items-center justify-center'>
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
                  d='M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z'
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
          title: 'Unknown Status',
          description: () => 'Unable to determine subscription status',
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

  const cardClasses =
    'bg-white dark:bg-gray-800/50 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700/60 p-4 sm:p-8 transition-all duration-300 hover:shadow-xl hover:border-gray-300 dark:hover:border-gray-600 backdrop-blur-sm';

  // ✅ FIXED: Handle both new webhook data and legacy subscription data
  const stripeData = useMemo(() => {
    if (subscription?.stripe) {
      return subscription.stripe;
    }

    // Create fallback stripe data from subscription details if active
    if (
      subscription?.status === 'ACTIVE' ||
      subscription?.status === 'active'
    ) {
      return {
        id:
          subscription.stripeSubscriptionId ||
          subscription.customerId ||
          'legacy',
        status: subscription.status?.toLowerCase() || 'active',
        currentPeriodStart: subscription.subscriptionStart,
        currentPeriodEnd: subscription.subscriptionEnd,
        cancelAtPeriodEnd: false,
        canceledAt: null,
        autoRenew: true,
        priceId: subscription.stripePriceId || 'legacy_price',
        amount: subscription.subscriptionAmount
          ? // ✅ FIXED: Database stores cents, use directly
            subscription.subscriptionAmount
          : 14999,
        originalAmount: subscription.originalAmount
          ? // ✅ FIXED: Database stores cents, use directly
            subscription.originalAmount
          : subscription.subscriptionAmount
            ? subscription.subscriptionAmount
            : 14999,
        currency: subscription.subscriptionCurrency || 'usd',
        interval: subscription.subscriptionInterval || 'month',
        trialStart: null,
        trialEnd: null,
        created: subscription.subscriptionStart,
        pauseStartDate: null,
        discountPercent: subscription.discountPercent || null,
        discountAmount: null,
        hasDiscount: !!(
          subscription.discountPercent && subscription.discountPercent > 0
        ),
        discountDetails:
          subscription.discountPercent && subscription.discountPercent > 0
            ? subscription.discountDetails || {
                id: 'legacy_discount',
                name: subscription.discountName || 'Applied Discount',
                percentOff: subscription.discountPercent,
                amountOff: null,
                duration: 'unknown',
                valid: true,
              }
            : null,
      };
    }

    return null;
  }, [subscription]);

  // ✅ ENHANCED: Check if subscription data is incomplete (exclude admin users)
  const isSubscriptionDataIncomplete =
    subscription?.status === 'ACTIVE' &&
    subscription?.stripeSubscriptionId === undefined &&
    subscription?.subscriptionAmount === undefined &&
    !subscription?.isAdminAccess; // Don't show warning for admin users

  // ✅ NEW: Add backfill subscription data function
  const backfillSubscriptionData = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(
        '/api/subscription/backfill-subscription-ids',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const data = await response.json();

      if (data.success) {
        showToast.success(
          data.alreadyPopulated
            ? 'Subscription data is already up to date'
            : 'Subscription data updated successfully'
        );

        // Refresh subscription data
        await fetchSubscriptionDetails();
      } else {
        showToast.error(data.error || 'Failed to update subscription data');
      }
    } catch (error) {
      console.error('Failed to backfill subscription data:', error);
      showToast.error('Failed to update subscription data');
    } finally {
      setIsLoading(false);
    }
  };

  // ✅ NEW: Function to fetch invoices from Stripe
  const fetchInvoices = async () => {
    if (hasLoadedInvoices || isLoadingInvoices) return; // Don't fetch if already loaded or loading

    setIsLoadingInvoices(true);
    setInvoiceError(null);

    try {
      const response = await makeSecureRequest('/api/invoices', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch invoices: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        setInvoices(data.invoices || []);
        setHasLoadedInvoices(true);
      } else {
        throw new Error(data.error || 'Failed to load invoices');
      }
    } catch (error) {
      console.error('❌ Error fetching invoices:', error);
      setInvoiceError(
        error instanceof Error ? error.message : 'Failed to load invoices'
      );
      showToast.error('Error', 'Failed to load invoice history');
    } finally {
      setIsLoadingInvoices(false);
    }
  };

  // ✅ UPDATED: Handle invoice history toggle with fetching
  const handleInvoiceHistoryToggle = () => {
    const newShowState = !showInvoiceHistory;
    setShowInvoiceHistory(newShowState);

    // If showing and we have an active subscription, fetch invoices
    if (
      newShowState &&
      subscription?.status === 'ACTIVE' &&
      !hasLoadedInvoices
    ) {
      fetchInvoices();
    }
  };

  const renderInvoices = () => {
    // Loading state
    if (isLoadingInvoices) {
      return (
        <div className='text-center py-6 sm:py-8'>
          <div className='w-12 h-12 sm:w-16 sm:h-16 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4'>
            <Loader2 className='w-6 h-6 sm:w-8 sm:h-8 text-blue-500 animate-spin' />
          </div>
          <p className='text-blue-600 dark:text-blue-400 font-medium mb-2 text-sm sm:text-base'>
            Loading invoices...
          </p>
          <p className='text-xs sm:text-sm text-gray-500 dark:text-gray-400'>
            Fetching your billing history from Stripe
          </p>
        </div>
      );
    }

    // Error state
    if (invoiceError) {
      return (
        <div className='text-center py-6 sm:py-8'>
          <div className='w-12 h-12 sm:w-16 sm:h-16 bg-red-100 dark:bg-red-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4'>
            <AlertTriangle className='w-6 h-6 sm:w-8 sm:h-8 text-red-500' />
          </div>
          <p className='text-red-600 dark:text-red-400 font-medium mb-2 text-sm sm:text-base'>
            Failed to load invoices
          </p>
          <p className='text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-4'>
            {invoiceError}
          </p>
          <Button
            onClick={() => {
              setHasLoadedInvoices(false);
              fetchInvoices();
            }}
            variant='outline'
            size='sm'
            className='text-red-600 border-red-300 hover:bg-red-50 dark:hover:bg-red-900/20'
          >
            <RefreshCw className='w-4 h-4 mr-2' />
            Try Again
          </Button>
        </div>
      );
    }

    // No invoices state
    if (invoices.length === 0) {
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
    }

    // Display invoices in a table
    const displayedInvoices = showFullHistory ? invoices : invoices.slice(0, 5);

    return (
      <div className='space-y-4'>
        {/* Invoice Table */}
        <div className='overflow-x-auto'>
          <table className='w-full text-sm'>
            <thead>
              <tr className='border-b border-gray-200 dark:border-gray-700'>
                <th className='text-left py-3 px-2 font-semibold text-gray-700 dark:text-gray-300'>
                  Invoice
                </th>
                <th className='text-left py-3 px-2 font-semibold text-gray-700 dark:text-gray-300 hidden sm:table-cell'>
                  Date
                </th>
                <th className='text-left py-3 px-2 font-semibold text-gray-700 dark:text-gray-300'>
                  Amount
                </th>
                <th className='text-left py-3 px-2 font-semibold text-gray-700 dark:text-gray-300'>
                  Status
                </th>
                <th className='text-right py-3 px-2 font-semibold text-gray-700 dark:text-gray-300'>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {displayedInvoices.map(invoice => (
                <tr
                  key={invoice.id}
                  className='border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors'
                >
                  <td className='py-4 px-2'>
                    <div>
                      <div className='font-medium text-gray-900 dark:text-white'>
                        {invoice.number || `#${invoice.id.slice(-8)}`}
                      </div>
                      {invoice.description && (
                        <div className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
                          {invoice.description}
                        </div>
                      )}
                      {/* Show date on mobile */}
                      <div className='text-xs text-gray-500 dark:text-gray-400 mt-1 sm:hidden'>
                        {new Date(invoice.created).toLocaleDateString()}
                      </div>
                    </div>
                  </td>
                  <td className='py-4 px-2 text-gray-600 dark:text-gray-400 hidden sm:table-cell'>
                    {new Date(invoice.created).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </td>
                  <td className='py-4 px-2'>
                    <div className='font-semibold text-gray-900 dark:text-white'>
                      {formatCurrency(invoice.total, invoice.currency)}
                    </div>
                    {invoice.amount_due > 0 && (
                      <div className='text-xs text-orange-600 dark:text-orange-400'>
                        Due:{' '}
                        {formatCurrency(invoice.amount_due, invoice.currency)}
                      </div>
                    )}
                  </td>
                  <td className='py-4 px-2'>
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        invoice.status === 'paid'
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                          : invoice.status === 'open'
                            ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                            : invoice.status === 'void'
                              ? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                              : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                      }`}
                    >
                      {invoice.status.charAt(0).toUpperCase() +
                        invoice.status.slice(1)}
                    </span>
                  </td>
                  <td className='py-4 px-2 text-right'>
                    <div className='flex justify-end gap-2'>
                      {invoice.hosted_invoice_url && (
                        <Button
                          onClick={() =>
                            window.open(invoice.hosted_invoice_url, '_blank')
                          }
                          variant='ghost'
                          size='sm'
                          className='h-8 w-8 p-0 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                          title='View Invoice'
                        >
                          <Eye className='w-4 h-4 text-blue-600 dark:text-blue-400' />
                        </Button>
                      )}
                      {invoice.invoice_pdf && (
                        <Button
                          onClick={() =>
                            window.open(invoice.invoice_pdf, '_blank')
                          }
                          variant='ghost'
                          size='sm'
                          className='h-8 w-8 p-0 hover:bg-green-50 dark:hover:bg-green-900/20'
                          title='Download PDF'
                        >
                          <Download className='w-4 h-4 text-green-600 dark:text-green-400' />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Show More/Less Button */}
        {invoices.length > 5 && (
          <div className='text-center pt-4 border-t border-gray-200 dark:border-gray-700'>
            <Button
              onClick={() => setShowFullHistory(!showFullHistory)}
              variant='ghost'
              size='sm'
              className='text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20'
            >
              {showFullHistory ? (
                <>
                  <ChevronUp className='w-4 h-4 mr-2' />
                  Show Less
                </>
              ) : (
                <>
                  <ChevronDown className='w-4 h-4 mr-2' />
                  Show All {invoices.length} Invoices
                </>
              )}
            </Button>
          </div>
        )}

        {/* Summary */}
        <div className='bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 mt-4'>
          <div className='text-center text-sm text-gray-600 dark:text-gray-400'>
            Showing {displayedInvoices.length} of {invoices.length} invoice
            {invoices.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>
    );
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

  const handleToggleAutoRenew = async () => {
    // ✅ FIXED: Use stripeData instead of subscription?.stripe for legacy data compatibility
    const newAutoRenewValue = !stripeData?.autoRenew;

    // If user is trying to disable auto-renewal, show cancellation flow
    if (!newAutoRenewValue && stripeData?.autoRenew) {
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

  // ✅ FIXED: Fetch subscription details on component mount
  useEffect(() => {
    if (isLoaded && userId) {
      fetchSubscriptionDetails();
    }
  }, [isLoaded, userId, fetchSubscriptionDetails]);

  // ✅ AUTO-REFRESH: Automatically refresh when subscription data is incomplete
  useEffect(() => {
    if (
      subscription &&
      subscription.status === 'ACTIVE' &&
      !subscription.subscriptionAmount &&
      !isLoading
    ) {
      // Small delay to avoid rapid-fire requests
      const timer = setTimeout(() => {
        fetchSubscriptionDetails();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [subscription, isLoading, fetchSubscriptionDetails]);

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
          showToast.warning(
            '⚠️ Partial Sync',
            'Refreshing with available data...'
          );
        }
      } catch (syncError) {
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

  const handleForceSync = async () => {
    try {
      setIsSyncing(true);

      const response = await makeSecureRequest('/api/subscription/force-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (data.success) {
        showToast.success(
          '🎉 Sync Complete!',
          'Your subscription data has been forcefully synced from Stripe!'
        );

        // Refresh the subscription details to show updated data
        await fetchSubscriptionDetails();
      } else {
        showToast.error(
          'Sync Failed',
          data.message || 'Failed to sync subscription data'
        );
      }
    } catch (err: any) {
      showToast.error(
        'Sync Error',
        'Network error while syncing. Please try again.'
      );
    } finally {
      setIsSyncing(false);
    }
  };

  // ✅ NEW: Enhanced discount rendering function
  const renderDiscountDetails = (discountDetails: DiscountDetails) => {
    const isExpiring =
      discountDetails.end &&
      new Date(discountDetails.end) <
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // Expires within 30 days
    const hasExpired =
      discountDetails.end && new Date(discountDetails.end) < new Date();

    return (
      <div className='space-y-3'>
        {/* Discount Header */}
        <div className='flex items-center gap-2 flex-wrap'>
          <div className='inline-flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-green-500 text-white px-3 py-1 rounded-full text-sm font-bold shadow-md'>
            <Tag className='w-4 h-4' />
            <span>{discountDetails.name}</span>
          </div>
          {hasExpired && (
            <div className='inline-flex items-center gap-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-2 py-1 rounded-full text-xs font-medium'>
              <AlertTriangle className='w-3 h-3' />
              Expired
            </div>
          )}
          {isExpiring && !hasExpired && (
            <div className='inline-flex items-center gap-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-1 rounded-full text-xs font-medium'>
              <Clock className='w-3 h-3' />
              Expiring Soon
            </div>
          )}
        </div>

        {/* Discount Amount */}
        <div className='text-center'>
          <div className='text-2xl font-bold text-emerald-600 dark:text-emerald-400'>
            {discountDetails.percentOff && `${discountDetails.percentOff}% OFF`}
            {discountDetails.amountOff &&
              !discountDetails.percentOff &&
              `$${(discountDetails.amountOff / 100).toFixed(2)} OFF`}
          </div>
          {discountDetails.duration && (
            <div className='text-sm text-gray-600 dark:text-gray-400'>
              Duration: {discountDetails.duration}
              {discountDetails.durationInMonths &&
                ` (${discountDetails.durationInMonths} months)`}
            </div>
          )}
        </div>

        {/* Discount Timeline */}
        {(discountDetails.start || discountDetails.end) && (
          <div className='bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 space-y-2'>
            <div className='text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide'>
              Discount Timeline
            </div>
            {discountDetails.start && (
              <div className='flex justify-between text-sm'>
                <span className='text-gray-600 dark:text-gray-400'>
                  Started:
                </span>
                <span className='font-medium'>
                  {new Date(discountDetails.start).toLocaleDateString()}
                </span>
              </div>
            )}
            {discountDetails.end && (
              <div className='flex justify-between text-sm'>
                <span className='text-gray-600 dark:text-gray-400'>
                  {hasExpired ? 'Expired:' : 'Expires:'}
                </span>
                <span
                  className={`font-medium ${hasExpired ? 'text-red-600 dark:text-red-400' : isExpiring ? 'text-amber-600 dark:text-amber-400' : ''}`}
                >
                  {new Date(discountDetails.end).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Additional Details */}
        {(discountDetails.maxRedemptions ||
          discountDetails.timesRedeemed !== undefined) && (
          <div className='bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 space-y-2'>
            <div className='text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wide'>
              Usage Statistics
            </div>
            {discountDetails.timesRedeemed !== undefined && (
              <div className='flex justify-between text-sm'>
                <span className='text-blue-600 dark:text-blue-400'>
                  Times Used:
                </span>
                <span className='font-medium text-blue-700 dark:text-blue-300'>
                  {discountDetails.timesRedeemed}
                  {discountDetails.maxRedemptions &&
                    ` / ${discountDetails.maxRedemptions}`}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

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

                {/* Health Check for Incomplete Subscription Data */}
                {isSubscriptionDataIncomplete && (
                  <div className='mb-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg'>
                    <div className='flex items-start gap-3'>
                      <AlertTriangle className='w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0' />
                      <div>
                        <h4 className='font-semibold text-amber-800 dark:text-amber-200 mb-1'>
                          Subscription Data Incomplete
                        </h4>
                        <p className='text-sm text-amber-700 dark:text-amber-300 mb-3'>
                          Some subscription details are missing. This can be
                          fixed automatically.
                        </p>
                        <Button
                          onClick={backfillSubscriptionData}
                          variant='outline'
                          size='sm'
                          disabled={isLoading}
                          className='bg-amber-100 dark:bg-amber-900/40 border-amber-300 dark:border-amber-700 hover:bg-amber-200 dark:hover:bg-amber-800/60 text-amber-800 dark:text-amber-200'
                        >
                          {isLoading ? (
                            <Loader2 className='w-4 h-4 mr-2 animate-spin' />
                          ) : (
                            <RefreshCw className='w-4 h-4 mr-2' />
                          )}
                          Sync Subscription Data
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Subscription Overview Section */}
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
                {statusConfig?.Icon && <statusConfig.Icon />}
              </div>
              <div className='flex-1'>
                <p
                  className={`text-xl sm:text-2xl font-bold ${statusConfig.textColorCls} mb-1`}
                >
                  {statusConfig.title}
                </p>
                <p className='text-sm sm:text-lg text-gray-600 dark:text-gray-400'>
                  {subscription?.isAdminAccess ||
                  subscription?.productId === 'admin_access'
                    ? 'Admin Access'
                    : subscription?.product?.name || 'Premium Plan'}
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

            {/* ✅ NEW: Special Cancelled Subscription Section */}
            {subscription?.status?.toLowerCase() === 'cancelled' && (
              <div className='mb-6'>
                <div className='bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 border-2 border-orange-200 dark:border-orange-700/50 rounded-2xl p-6 space-y-4'>
                  {/* Header */}
                  <div className='text-center'>
                    <div className='inline-flex items-center gap-2 bg-gradient-to-r from-orange-500 to-red-500 text-white px-4 py-2 rounded-full shadow-lg mb-3'>
                      <AlertTriangle className='w-5 h-5' />
                      <span className='font-bold text-lg'>
                        Subscription Cancelled
                      </span>
                    </div>
                  </div>

                  {/* Status Message */}
                  <div className='text-center space-y-3'>
                    {stripeData?.currentPeriodEnd ? (
                      (() => {
                        const endDate = new Date(stripeData.currentPeriodEnd);
                        const now = new Date();
                        const isExpired = endDate < now;
                        const daysLeft = Math.ceil(
                          (endDate.getTime() - now.getTime()) /
                            (1000 * 60 * 60 * 24)
                        );

                        return (
                          <div className='space-y-3'>
                            <div className='text-lg sm:text-xl font-semibold text-orange-700 dark:text-orange-300'>
                              {isExpired
                                ? 'Your Premium Access Has Ended'
                                : `${daysLeft} ${daysLeft === 1 ? 'Day' : 'Days'} of Premium Access Remaining`}
                            </div>
                            <div className='text-sm sm:text-base text-orange-600 dark:text-orange-400'>
                              {isExpired ? (
                                <>
                                  Your subscription expired on{' '}
                                  <strong>
                                    {endDate.toLocaleDateString('en-US', {
                                      month: 'long',
                                      day: 'numeric',
                                      year: 'numeric',
                                    })}
                                  </strong>
                                </>
                              ) : (
                                <>
                                  Access continues until{' '}
                                  <strong>
                                    {endDate.toLocaleDateString('en-US', {
                                      month: 'long',
                                      day: 'numeric',
                                      year: 'numeric',
                                    })}
                                  </strong>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })()
                    ) : (
                      <div className='text-lg font-semibold text-orange-700 dark:text-orange-300'>
                        Your subscription has been cancelled and will not renew
                      </div>
                    )}
                  </div>

                  {/* What This Means Section */}
                  <div className='bg-white/80 dark:bg-gray-800/80 rounded-xl p-4 space-y-3'>
                    <h4 className='font-semibold text-orange-800 dark:text-orange-200 flex items-center gap-2'>
                      <Clock className='w-4 h-4' />
                      What This Means
                    </h4>
                    <ul className='text-sm text-orange-700 dark:text-orange-300 space-y-2'>
                      <li className='flex items-start gap-2'>
                        <span className='text-orange-500 mt-0.5'>•</span>
                        <span>
                          Your subscription will not automatically renew
                        </span>
                      </li>
                      <li className='flex items-start gap-2'>
                        <span className='text-orange-500 mt-0.5'>•</span>
                        <span>
                          {stripeData?.currentPeriodEnd &&
                          new Date(stripeData.currentPeriodEnd) > new Date()
                            ? 'You retain full access until your current billing period ends'
                            : 'Your premium access has ended - you now have free access only'}
                        </span>
                      </li>
                      <li className='flex items-start gap-2'>
                        <span className='text-orange-500 mt-0.5'>•</span>
                        <span>
                          You can reactivate anytime to restore full premium
                          features
                        </span>
                      </li>
                    </ul>
                  </div>

                  {/* Reactivation CTA */}
                  <div className='text-center pt-2'>
                    <Button
                      onClick={() => (window.location.href = '/pricing')}
                      className='bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-6 py-3 rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105'
                    >
                      <Crown className='w-4 h-4 mr-2' />
                      Reactivate Subscription
                    </Button>
                    <p className='text-xs text-orange-600 dark:text-orange-400 mt-2'>
                      Restore full access to premium trading alerts and content
                    </p>
                  </div>
                </div>
              </div>
            )}

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
                    // Enhanced Discount Active Display
                    <div className='space-y-4'>
                      {/* Discount Header */}
                      <div className='text-center pb-2'>
                        <div className='inline-flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-green-500 text-white px-4 py-2 rounded-full shadow-lg'>
                          <Sparkles className='w-4 h-4 animate-pulse' />
                          <span className='font-bold text-sm'>
                            🎉 SPECIAL DISCOUNT ACTIVE
                          </span>
                          <Sparkles className='w-4 h-4 animate-pulse' />
                        </div>
                      </div>

                      {/* Current Discounted Price - Made More Prominent */}
                      <div className='bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-900/30 dark:to-green-900/30 rounded-2xl p-6 border-2 border-emerald-200 dark:border-emerald-700/50 shadow-lg'>
                        <div className='text-center space-y-3'>
                          <div className='flex items-center justify-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold'>
                            <Crown className='w-5 h-5' />
                            <span className='text-lg'>
                              Your Negotiated Price
                            </span>
                          </div>

                          <div className='space-y-2'>
                            <div className='text-4xl sm:text-5xl font-black text-emerald-600 dark:text-emerald-400'>
                              ${(stripeData.amount / 100).toFixed(2)}
                            </div>
                            <div className='text-emerald-600 dark:text-emerald-400 text-lg font-medium'>
                              per {stripeData.interval} • locked forever
                            </div>
                          </div>

                          {/* Discount Badge */}
                          <div className='inline-flex items-center gap-2 bg-gradient-to-r from-orange-500 to-red-500 text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg'>
                            <TrendingDown className='w-4 h-4' />
                            <span>{stripeData.discountPercent}% OFF</span>
                          </div>
                        </div>
                      </div>

                      {/* Price Comparison - Enhanced */}
                      <div className='bg-white/60 dark:bg-gray-800/60 rounded-2xl p-4 border border-emerald-200/50 dark:border-emerald-700/50'>
                        <div className='grid grid-cols-2 gap-4 text-center'>
                          <div className='space-y-2'>
                            <div className='text-gray-500 dark:text-gray-400 text-sm font-medium'>
                              Original Price
                            </div>
                            <div className='text-2xl font-bold text-gray-500 dark:text-gray-400 line-through opacity-75'>
                              $
                              {stripeData.originalAmount
                                ? (stripeData.originalAmount / 100).toFixed(2)
                                : '150.00'}
                            </div>
                          </div>
                          <div className='space-y-2'>
                            <div className='text-emerald-600 dark:text-emerald-400 text-sm font-medium'>
                              You Save
                            </div>
                            <div className='text-2xl font-bold text-emerald-600 dark:text-emerald-400'>
                              $
                              {(
                                ((stripeData.originalAmount || 15000) -
                                  stripeData.amount) /
                                100
                              ).toFixed(2)}
                            </div>
                            <div className='text-emerald-600 dark:text-emerald-400 text-xs font-medium'>
                              every month
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* ✅ NEW: Enhanced Discount Details */}
                      {stripeData.discountDetails && (
                        <div className='bg-gradient-to-r from-emerald-100/80 to-green-100/80 dark:from-emerald-800/20 dark:to-green-800/20 rounded-xl p-4 border border-emerald-200 dark:border-emerald-700/50'>
                          {renderDiscountDetails(stripeData.discountDetails)}
                        </div>
                      )}

                      {/* Success Message */}
                      <div className='bg-gradient-to-r from-emerald-100/80 to-green-100/80 dark:from-emerald-800/20 dark:to-green-800/20 rounded-xl p-4 border border-emerald-200 dark:border-emerald-700/50'>
                        <div className='flex items-center gap-3'>
                          <div className='w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0'>
                            <CheckCircle className='w-4 h-4 text-white' />
                          </div>
                          <div className='text-emerald-700 dark:text-emerald-300'>
                            <div className='font-semibold text-sm sm:text-base'>
                              🎉 Congratulations! Your custom discount is active
                            </div>
                            <div className='text-xs sm:text-sm opacity-90'>
                              This special rate is locked in permanently - it
                              will never increase
                            </div>
                          </div>
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

                {/* Auto-renewal Section - Hide for cancelled subscriptions */}
                {subscription?.status?.toLowerCase() !== 'cancelled' && (
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
                        onCheckedChange={checked => {
                          handleToggleAutoRenew();
                        }}
                        className='data-[state=checked]:bg-green-500 scale-110 sm:scale-125'
                      />
                    </div>
                  </div>
                )}

                {/* ✅ NEW: Cancelled Subscription Message */}
                {subscription?.status?.toLowerCase() === 'cancelled' && (
                  <div className='bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700/50 rounded-xl p-3 sm:p-4'>
                    <div className='text-center'>
                      <div className='text-orange-700 dark:text-orange-300 font-medium text-sm sm:text-base mb-1'>
                        Subscription Status: Cancelled
                      </div>
                      <div className='text-xs sm:text-sm text-orange-600 dark:text-orange-400'>
                        This subscription will not renew and billing has stopped
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className='text-center py-6 sm:py-8'>
                <div className='w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4'>
                  <Crown className='w-6 h-6 sm:w-8 sm:h-8 text-white' />
                </div>
                <p className='text-gray-900 dark:text-gray-100 font-bold text-lg sm:text-xl mb-2'>
                  Upgrade to Premium
                </p>
                <p className='text-gray-500 dark:text-gray-400 text-sm sm:text-base mb-6'>
                  Get access to exclusive trading alerts, live classes, and
                  premium content
                </p>
                <Button
                  onClick={() => (window.location.href = '/pricing')}
                  className='bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-6 py-3 rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105'
                >
                  <Crown className='w-4 h-4 mr-2' />
                  View Pricing Plans
                </Button>
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
            onClick={handleInvoiceHistoryToggle}
          >
            <div className='flex items-center gap-3'>
              <div className='w-3 h-3 bg-gray-500 rounded-full'></div>
              <h3 className='font-bold text-lg sm:text-xl text-gray-800 dark:text-gray-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors'>
                Invoice History
              </h3>
              {isLoadingInvoices && (
                <Loader2 className='w-4 h-4 text-blue-500 animate-spin' />
              )}
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
      {subscription && (
        <CancellationFlowModal
          isOpen={showCancellationFlow}
          onClose={() => setShowCancellationFlow(false)}
          onComplete={handleCancellationFlowComplete}
          subscription={subscription as any}
        />
      )}
    </div>
  );
}

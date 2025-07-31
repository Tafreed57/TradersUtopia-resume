'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useUser, useAuth } from '@clerk/nextjs';
import { useComprehensiveLoading } from '@/hooks/use-comprehensive-loading';
import { Button } from '@/components/ui/button';
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
import { formatCurrency, centsToDollars } from '@/lib/utils';

interface DiscountInfo {
  id: string;
  name: string;
  amountOff?: number | null;
  percentOff?: number | null;
  currency?: string;
  duration: string;
  durationInMonths?: number;
  maxRedemptions?: number;
  timesRedeemed?: number;
  valid: boolean;
  created: string;
}

interface SubscriptionData {
  isActive: boolean;
  total: number;
  currency: string;
  discounts: DiscountInfo[];
}

interface DetailedSubscription {
  hasAccess: boolean;
  subscriptionStatus: string;
  isActive: boolean;
  subscription: any;
  customer: any;
  dataSource: string;
  metadata: {
    lastDatabaseUpdate: string;
    hasStripeConnection: boolean;
    isActive: boolean;
    daysUntilExpiry?: number | null;
    dataFreshness: string;
    adminNote?: string;
    error?: string;
  };
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

export function SubscriptionManager() {
  const { user } = useUser();
  const { userId, isLoaded } = useAuth();
  const apiLoading = useComprehensiveLoading('api');

  // Subscription state
  const [isLoading, setIsLoading] = useState(true);
  const [subscription, setSubscription] = useState<SubscriptionData | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  // UI state
  const [showCancellationFlow, setShowCancellationFlow] = useState(false);
  const [showInvoiceHistory, setShowInvoiceHistory] = useState(false);
  const [showFullHistory, setShowFullHistory] = useState(false);

  // Invoice state
  const [invoices, setInvoices] = useState<InvoiceData[]>([]);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(false);
  const [invoiceError, setInvoiceError] = useState<string | null>(null);
  const [hasLoadedInvoices, setHasLoadedInvoices] = useState(false);

  const statusConfig = useMemo(() => {
    if (!subscription) {
      return {
        bgColor: 'bg-gray-100 dark:bg-gray-700/30',
        textColor: 'text-gray-600',
        textColorCls: 'text-gray-600 dark:text-gray-400',
        title: 'Loading...',
        description: () => 'Checking subscription status',
        Icon: () => (
          <div className='w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-gray-500 flex items-center justify-center'>
            <Loader2 className='w-4 h-4 sm:w-5 sm:h-5 text-white animate-spin' />
          </div>
        ),
      };
    }

    // Active subscription
    if (subscription.isActive) {
      return {
        bgColor: 'bg-green-100 dark:bg-green-900/30',
        textColor: 'text-green-600',
        textColorCls: 'text-green-600 dark:text-green-400',
        title: 'Active',
        description: (date: string) =>
          `Your subscription is active until ${date}`,
        Icon: () => (
          <div className='w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-green-500 flex items-center justify-center'>
            <CheckCircle className='w-4 h-4 sm:w-5 sm:h-5 text-white' />
          </div>
        ),
      };
    }

    // Free user
    return {
      bgColor: 'bg-blue-100 dark:bg-blue-900/30',
      textColor: 'text-blue-600',
      textColorCls: 'text-blue-600 dark:text-blue-400',
      title: 'Free Account',
      description: () => 'You have access to free content only',
      Icon: () => (
        <div className='w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-blue-500 flex items-center justify-center'>
          <Crown className='w-4 h-4 sm:w-5 sm:h-5 text-white' />
        </div>
      ),
    };
  }, [subscription]);

  const cardClasses =
    'bg-white dark:bg-gray-800/50 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700/60 p-4 sm:p-8 transition-all duration-300 hover:shadow-xl hover:border-gray-300 dark:hover:border-gray-600 backdrop-blur-sm';

  // Fetch subscription data
  const fetchSubscription = useCallback(async () => {
    if (!userId) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/subscription');
      if (!response.ok) {
        throw new Error('Failed to fetch subscription');
      }

      const data = await response.json();
      setSubscription(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch subscription data');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  // Fetch invoices from Stripe
  const fetchInvoices = async () => {
    if (hasLoadedInvoices || isLoadingInvoices || !subscription?.isActive)
      return;

    setIsLoadingInvoices(true);
    setInvoiceError(null);

    try {
      const response = await makeSecureRequest('/api/invoices', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
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
      console.error('Error fetching invoices:', error);
      setInvoiceError(
        error instanceof Error ? error.message : 'Failed to load invoices'
      );
      showToast.error('Error', 'Failed to load invoice history');
    } finally {
      setIsLoadingInvoices(false);
    }
  };

  // Handle invoice history toggle
  const handleInvoiceHistoryToggle = () => {
    const newShowState = !showInvoiceHistory;
    setShowInvoiceHistory(newShowState);

    if (newShowState && subscription?.isActive && !hasLoadedInvoices) {
      fetchInvoices();
    }
  };

  // Handle cancellation flow
  const handleCancellationFlowComplete = async (
    action: 'cancelled' | 'retained' | 'discounted'
  ) => {
    setShowCancellationFlow(false);

    if (action === 'cancelled' || action === 'discounted') {
      // Refresh subscription data to show updated state
      await fetchSubscription();
    }
  };

  // Refresh subscription data
  const refreshSubscription = async () => {
    if (isLoading) return;

    setIsLoading(true);
    try {
      await fetchSubscription();
      showToast.success('✅ Refreshed', 'Subscription data updated!');
    } catch (error) {
      console.error('Error refreshing subscription:', error);
      showToast.error(
        '❌ Refresh Error',
        'Failed to refresh subscription data'
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Render discount details
  const renderDiscountDetails = (discount: DiscountInfo) => {
    const isExpiring = false; // We can add expiration logic if needed
    const hasExpired = false;

    return (
      <div className='space-y-3'>
        <div className='flex items-center gap-2 flex-wrap'>
          <div className='inline-flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-green-500 text-white px-3 py-1 rounded-full text-sm font-bold shadow-md'>
            <Tag className='w-4 h-4' />
            <span>{discount.name}</span>
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

        <div className='text-center'>
          <div className='text-2xl font-bold text-emerald-600 dark:text-emerald-400'>
            {discount.percentOff && `${discount.percentOff}% OFF`}
            {discount.amountOff &&
              !discount.percentOff &&
              `${formatCurrency(Math.round(discount.amountOff * 100))} OFF`}
          </div>
          {discount.duration && (
            <div className='text-sm text-gray-600 dark:text-gray-400'>
              Duration: {discount.duration}
              {discount.durationInMonths &&
                ` (${discount.durationInMonths} months)`}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Render invoices
  const renderInvoices = () => {
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

    const displayedInvoices = showFullHistory ? invoices : invoices.slice(0, 5);

    return (
      <div className='space-y-4'>
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

        <div className='bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 mt-4'>
          <div className='text-center text-sm text-gray-600 dark:text-gray-400'>
            Showing {displayedInvoices.length} of {invoices.length} invoice
            {invoices.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>
    );
  };

  // Fetch data on component mount
  useEffect(() => {
    if (isLoaded && userId) {
      fetchSubscription();
    }
  }, [isLoaded, userId, fetchSubscription]);

  if (!isLoaded || isLoading) {
    return (
      <div className='max-w-5xl mx-auto p-3 sm:p-6 space-y-4 sm:space-y-8'>
        <div className={cardClasses}>
          <div className='flex items-center justify-center py-12'>
            <Loader2 className='w-8 h-8 text-blue-500 animate-spin' />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className='max-w-5xl mx-auto p-3 sm:p-6 space-y-4 sm:space-y-8'>
        <div className={cardClasses}>
          <div className='text-center py-12'>
            <AlertTriangle className='w-12 h-12 text-red-500 mx-auto mb-4' />
            <h3 className='text-lg font-semibold text-red-600 mb-2'>
              Failed to Load Subscription
            </h3>
            <p className='text-gray-600 dark:text-gray-400 mb-4'>{error}</p>
            <Button onClick={refreshSubscription} variant='outline'>
              <RefreshCw className='w-4 h-4 mr-2' />
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

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
                  onClick={refreshSubscription}
                  variant='outline'
                  size='default'
                  disabled={isLoading}
                  className='bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm border-gray-300 dark:border-gray-600 hover:bg-white dark:hover:bg-gray-700 transition-all duration-200 shadow-md w-full sm:w-auto min-h-[44px]'
                >
                  {isLoading ? (
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
                  {subscription?.isActive ? 'Premium Plan' : 'Free Account'}
                </p>
              </div>
            </div>
            <div className='bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 sm:p-4'>
              <p className='text-sm sm:text-base text-gray-700 dark:text-gray-300 font-medium leading-relaxed'>
                {statusConfig.description('your next billing period')}
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

            {subscription?.isActive ? (
              <div className='space-y-4 sm:space-y-6'>
                {/* Price Section */}
                <div
                  className={`rounded-2xl p-4 sm:p-6 ${
                    subscription.discounts.length > 0
                      ? 'bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 border-2 border-emerald-200 dark:border-emerald-700/50'
                      : 'bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20'
                  }`}
                >
                  {subscription.discounts.length > 0 ? (
                    // Enhanced Discount Active Display
                    <div className='space-y-4'>
                      <div className='text-center pb-2'>
                        <div className='inline-flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-green-500 text-white px-4 py-2 rounded-full shadow-lg'>
                          <Sparkles className='w-4 h-4 animate-pulse' />
                          <span className='font-bold text-sm'>
                            🎉 SPECIAL DISCOUNT ACTIVE
                          </span>
                          <Sparkles className='w-4 h-4 animate-pulse' />
                        </div>
                      </div>

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
                              {formatCurrency(
                                Math.round(
                                  subscription.total *
                                    (1 -
                                      (subscription.discounts[0]?.percentOff ||
                                        0) /
                                        100) *
                                    100
                                ),
                                subscription.currency
                              )}
                            </div>
                            <div className='text-emerald-600 dark:text-emerald-400 text-lg font-medium'>
                              per month • locked forever
                            </div>
                          </div>

                          {subscription.discounts[0].percentOff && (
                            <div className='inline-flex items-center gap-2 bg-gradient-to-r from-orange-500 to-red-500 text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg'>
                              <TrendingDown className='w-4 h-4' />
                              <span>
                                {subscription.discounts[0].percentOff}% OFF
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Discount Details */}
                      <div className='bg-gradient-to-r from-emerald-100/80 to-green-100/80 dark:from-emerald-800/20 dark:to-green-800/20 rounded-xl p-4 border border-emerald-200 dark:border-emerald-700/50'>
                        {renderDiscountDetails(subscription.discounts[0])}
                      </div>

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
                          {formatCurrency(
                            Math.round(subscription.total * 100),
                            subscription.currency
                          )}
                        </span>
                        <span className='text-gray-500 dark:text-gray-400 text-base sm:text-lg'>
                          /month
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Subscription Management Actions */}
                <div className='bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 sm:p-4'>
                  <div className='text-center space-y-3'>
                    <h4 className='font-semibold text-gray-800 dark:text-gray-200'>
                      Subscription Management
                    </h4>
                    <p className='text-sm text-gray-600 dark:text-gray-400'>
                      Need to make changes to your subscription? Use the
                      cancellation flow to adjust your settings.
                    </p>
                    <Button
                      onClick={() => setShowCancellationFlow(true)}
                      variant='outline'
                      size='sm'
                      className='text-orange-600 border-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/20'
                    >
                      Manage Subscription
                    </Button>
                  </div>
                </div>
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
      {subscription?.isActive && (
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
      )}

      {/* Cancellation Flow Modal - Create a simplified version since we don't have detailed subscription */}
      {subscription && (
        <CancellationFlowModal
          isOpen={showCancellationFlow}
          onClose={() => setShowCancellationFlow(false)}
          onComplete={handleCancellationFlowComplete}
          subscription={
            {
              // Provide minimal data needed for the modal
              status: subscription.isActive ? 'active' : 'inactive',
              isActive: subscription.isActive,
              total: subscription.total,
              currency: subscription.currency,
              discounts: subscription.discounts,
            } as any
          }
        />
      )}
    </div>
  );
}

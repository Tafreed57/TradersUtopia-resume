'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useUser, useAuth } from '@clerk/nextjs';
import { useComprehensiveLoading } from '@/hooks/use-comprehensive-loading';
import { Button } from '@/components/ui/button';
import {
  ComponentLoading,
  ApiLoading,
  ButtonLoading,
} from '@/components/ui/loading-components';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  CreditCard,
  Calendar,
  DollarSign,
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Loader2,
  Eye,
  EyeOff,
  Clock,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Gift,
  Lock,
} from 'lucide-react';
import { showToast } from '@/lib/notifications-client';
import { formatDistanceToNow } from 'date-fns';
import { makeSecureRequest } from '@/lib/csrf-client';
import { Fragment } from 'react';

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
  const [isVerifying, setIsVerifying] = useState(false);
  const [showInvoiceHistory, setShowInvoiceHistory] = useState(false);
  const [showFullHistory, setShowFullHistory] = useState(false);

  // Multi-step cancellation flow
  const [cancelStep, setCancelStep] = useState<
    'reason' | 'confirmation' | 'intermediate' | 'auth'
  >('reason');
  const [selectedReason, setSelectedReason] = useState<string>('');

  // Price negotiation flow
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

  const handleImmediateCancel = async () => {
    // Close all modals and proceed directly to cancellation
    setShowFinalOffer(false);
    setShowOfferModal(false);
    setShowCancelDialog(false);

    // Perform immediate cancellation without password
    setIsCancelling(true);
    try {
      const response = await makeSecureRequest('/api/subscription/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          password: 'IMMEDIATE_CANCEL', // Special flag for immediate cancellation
          confirmCancel: true,
          reason: 'Rejected all offers',
        }),
      });

      const data = await response.json();

      if (response.ok) {
        showToast.success(
          '✅ Subscription Cancelled',
          'Your subscription has been cancelled immediately.'
        );
        await fetchSubscriptionDetails();
      } else {
        showToast.error('Cancellation Error', data.error);
        // If immediate cancel fails, fall back to normal flow
        setCancelStep('auth');
        setShowCancelDialog(true);
      }
    } catch (error) {
      showToast.error('Error', 'Failed to cancel subscription');
      // If immediate cancel fails, fall back to normal flow
      setCancelStep('auth');
      setShowCancelDialog(true);
    } finally {
      setIsCancelling(false);
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

  const refreshAndSync = async () => {
    if (isLoading) return; // Prevent multiple simultaneous refreshes

    setIsLoading(true);
    try {
      console.log('🔄 Refreshing and syncing subscription with Stripe...');

      // First, try to sync with Stripe to get the latest data
      try {
        const syncResponse = await makeSecureRequest('/api/subscription/sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (syncResponse.ok) {
          console.log('✅ Sync successful, fetching updated details...');
          showToast.success('🔄 Synced', 'Subscription data synchronized!');
        } else {
          const syncData = await syncResponse.json();
          console.log('⚠️ Sync failed, still refreshing local data...');
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
      console.log('📊 Updated subscription data received:', data);
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

  const handleAutoRenewToggle = async (autoRenew: boolean) => {
    // If user is trying to turn OFF auto-renewal, show cancellation confirmation
    if (!autoRenew) {
      setShowCancelDialog(true);
      return;
    }

    // If turning ON auto-renewal, proceed directly
    await toggleAutoRenew(true);
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

  const verifyAutoRenewalStatus = async () => {
    setIsLoading(true);
    try {
      console.log('🔍 Verifying auto-renewal status with Stripe...');
      const response = await makeSecureRequest('/api/subscription/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Raw Stripe verification data:', data);

        // Extract subscription data from the sync response
        const sub = data.subscription;
        const autoRenew = !sub.cancelAtPeriodEnd; // Auto-renewal is ON when cancel_at_period_end is false

        // Show detailed verification popup
        const verificationMessage = `
🔍 STRIPE VERIFICATION RESULTS:

📋 Subscription ID: ${sub.id || 'N/A'}
📊 Status: ${sub.status || 'N/A'}
🔄 Auto-Renewal: ${autoRenew ? '✅ ENABLED' : '❌ DISABLED'}
🚫 Cancel at Period End: ${sub.cancelAtPeriodEnd ? '✅ YES (will expire)' : '❌ NO (will renew)'}
📅 Current Period End: ${sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd).toLocaleString() : 'N/A'}

${
  autoRenew
    ? '✅ AUTO-RENEWAL IS ON: Your subscription WILL automatically renew at the end of the period.'
    : '❌ AUTO-RENEWAL IS OFF: Your subscription WILL EXPIRE at the end of the period unless you re-enable it.'
}

This data comes directly from Stripe and shows the REAL status of your subscription.
        `;

        alert(verificationMessage);
        showToast.success(
          '✅ Verified!',
          'Auto-renewal status confirmed with Stripe'
        );

        // Refresh the UI with latest data
        await fetchSubscriptionDetails();
      } else {
        const errorData = await response.json();
        showToast.error(
          '❌ Verification Failed',
          errorData.error || 'Failed to verify with Stripe'
        );
      }
    } catch (error) {
      console.error('❌ Error verifying auto-renewal:', error);
      showToast.error(
        '❌ Verification Error',
        'Failed to verify auto-renewal status'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      ACTIVE: { color: 'default', icon: CheckCircle, text: 'Active' },
      CANCELLED: { color: 'destructive', icon: XCircle, text: 'Cancelled' },
      EXPIRED: { color: 'secondary', icon: XCircle, text: 'Expired' },
      FREE: { color: 'secondary', icon: Shield, text: 'Free' },
    } as const;

    const config =
      statusConfig[status as keyof typeof statusConfig] || statusConfig.FREE;
    const Icon = config.icon;

    return (
      <Badge variant={config.color} className='flex items-center gap-1'>
        <Icon className='h-3 w-3' />
        {config.text}
      </Badge>
    );
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
    try {
      setIsLoading(true);
      await toggleAutoRenew(!subscription?.stripe?.autoRenew);
    } catch (err: any) {
      setError(err.message || 'Failed to toggle auto-renewal');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyRaw = async () => {
    try {
      setIsLoading(true);
      await verifyAutoRenewalStatus();
    } catch (err: any) {
      setError(err.message || 'Failed to verify renewal status');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isLoaded && userId) {
      fetchSubscriptionDetails();
    }
  }, [isLoaded, userId, fetchSubscriptionDetails]);

  const cardClasses =
    'bg-white dark:bg-gray-800/50 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700/60 p-6 transition-all duration-300 hover:shadow-xl hover:border-gray-300 dark:hover:border-gray-600';

  const statusConfig = useMemo(() => {
    if (!subscription || !subscription.status) {
      return {
        bgColor: 'bg-green-100',
        textColor: 'text-green-600',
        textColorCls: 'text-green-600',
        title: 'Active',
        description: (date: string) =>
          `Your subscription is active until ${date}`,
        Icon: () => <div>✓</div>,
      };
    }

    switch (subscription.status.toLowerCase()) {
      case 'active':
        return {
          bgColor: 'bg-green-100',
          textColor: 'text-green-600',
          textColorCls: 'text-green-600',
          title: 'Active',
          description: (date: string) =>
            `Your subscription is active until ${date}`,
          Icon: () => <div>✓</div>,
        };
      case 'trialing':
        return {
          bgColor: 'bg-yellow-100',
          textColor: 'text-yellow-600',
          textColorCls: 'text-yellow-600',
          title: 'Trialing',
          description: (date: string) => `Your trial ends on ${date}`,
          Icon: () => <div>🌟</div>,
        };
      case 'cancelled':
        return {
          bgColor: 'bg-red-100',
          textColor: 'text-red-600',
          textColorCls: 'text-red-600',
          title: 'Cancelled',
          description: (date: string) =>
            `Your subscription was cancelled on ${date}`,
          Icon: () => <div>❌</div>,
        };
      case 'unpaid':
      case 'past_due':
        return {
          bgColor: 'bg-red-100',
          textColor: 'text-red-600',
          textColorCls: 'text-red-600',
          title: 'Past Due',
          description: (date: string) =>
            `Your subscription is past due. Payment is required by ${date}`,
          Icon: () => <div>❌</div>,
        };
      default:
        return {
          bgColor: 'bg-gray-100',
          textColor: 'text-gray-600',
          textColorCls: 'text-gray-600',
          title: 'Unknown',
          description: (date: string) =>
            `Subscription status unknown. Last updated on ${date}`,
          Icon: () => <div>❓</div>,
        };
    }
  }, [subscription]);

  const renderInvoices = () => {
    return (
      <div className='mt-4 text-center'>
        <p className='text-gray-500 dark:text-gray-400'>
          Invoice history not available
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
    <div className='max-w-4xl mx-auto p-4 space-y-6'>
      <div className={cardClasses}>
        <div className='flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4'>
          <div>
            <h2 className='text-2xl font-bold text-gray-900 dark:text-white'>
              Subscription Management
            </h2>
            <p className='text-sm text-gray-500 dark:text-gray-400'>
              Manage your billing and subscription details.
            </p>
          </div>
          <div className='flex items-center gap-2'>
            <Button
              onClick={handleSync}
              variant='outline'
              size='sm'
              disabled={isSyncing}
              className='dark:bg-gray-700/50'
            >
              {isSyncing ? (
                <Loader2 className='w-4 h-4 mr-2 animate-spin' />
              ) : (
                <RefreshCw className='w-4 h-4 mr-2' />
              )}
              Sync with Stripe
            </Button>
          </div>
        </div>
      </div>

      <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
        {/* Status Card */}
        <div className={cardClasses}>
          <h3 className='font-bold text-lg mb-4 text-gray-800 dark:text-gray-200'>
            Current Plan
          </h3>
          <div className='flex items-center gap-4'>
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center ${statusConfig.bgColor}`}
            >
              <statusConfig.Icon />
            </div>
            <div>
              <p
                className={`text-xl font-semibold ${statusConfig.textColorCls}`}
              >
                {statusConfig.title}
              </p>
              <p className='text-sm text-gray-500 dark:text-gray-400'>
                Premium Plan
              </p>
            </div>
          </div>
          <p className='text-sm text-gray-600 dark:text-gray-300 mt-4'>
            {statusConfig.description(
              stripeData?.currentPeriodEnd
                ? new Date(stripeData.currentPeriodEnd).toLocaleDateString()
                : ''
            )}
          </p>
        </div>

        {/* Billing Card */}
        <div className={cardClasses}>
          <h3 className='font-bold text-lg mb-4 text-gray-800 dark:text-gray-200'>
            Billing Details
          </h3>
          {stripeData ? (
            <div className='space-y-3 text-sm'>
              <div className='flex justify-between'>
                <span className='text-gray-500 dark:text-gray-400'>Price</span>
                <span className='font-medium text-gray-900 dark:text-white'>
                  ${(stripeData.amount / 100).toFixed(2)} /{' '}
                  {stripeData.interval}
                </span>
              </div>
              <div className='flex justify-between'>
                <span className='text-gray-500 dark:text-gray-400'>
                  Next Billing Date
                </span>
                <span className='font-medium text-gray-900 dark:text-white'>
                  {new Date(stripeData.currentPeriodEnd).toLocaleDateString()}
                </span>
              </div>
              <div className='flex justify-between items-center'>
                <span className='text-gray-500 dark:text-gray-400'>
                  Auto-renewal
                </span>
                <Switch
                  checked={stripeData.autoRenew}
                  onCheckedChange={handleToggleAutoRenew}
                  className='data-[state=checked]:bg-green-500'
                />
              </div>
              <div className='flex justify-between pt-2'>
                <Button variant='outline' size='sm' asChild>
                  <a
                    href={`https://billing.stripe.com/p/login/${process.env.NEXT_PUBLIC_STRIPE_PORTAL_ID}`}
                    target='_blank'
                    rel='noopener noreferrer'
                  >
                    Manage Billing
                    <ExternalLink className='w-3 h-3 ml-2' />
                  </a>
                </Button>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={handleVerifyRaw}
                  disabled={isVerifying}
                >
                  {isVerifying ? (
                    <Loader2 className='w-4 h-4 mr-2 animate-spin' />
                  ) : (
                    <Lock className='w-3 h-3 mr-2' />
                  )}
                  Verify Raw
                </Button>
              </div>
            </div>
          ) : (
            <p className='text-sm text-gray-500 dark:text-gray-400'>
              No active Stripe subscription found.
            </p>
          )}
        </div>
      </div>

      {/* Invoice History */}
      <div className={cardClasses}>
        <div
          className='flex items-center justify-between cursor-pointer'
          onClick={() => setShowInvoiceHistory(!showInvoiceHistory)}
        >
          <h3 className='font-bold text-lg text-gray-800 dark:text-gray-200'>
            Invoice History
          </h3>
          {showInvoiceHistory ? (
            <ChevronUp className='w-5 h-5 text-gray-500' />
          ) : (
            <ChevronDown className='w-5 h-5 text-gray-500' />
          )}
        </div>
        {showInvoiceHistory && renderInvoices()}
      </div>
    </div>
  );
}

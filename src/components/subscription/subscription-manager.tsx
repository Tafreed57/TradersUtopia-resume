'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
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
} from 'lucide-react';
import { showToast } from '@/lib/notifications-client';
import { formatDistanceToNow } from 'date-fns';
import { makeSecureRequest } from '@/lib/csrf-client';

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
  const [isLoading, setIsLoading] = useState(true);
  const [subscription, setSubscription] = useState<SubscriptionDetails | null>(
    null
  );
  const [isUpdatingAutoRenew, setIsUpdatingAutoRenew] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelPassword, setCancelPassword] = useState('');
  const [showCancelDialog, setShowCancelDialog] = useState(false);

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

  const fetchSubscriptionDetails = async () => {
    setIsLoading(true);
    try {
      console.log('🔍 Fetching subscription details...');
      const response = await fetch('/api/subscription/details');
      if (response.ok) {
        const data = await response.json();
        console.log('📊 Subscription data received:', data);

        // Log key status for debugging
        if (!data.subscription?.stripe) {
          console.log(
            '⚠️ No Stripe subscription data found - Billing controls will be limited'
          );
        }
        setSubscription(data.subscription);
      } else {
        console.error(
          '❌ Failed to fetch subscription details:',
          response.status
        );
        showToast.error('Error', 'Failed to fetch subscription details');
      }
    } catch (error) {
      console.error('❌ Error fetching subscription details:', error);
      showToast.error('Error', 'Failed to fetch subscription details');
    } finally {
      setIsLoading(false);
    }
  };

  const refreshAndSync = async () => {
    setIsLoading(true);
    try {
      console.log('🔄 Refreshing and syncing subscription with Stripe...');

      // First, sync with Stripe to get the latest data
      const syncResponse = await makeSecureRequest('/api/subscription/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (syncResponse.ok) {
        showToast.success(
          '🔄 Refreshed!',
          'Subscription data synchronized and updated'
        );
        console.log('✅ Sync successful, fetching updated details...');
      } else {
        const syncData = await syncResponse.json();
        console.log('⚠️ Sync failed, still refreshing local data...');
        showToast.warning(
          '⚠️ Sync Warning',
          `Couldn't sync with Stripe, but refreshed local data. ${syncData.error || ''}`
        );
      }

      // Always fetch subscription details (even if sync failed)
      const response = await fetch('/api/subscription/details');
      if (response.ok) {
        const data = await response.json();
        console.log('📊 Updated subscription data received:', data);
        setSubscription(data.subscription);
      } else {
        console.error(
          '❌ Failed to fetch subscription details:',
          response.status
        );
        showToast.error('Error', 'Failed to refresh subscription details');
      }
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

  useEffect(() => {
    if (user) {
      refreshAndSync();
    }
  }, [user]);

  if (!user) {
    console.log('🚫 SubscriptionManager: No user found');
    return null;
  }

  if (isLoading) {
    console.log('⏳ SubscriptionManager: Loading subscription details...');
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

  if (!subscription) {
    console.log('❌ SubscriptionManager: No subscription data found');
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

  console.log(
    '✅ SubscriptionManager: Rendering subscription UI for',
    subscription.status,
    'subscription'
  );

  return (
    <div className='w-full'>
      <Card className='w-full border-gray-600/30 bg-gradient-to-br from-gray-800/40 to-gray-900/40 backdrop-blur-md'>
        <CardHeader>
          <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3'>
            <div className='flex items-center gap-2'>
              <CreditCard className='h-5 w-5' />
              <CardTitle>Subscription</CardTitle>
            </div>
            <div className='flex items-center gap-2'>
              {getStatusBadge(subscription.status)}
              <Button
                variant='outline'
                size='sm'
                onClick={refreshAndSync}
                disabled={isLoading}
                title='Refresh & sync with Stripe'
                className='flex items-center gap-1.5'
              >
                {isLoading ? (
                  <Loader2 className='h-3 w-3 animate-spin' />
                ) : (
                  <RefreshCw className='h-3 w-3' />
                )}
                Refresh
              </Button>
            </div>
          </div>
          <CardDescription>
            Manage your subscription and billing preferences
          </CardDescription>
        </CardHeader>

        <CardContent className='space-y-6 w-full'>
          {/* Product Information */}
          {subscription.product && (
            <div className='space-y-3'>
              <h4 className='font-medium flex items-center gap-2'>
                <Shield className='h-4 w-4' />
                Current Plan
              </h4>
              <div className='bg-gray-50 dark:bg-gray-800 p-4 rounded-lg'>
                <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4'>
                  <div className='flex-1'>
                    <h5 className='font-semibold'>
                      {subscription.product.name}
                    </h5>
                    {subscription.product.description && (
                      <p className='text-sm text-gray-600 dark:text-gray-300 mt-1'>
                        {subscription.product.description}
                      </p>
                    )}
                  </div>
                  {subscription.stripe?.amount && (
                    <div className='flex-shrink-0 text-right'>
                      {subscription.stripe.hasDiscount &&
                      subscription.stripe.originalAmount ? (
                        <div className='space-y-1'>
                          <div className='flex flex-col sm:flex-row sm:items-center gap-2'>
                            <span className='text-sm text-gray-500 line-through'>
                              {formatCurrency(
                                subscription.stripe.originalAmount,
                                subscription.stripe.currency
                              )}
                            </span>
                            <span className='text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full font-medium'>
                              {subscription.stripe.discountPercent}% OFF
                            </span>
                          </div>
                          <div className='text-lg font-bold text-green-600'>
                            {formatCurrency(
                              subscription.stripe.amount,
                              subscription.stripe.currency
                            )}
                          </div>
                          <div className='text-sm text-gray-500'>
                            per {subscription.stripe.interval}
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className='text-lg font-bold'>
                            {formatCurrency(
                              subscription.stripe.amount,
                              subscription.stripe.currency
                            )}
                          </div>
                          <div className='text-sm text-gray-500'>
                            per {subscription.stripe.interval}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Active Discount Banner */}
          {subscription.stripe?.hasDiscount &&
            subscription.stripe?.discountDetails && (
              <div className='bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800'>
                <div className='flex items-center gap-3'>
                  <div className='flex-shrink-0'>
                    <span className='inline-flex items-center justify-center w-8 h-8 bg-green-100 dark:bg-green-800 rounded-full'>
                      🎉
                    </span>
                  </div>
                  <div className='flex-1'>
                    <h5 className='font-semibold text-green-900 dark:text-green-100'>
                      Permanent Discount Active!
                    </h5>
                    <p className='text-sm text-green-700 dark:text-green-200 mt-1'>
                      You're saving{' '}
                      <strong>
                        {subscription.stripe.discountPercent}% forever
                      </strong>{' '}
                      on your subscription. This discount will continue for the
                      lifetime of your subscription.
                    </p>
                  </div>
                  <div className='flex-shrink-0'>
                    <span className='inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200'>
                      {subscription.stripe.discountDetails.duration ===
                      'forever'
                        ? 'PERMANENT'
                        : 'LIMITED TIME'}
                    </span>
                  </div>
                </div>
              </div>
            )}

          {/* Billing Information */}
          {(subscription.stripe || subscription.subscriptionStart) && (
            <div className='space-y-3'>
              <h4 className='font-medium flex items-center gap-2'>
                <Calendar className='h-4 w-4' />
                Billing Information
              </h4>
              <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                <div className='space-y-2'>
                  <Label className='text-sm font-medium'>Current Period</Label>
                  <div className='text-sm text-gray-600 dark:text-gray-300'>
                    {subscription.stripe &&
                    subscription.stripe.currentPeriodStart &&
                    subscription.stripe.currentPeriodEnd ? (
                      <>
                        {new Date(
                          subscription.stripe.currentPeriodStart
                        ).toLocaleDateString()}{' '}
                        -{' '}
                        {new Date(
                          subscription.stripe.currentPeriodEnd
                        ).toLocaleDateString()}
                      </>
                    ) : (
                      <>
                        {new Date(
                          subscription.subscriptionStart
                        ).toLocaleDateString()}{' '}
                        -{' '}
                        {new Date(
                          subscription.subscriptionEnd
                        ).toLocaleDateString()}
                      </>
                    )}
                  </div>
                </div>
                <div className='space-y-2'>
                  <Label className='text-sm font-medium'>Next Billing</Label>
                  <div className='text-sm text-gray-600 dark:text-gray-300'>
                    {subscription.stripe &&
                    subscription.stripe.currentPeriodEnd ? (
                      subscription.stripe.cancelAtPeriodEnd ? (
                        <span className='text-red-600 dark:text-red-400'>
                          Cancelled - Expires{' '}
                          {formatDistanceToNow(
                            new Date(subscription.stripe.currentPeriodEnd),
                            { addSuffix: true }
                          )}
                        </span>
                      ) : (
                        formatDistanceToNow(
                          new Date(subscription.stripe.currentPeriodEnd),
                          { addSuffix: true }
                        )
                      )
                    ) : (
                      <span className='text-blue-600 dark:text-blue-400'>
                        Expires{' '}
                        {formatDistanceToNow(
                          new Date(subscription.subscriptionEnd),
                          { addSuffix: true }
                        )}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Stripe Connection Status */}
          {!subscription.stripe && subscription.status === 'ACTIVE' && (
            <div className='bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800'>
              <div className='flex items-start gap-3'>
                <AlertTriangle className='h-5 w-5 text-yellow-600 mt-0.5' />
                <div>
                  <h5 className='font-medium text-yellow-900 dark:text-yellow-100'>
                    Limited Subscription Management
                  </h5>
                  <p className='text-sm text-yellow-700 dark:text-yellow-200 mt-1'>
                    Your subscription is active in our database, but we couldn't
                    connect to detailed billing information from Stripe.
                    Advanced features like auto-renewal management are currently
                    unavailable.
                  </p>
                  <p className='text-xs text-yellow-600 dark:text-yellow-300 mt-2'>
                    Contact support if you need to make changes to your
                    subscription.
                  </p>
                </div>
              </div>
            </div>
          )}

          <Separator />

          {/* Auto-Renewal Toggle with Integrated Cancellation */}
          {subscription.stripe && subscription.status === 'ACTIVE' && (
            <div className='space-y-3'>
              <div className='flex items-center justify-between'>
                <h4 className='font-medium flex items-center gap-2'>
                  <RefreshCw className='h-4 w-4' />
                  Auto-Renewal & Subscription Management
                </h4>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={verifyAutoRenewalStatus}
                  disabled={isLoading}
                  title='Verify auto-renewal status directly with Stripe'
                  className='flex items-center gap-1.5 text-blue-600 border-blue-200 hover:bg-blue-50'
                >
                  {isLoading ? (
                    <Loader2 className='h-3 w-3 animate-spin' />
                  ) : (
                    <Eye className='h-3 w-3' />
                  )}
                  Verify Status
                </Button>
              </div>
              <div
                className={`p-4 rounded-lg border ${
                  subscription.stripe.autoRenew
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                    : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                }`}
              >
                <div className='flex items-center justify-between'>
                  <div className='space-y-2'>
                    <Label
                      htmlFor='auto-renew'
                      className='text-sm font-medium flex items-center gap-2'
                    >
                      {subscription.stripe.autoRenew ? (
                        <CheckCircle className='h-4 w-4 text-green-600' />
                      ) : (
                        <AlertTriangle className='h-4 w-4 text-red-600' />
                      )}
                      Automatic Renewal
                    </Label>
                    <div className='text-xs text-gray-600 dark:text-gray-300'>
                      {subscription.stripe.autoRenew ? (
                        <p>
                          ✅ Your subscription will automatically renew at the
                          end of each billing period
                        </p>
                      ) : (
                        <div className='space-y-1'>
                          <p className='text-red-600 dark:text-red-400'>
                            ⚠️ Auto-renewal is disabled. Your subscription will
                            expire on{' '}
                            {subscription.stripe.currentPeriodEnd
                              ? new Date(
                                  subscription.stripe.currentPeriodEnd
                                ).toLocaleDateString()
                              : new Date(
                                  subscription.subscriptionEnd
                                ).toLocaleDateString()}
                          </p>
                          <p className='text-blue-600 dark:text-blue-400'>
                            💡 You can turn auto-renewal back on anytime before
                            then to continue your subscription
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  <Switch
                    id='auto-renew'
                    checked={subscription.stripe.autoRenew}
                    onCheckedChange={handleAutoRenewToggle}
                    disabled={isUpdatingAutoRenew}
                  />
                </div>
              </div>

              {/* Re-enable Auto-Renewal Notice */}
              {!subscription.stripe.autoRenew && (
                <div className='bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800'>
                  <div className='flex items-start gap-3'>
                    <RefreshCw className='h-5 w-5 text-blue-600 mt-0.5' />
                    <div>
                      <h5 className='font-medium text-blue-900 dark:text-blue-100'>
                        Want to continue your subscription?
                      </h5>
                      <p className='text-sm text-blue-700 dark:text-blue-200 mt-1'>
                        Simply toggle auto-renewal back on above to resume
                        normal billing and keep your premium access. Your
                        subscription will then automatically renew on{' '}
                        {subscription.stripe.currentPeriodEnd
                          ? new Date(
                              subscription.stripe.currentPeriodEnd
                            ).toLocaleDateString()
                          : new Date(
                              subscription.subscriptionEnd
                            ).toLocaleDateString()}
                        .
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {isUpdatingAutoRenew && (
                <div className='flex items-center gap-2 text-sm text-gray-600'>
                  <Loader2 className='h-3 w-3 animate-spin' />
                  Updating subscription settings...
                </div>
              )}
            </div>
          )}

          {/* Cancellation Confirmation Dialog */}
          <AlertDialog
            open={showCancelDialog}
            onOpenChange={open => {
              setShowCancelDialog(open);
              if (!open) {
                setCancelPassword('');
                setCancelStep('reason');
                setSelectedReason('');
                setPriceInput('');
                setCurrentOffer(null);
                setShowOfferModal(false);
                setShowFinalOffer(false);
                setIsApplyingCoupon(false);
              }
            }}
          >
            <AlertDialogContent className='max-w-2xl w-full mx-4'>
              {/* Step 1: Reason Selection */}
              {cancelStep === 'reason' && (
                <>
                  <AlertDialogHeader className='text-center pb-6'>
                    <AlertDialogTitle className='text-3xl mb-4 font-bold text-gray-800 dark:text-gray-200'>
                      Why do you wish to quit your journey with us?
                    </AlertDialogTitle>
                    <AlertDialogDescription className='text-center text-lg text-gray-600 dark:text-gray-300'>
                      Please tell us the reason before we continue.
                      <br />
                      We can help with many situations.
                    </AlertDialogDescription>
                  </AlertDialogHeader>

                  <div className='space-y-4 py-6 px-4'>
                    {[
                      {
                        id: 'nevermind',
                        label: 'Never mind, I decided to stay',
                      },
                      { id: 'time', label: "I don't have Enough Time" },
                      { id: 'afford', label: "I can't afford it" },
                      { id: 'ready', label: "I'm not ready yet" },
                      { id: 'money', label: 'I already Make money' },
                      { id: 'unknown', label: "I don't know what to do" },
                    ].map((reason, index) => (
                      <button
                        key={reason.id}
                        onClick={() => setSelectedReason(reason.id)}
                        className={`w-full p-5 text-left rounded-xl border-2 transition-all duration-200 transform hover:scale-102 ${
                          selectedReason === reason.id
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-lg'
                            : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-gray-300'
                        }`}
                      >
                        <div className='flex items-center gap-4'>
                          <div
                            className={`w-8 h-8 rounded-full border-2 flex items-center justify-center font-bold transition-colors ${
                              selectedReason === reason.id
                                ? 'border-blue-500 bg-blue-500 text-white'
                                : 'border-gray-300 text-gray-500'
                            }`}
                          >
                            {String.fromCharCode(65 + index)}
                          </div>
                          <span className='text-lg font-medium'>
                            {reason.label}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>

                  <AlertDialogFooter className='pt-6'>
                    <AlertDialogCancel className='h-12 text-lg'>
                      Cancel
                    </AlertDialogCancel>
                    <Button
                      onClick={() => {
                        if (selectedReason === 'nevermind') {
                          setShowCancelDialog(false);
                        } else if (selectedReason === 'afford') {
                          setCancelStep('intermediate');
                        } else {
                          setCancelStep('confirmation');
                        }
                      }}
                      disabled={!selectedReason}
                      className='h-12 text-lg bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold rounded-xl shadow-lg px-8'
                    >
                      NEXT →
                    </Button>
                  </AlertDialogFooter>
                </>
              )}

              {/* Step 2: Confirmation Screen */}
              {cancelStep === 'confirmation' && (
                <>
                  {selectedReason === 'money' ? (
                    // Custom message for "I already make money"
                    <>
                      <AlertDialogHeader className='text-center'>
                        <AlertDialogTitle className='text-xl mb-2 text-red-600'>
                          Hold Up...
                        </AlertDialogTitle>
                      </AlertDialogHeader>

                      <div className='py-4 px-2'>
                        <div className='text-center space-y-4 text-sm'>
                          <p className='font-semibold'>
                            If you already make money, then why the hell did you
                            sign up in the first place?
                          </p>
                          <p>
                            Let's be real — people who are actually winning
                            don't cancel a service designed to help them win
                            more.
                          </p>
                          <p>
                            You didn't join because you needed charity — you
                            joined because you knew something was missing. Now
                            you're quitting and hiding behind the 'I'm good now'
                            excuse? Nah. That's not it.
                          </p>
                          <p className='font-semibold text-red-600'>
                            This isn't about money. It's about mindset. And
                            right now, yours is slipping.
                          </p>
                          <p className='text-blue-600 font-medium'>
                            Hit 'Go Back' if you're not ready to settle for
                            average.
                          </p>
                        </div>
                      </div>

                      <AlertDialogFooter>
                        <Button
                          onClick={() => setCancelStep('reason')}
                          variant='outline'
                          className='border-blue-500 text-blue-600 hover:bg-blue-50'
                        >
                          Go Back
                        </Button>
                        <Button
                          onClick={() => setCancelStep('intermediate')}
                          className='bg-red-500 hover:bg-red-600 text-white'
                        >
                          Continue Anyway
                        </Button>
                      </AlertDialogFooter>
                    </>
                  ) : selectedReason === 'time' ? (
                    // Custom message for "I don't have enough time"
                    <>
                      <AlertDialogHeader className='text-center'>
                        <AlertDialogTitle className='text-xl mb-2 text-blue-600'>
                          ⏱ Good news — you don't need much time at all.
                        </AlertDialogTitle>
                      </AlertDialogHeader>

                      <div className='py-4 px-2'>
                        <div className='text-center space-y-4 text-sm'>
                          <p>
                            This isn't day trading. These are swing trades built
                            specifically for people with full-time jobs.
                          </p>
                          <p>
                            Most members spend just{' '}
                            <strong>5–15 minutes a month</strong> copying alerts
                            — and even if you're a little late to enter, it's
                            fine. We look for big moves and often hold positions
                            for weeks or even months.
                          </p>
                          <p>
                            You get exact entries, exits, and updates. No
                            overthinking. No screen-watching.
                          </p>
                          <p className='font-semibold'>
                            Truth is, saying "I don't have time" is just an
                            excuse. Even Elon Musk could make time for this.
                          </p>
                          <p className='text-blue-600 font-medium'>
                            🔁 Want to give it another shot?
                          </p>
                        </div>
                      </div>

                      <AlertDialogFooter>
                        <Button
                          onClick={() => setCancelStep('reason')}
                          variant='outline'
                          className='border-blue-500 text-blue-600 hover:bg-blue-50'
                        >
                          Give it another shot
                        </Button>
                        <Button
                          onClick={() => setCancelStep('intermediate')}
                          className='bg-red-500 hover:bg-red-600 text-white'
                        >
                          Continue Anyway
                        </Button>
                      </AlertDialogFooter>
                    </>
                  ) : selectedReason === 'ready' ? (
                    // Custom message for "I'm not ready yet"
                    <>
                      <AlertDialogHeader className='text-center'>
                        <AlertDialogTitle className='text-xl mb-2 text-orange-600'>
                          Let's be real...
                        </AlertDialogTitle>
                      </AlertDialogHeader>

                      <div className='py-4 px-2'>
                        <div className='text-center space-y-4 text-sm'>
                          <p className='font-semibold'>
                            Let me be real with you — 'I'm not ready yet' is
                            just another excuse.
                          </p>
                          <p>
                            This isn't rocket science. You're not building a
                            business from scratch — you're getting trade alerts.
                          </p>
                          <p>
                            If you don't know how to use them, we've got
                            tutorial videos that walk you through everything
                            step-by-step.
                          </p>
                          <p className='font-semibold'>
                            You don't need to be 'ready.' You just need to stop
                            hesitating.
                          </p>
                          <p>
                            Most people who say this stay stuck for years… or
                            forever.
                          </p>
                          <p className='text-blue-600 font-medium'>
                            Hit 'Go Back' if you're done quitting on yourself.
                          </p>
                        </div>
                      </div>

                      <AlertDialogFooter>
                        <Button
                          onClick={() => setCancelStep('reason')}
                          variant='outline'
                          className='border-blue-500 text-blue-600 hover:bg-blue-50'
                        >
                          Go Back
                        </Button>
                        <Button
                          onClick={() => setCancelStep('intermediate')}
                          className='bg-red-500 hover:bg-red-600 text-white'
                        >
                          Continue Anyway
                        </Button>
                      </AlertDialogFooter>
                    </>
                  ) : selectedReason === 'unknown' ? (
                    // Custom message for "I don't know what to do"
                    <>
                      <AlertDialogHeader className='text-center'>
                        <AlertDialogTitle className='text-xl mb-2 text-purple-600'>
                          That's exactly why you should stay!
                        </AlertDialogTitle>
                      </AlertDialogHeader>

                      <div className='py-4 px-2'>
                        <div className='text-center space-y-4 text-sm'>
                          <p className='font-semibold'>
                            Saying 'I don't know what to do' is exactly why you
                            shouldn't quit.
                          </p>
                          <p>
                            We literally made this foolproof — just click the{' '}
                            <strong>#start-here</strong> section and follow the
                            steps. That's it.
                          </p>
                          <p>
                            It explains exactly how to use the alerts, how to
                            get help, and how to get results — step by step.
                          </p>
                          <p className='font-semibold'>
                            You don't need to figure anything out. You just need
                            to follow instructions.
                          </p>
                          <p>Don't give up before even starting.</p>
                          <p className='text-blue-600 font-medium'>
                            Hit 'Go Back' — I'll walk with you the whole way.
                          </p>
                        </div>
                      </div>

                      <AlertDialogFooter>
                        <Button
                          onClick={() => setCancelStep('reason')}
                          variant='outline'
                          className='border-blue-500 text-blue-600 hover:bg-blue-50'
                        >
                          Go Back
                        </Button>
                        <Button
                          onClick={() => setCancelStep('intermediate')}
                          className='bg-red-500 hover:bg-red-600 text-white'
                        >
                          Continue Anyway
                        </Button>
                      </AlertDialogFooter>
                    </>
                  ) : (
                    // Default message for other reasons (I can't afford it)
                    <>
                      <AlertDialogHeader className='text-center'>
                        <AlertDialogTitle className='text-xl mb-2'>
                          We understand your concern
                        </AlertDialogTitle>
                        <AlertDialogDescription className='text-center'>
                          Thank you for your feedback. We'll take this into
                          consideration for future improvements.
                        </AlertDialogDescription>
                      </AlertDialogHeader>

                      <div className='py-8'>
                        {/* Blank space as requested */}
                      </div>

                      <AlertDialogFooter>
                        <AlertDialogCancel
                          onClick={() => setCancelStep('reason')}
                        >
                          Back
                        </AlertDialogCancel>
                        <Button
                          onClick={() => setCancelStep('intermediate')}
                          className='bg-red-500 hover:bg-red-600 text-white'
                        >
                          Continue
                        </Button>
                      </AlertDialogFooter>
                    </>
                  )}
                </>
              )}

              {/* Step 3: Intermediate Screen - Price Negotiation */}
              {cancelStep === 'intermediate' && (
                <>
                  <AlertDialogHeader className='text-center pb-6'>
                    <AlertDialogTitle className='text-3xl mb-4 text-blue-600 font-bold'>
                      💰 Wait, let's find a price that works
                    </AlertDialogTitle>
                    <AlertDialogDescription className='text-center text-lg text-gray-600 dark:text-gray-300'>
                      Hey, is there a price that you would be able to afford and
                      would work for you long term?
                    </AlertDialogDescription>
                  </AlertDialogHeader>

                  <div className='py-8 px-6'>
                    <div className='bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-2xl p-8 border border-blue-200 dark:border-blue-800'>
                      <div className='space-y-6'>
                        <Label
                          htmlFor='price-input'
                          className='text-lg font-semibold text-center block'
                        >
                          What price would work for you? (per month)
                        </Label>
                        <div className='flex items-center justify-center space-x-3'>
                          <span className='text-3xl font-bold text-green-600'>
                            $
                          </span>
                          <Input
                            id='price-input'
                            type='number'
                            min='1'
                            step='0.01'
                            value={priceInput}
                            onChange={e => setPriceInput(e.target.value)}
                            placeholder='0.00'
                            className='text-center text-2xl font-bold h-16 w-32 border-2 border-green-300 focus:border-green-500 rounded-xl'
                          />
                        </div>
                        <p className='text-center text-sm text-gray-500 dark:text-gray-400'>
                          Enter any amount you feel comfortable paying monthly
                        </p>
                      </div>
                    </div>
                  </div>

                  <AlertDialogFooter className='flex-col space-y-4 pt-4'>
                    <div className='flex w-full gap-4'>
                      <AlertDialogCancel
                        onClick={() => setCancelStep('confirmation')}
                        className='flex-1 h-12 text-lg'
                      >
                        ← Back
                      </AlertDialogCancel>
                      <Button
                        onClick={handlePriceSubmit}
                        disabled={!priceInput.trim()}
                        className='flex-1 h-12 text-lg bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-semibold rounded-xl shadow-lg transform hover:scale-105 transition-all duration-200'
                      >
                        ✨ Submit Price
                      </Button>
                    </div>
                    <Button
                      onClick={handleFinalOffer}
                      variant='outline'
                      className='w-full h-12 text-lg border-2 border-red-500 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl font-medium'
                    >
                      NO, continue to cancel
                    </Button>
                  </AlertDialogFooter>
                </>
              )}

              {/* Step 4: Authentication */}
              {cancelStep === 'auth' && (
                <>
                  <AlertDialogHeader className='pb-6'>
                    <AlertDialogTitle className='flex items-center justify-center gap-3 text-2xl font-bold text-red-600'>
                      <AlertTriangle className='h-8 w-8 text-red-600' />
                      Disable Auto-Renewal?
                    </AlertDialogTitle>
                    <AlertDialogDescription className='text-center mt-4'>
                      <div className='space-y-4'>
                        <p className='text-lg text-gray-600 dark:text-gray-300'>
                          This will disable auto-renewal for your subscription.
                          Here's what happens:
                        </p>
                        <div className='bg-gray-50 dark:bg-gray-800 rounded-xl p-6'>
                          <ul className='space-y-3 text-left'>
                            <li className='flex items-start gap-2'>
                              <span className='text-green-500'>✅</span>
                              <span>
                                Your subscription stays <strong>active</strong>{' '}
                                until{' '}
                                {subscription?.stripe?.currentPeriodEnd
                                  ? new Date(
                                      subscription.stripe.currentPeriodEnd
                                    ).toLocaleDateString()
                                  : new Date(
                                      subscription.subscriptionEnd
                                    ).toLocaleDateString()}
                              </span>
                            </li>
                            <li className='flex items-start gap-2'>
                              <span className='text-green-500'>✅</span>
                              <span>
                                You keep all premium features until then
                              </span>
                            </li>
                            <li className='flex items-start gap-2'>
                              <span className='text-blue-500'>🔄</span>
                              <span>
                                <strong>
                                  You can re-enable auto-renewal anytime
                                </strong>{' '}
                                before expiration
                              </span>
                            </li>
                            <li className='flex items-start gap-2'>
                              <span className='text-orange-500'>⏹️</span>
                              <span>
                                Only expires if auto-renewal stays disabled
                              </span>
                            </li>
                          </ul>
                        </div>
                        <div className='bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-200 dark:border-blue-800'>
                          <p className='text-blue-800 dark:text-blue-200'>
                            💡 <strong>Pro Tip:</strong> This is reversible!
                            Simply toggle auto-renewal back on to resume normal
                            billing.
                          </p>
                        </div>
                      </div>
                    </AlertDialogDescription>
                  </AlertDialogHeader>

                  <div className='space-y-4 py-6'>
                    <Label
                      htmlFor='cancel-password'
                      className='text-lg font-semibold'
                    >
                      Enter your password to confirm:
                    </Label>
                    <Input
                      id='cancel-password'
                      type='password'
                      value={cancelPassword}
                      onChange={e => setCancelPassword(e.target.value)}
                      placeholder='Your account password'
                      className='h-12 text-lg border-2 border-red-200 focus:border-red-400 dark:border-red-800 rounded-xl'
                    />
                  </div>

                  <AlertDialogFooter className='pt-4'>
                    <AlertDialogCancel
                      onClick={() => {
                        setCancelPassword('');
                        setCancelStep('intermediate');
                      }}
                      className='h-12 text-lg'
                    >
                      ← Back
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleCancelSubscription}
                      disabled={isCancelling || !cancelPassword.trim()}
                      className='h-12 text-lg bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 rounded-xl px-6'
                    >
                      {isCancelling ? (
                        <>
                          <Loader2 className='h-4 w-4 animate-spin mr-2' />
                          Disabling...
                        </>
                      ) : (
                        'Disable Auto-Renewal'
                      )}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </>
              )}
            </AlertDialogContent>
          </AlertDialog>

          {/* Price Offer Modal */}
          <AlertDialog open={showOfferModal} onOpenChange={setShowOfferModal}>
            <AlertDialogContent className='max-w-2xl w-full mx-4'>
              <AlertDialogHeader className='text-center pb-6'>
                <AlertDialogTitle className='text-4xl mb-4 text-green-600 font-bold'>
                  🔒 ONE TIME OFFER
                </AlertDialogTitle>
                <AlertDialogDescription className='text-center text-lg text-gray-600 dark:text-gray-300'>
                  Hey — we've got a 🔒 ONE TIME OFFER for you:{' '}
                  <strong className='text-green-600'>
                    ${currentOffer}/month
                  </strong>
                  , locked in for life as long as you stay subscribed
                  {currentOffer === 19.99
                    ? ' and this is the LOWEST offer we have!'
                    : currentOffer === 15
                      ? '.'
                      : ' and this is the LOWEST offer we have!'}
                </AlertDialogDescription>
              </AlertDialogHeader>

              <div className='py-8'>
                <div className='bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-2xl p-8 border-2 border-green-200 dark:border-green-800 text-center'>
                  <div className='text-6xl font-bold text-green-600 mb-4'>
                    ${currentOffer}/month
                  </div>
                  <div className='flex items-center justify-center space-x-4 text-sm text-gray-600 dark:text-gray-300'>
                    <span className='flex items-center'>
                      🔒 <span className='ml-1'>Locked in for life</span>
                    </span>
                    <span className='text-gray-400'>•</span>
                    <span className='flex items-center'>
                      📈 <span className='ml-1'>No price increases ever</span>
                    </span>
                  </div>
                </div>
              </div>

              <AlertDialogFooter className='flex-col space-y-4'>
                <Button
                  onClick={async () => {
                    if (currentOffer) {
                      const success = await createAndApplyCoupon(currentOffer);
                      if (success) {
                        setShowOfferModal(false);
                        setShowCancelDialog(false);
                      }
                    }
                  }}
                  disabled={isApplyingCoupon}
                  className='w-full h-16 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white text-xl font-bold rounded-xl shadow-lg transform hover:scale-105 transition-all duration-200 disabled:opacity-50'
                >
                  {isApplyingCoupon ? (
                    <>
                      <Loader2 className='h-5 w-5 animate-spin mr-2' />
                      Applying Discount...
                    </>
                  ) : (
                    '✅ ACCEPT THIS OFFER'
                  )}
                </Button>
                <Button
                  onClick={() => {
                    setShowOfferModal(false);
                    setCancelStep('auth');
                  }}
                  variant='outline'
                  className='w-full h-12 text-lg border-2 border-red-500 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl'
                >
                  Continue to cancel
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Final Offer Modal */}
          <AlertDialog open={showFinalOffer} onOpenChange={setShowFinalOffer}>
            <AlertDialogContent className='max-w-2xl w-full mx-4'>
              <AlertDialogHeader className='text-center pb-6'>
                <AlertDialogTitle className='text-4xl mb-4 text-red-600 font-bold'>
                  🚨 LAST OFFER — $19.99/Month
                </AlertDialogTitle>
                <AlertDialogDescription className='text-center text-lg text-gray-600 dark:text-gray-300 leading-relaxed'>
                  This is the absolute lowest price we'll ever offer. No games.
                  No second chances.
                  <br />
                  <br />
                  It's a one-time deal — take it or leave it.
                  <br />
                  But just know:{' '}
                  <strong className='text-red-600'>
                    you will never see a discount again. Period.
                  </strong>
                </AlertDialogDescription>
              </AlertDialogHeader>

              <div className='py-8'>
                <div className='bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 rounded-2xl p-8 border-2 border-red-200 dark:border-red-800 text-center'>
                  <div className='text-6xl font-bold text-red-600 mb-4'>
                    $19.99/month
                  </div>
                  <div className='flex items-center justify-center space-x-4 text-sm text-gray-600 dark:text-gray-300'>
                    <span className='flex items-center'>
                      ⚡ <span className='ml-1'>Final offer</span>
                    </span>
                    <span className='text-gray-400'>•</span>
                    <span className='flex items-center'>
                      🔒 <span className='ml-1'>Locked in for life</span>
                    </span>
                  </div>
                </div>
              </div>

              <AlertDialogFooter className='flex-col space-y-4'>
                <Button
                  onClick={async () => {
                    const success = await createAndApplyCoupon(19.99);
                    if (success) {
                      setShowFinalOffer(false);
                      setShowCancelDialog(false);
                    }
                  }}
                  disabled={isApplyingCoupon}
                  className='w-full h-16 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white text-xl font-bold rounded-xl shadow-lg transform hover:scale-105 transition-all duration-200 disabled:opacity-50'
                >
                  {isApplyingCoupon ? (
                    <>
                      <Loader2 className='h-5 w-5 animate-spin mr-2' />
                      Applying Discount...
                    </>
                  ) : (
                    '✅ TAKE THE DEAL'
                  )}
                </Button>
                <Button
                  onClick={handleImmediateCancel}
                  variant='outline'
                  className='w-full h-12 text-lg border-2 border-gray-500 text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-900/20 rounded-xl'
                  disabled={isCancelling}
                >
                  {isCancelling ? (
                    <>
                      <Loader2 className='h-4 w-4 animate-spin mr-2' />
                      Cancelling...
                    </>
                  ) : (
                    'Cancel my subscription'
                  )}
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Customer Information */}
          {subscription.customer && (
            <div className='space-y-3'>
              <h4 className='font-medium flex items-center gap-2'>
                <DollarSign className='h-4 w-4' />
                Billing Account
              </h4>
              <div className='text-sm space-y-1'>
                <div className='flex justify-between'>
                  <span className='text-gray-600 dark:text-gray-300'>
                    Customer ID:
                  </span>
                  <span className='font-mono text-xs'>
                    {subscription.customer.id}
                  </span>
                </div>
                <div className='flex justify-between'>
                  <span className='text-gray-600 dark:text-gray-300'>
                    Account Created:
                  </span>
                  <span>
                    {new Date(
                      subscription.customer.created
                    ).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
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
  const apiLoading = useComprehensiveLoading('api');
  const actionLoading = useComprehensiveLoading('api');
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
    try {
      const data = await apiLoading.withLoading(
        async () => {
          console.log('🔍 Fetching subscription details...');
          const response = await fetch('/api/subscription/details');

          if (!response.ok) {
            throw new Error(
              `Failed to fetch subscription details: ${response.status}`
            );
          }

          const result = await response.json();
          console.log('📊 Subscription data received:', result);

          // Log key status for debugging
          if (!result.subscription?.stripe) {
            console.log(
              '⚠️ No Stripe subscription data found - Billing controls will be limited'
            );
          }

          return result;
        },
        {
          loadingMessage: 'Loading subscription details...',
          errorMessage: 'Failed to fetch subscription details',
        }
      );

      setSubscription(data.subscription);
    } catch (error) {
      console.error('❌ Error fetching subscription details:', error);
      showToast.error('Error', 'Failed to fetch subscription details');
    } finally {
      setIsLoading(false);
    }
  };

  const refreshAndSync = async () => {
    try {
      const data = await actionLoading.withLoading(
        async () => {
          console.log('🔄 Refreshing and syncing subscription with Stripe...');

          // First, sync with Stripe to get the latest data
          const syncResponse = await makeSecureRequest(
            '/api/subscription/sync',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
            }
          );

          if (syncResponse.ok) {
            console.log('✅ Sync successful, fetching updated details...');
          } else {
            const syncData = await syncResponse.json();
            console.log('⚠️ Sync failed, still refreshing local data...');
          }

          // Always fetch subscription details (even if sync failed)
          const response = await fetch('/api/subscription/details');
          if (!response.ok) {
            throw new Error(
              `Failed to refresh subscription details: ${response.status}`
            );
          }

          return response.json();
        },
        {
          loadingMessage: 'Syncing with Stripe...',
          successMessage: 'Subscription data synchronized!',
          errorMessage: 'Failed to refresh subscription data',
        }
      );

      console.log('📊 Updated subscription data received:', data);
      setSubscription(data.subscription);
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
              <div className='bg-gray-800 p-4 rounded-lg'>
                <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4'>
                  <div className='flex-1'>
                    <h5 className='font-semibold'>
                      {subscription.product.name}
                    </h5>
                    {subscription.product.description && (
                      <p className='text-sm text-gray-600 mt-1'>
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
              <div className='bg-gradient-to-r from-green-900/20 to-emerald-900/20 p-4 rounded-lg border border-green-600/50'>
                <div className='flex items-center gap-3'>
                  <div className='flex-shrink-0'>
                    <span className='inline-flex items-center justify-center w-8 h-8 bg-green-600/30 rounded-full'>
                      🎉
                    </span>
                  </div>
                  <div className='flex-1'>
                    <h5 className='font-semibold text-green-300'>
                      Permanent Discount Active!
                    </h5>
                    <p className='text-sm text-green-200 mt-1'>
                      You're saving{' '}
                      <strong>
                        {subscription.stripe.discountPercent}% forever
                      </strong>{' '}
                      on your subscription. This discount will continue for the
                      lifetime of your subscription.
                    </p>
                  </div>
                  <div className='flex-shrink-0'>
                    <span className='inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-600/50 text-green-200'>
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
                  <div className='text-sm text-gray-600'>
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
                  <div className='text-sm text-gray-600'>
                    {subscription.stripe &&
                    subscription.stripe.currentPeriodEnd ? (
                      subscription.stripe.cancelAtPeriodEnd ? (
                        <span className='text-red-600'>
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
                      <span className='text-blue-400'>
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
            <div className='bg-yellow-900/20 p-4 rounded-lg border border-yellow-600/50'>
              <div className='flex items-start gap-3'>
                <AlertTriangle className='h-5 w-5 text-yellow-400 mt-0.5' />
                <div>
                  <h5 className='font-medium text-yellow-300'>
                    Limited Subscription Management
                  </h5>
                  <p className='text-sm text-yellow-200 mt-1'>
                    Your subscription is active in our database, but we couldn't
                    connect to detailed billing information from Stripe.
                    Advanced features like auto-renewal management are currently
                    unavailable.
                  </p>
                  <p className='text-xs text-yellow-300 mt-2'>
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
              </div>
              <div
                className={`p-4 rounded-lg border ${
                  subscription.stripe.autoRenew
                    ? 'bg-green-900/20 border-green-600/50'
                    : 'bg-red-900/20 border-red-600/50'
                }`}
              >
                <div className='flex items-center justify-between'>
                  <div className='space-y-2'>
                    <Label
                      htmlFor='auto-renew'
                      className='text-sm font-medium flex items-center gap-2'
                    >
                      {subscription.stripe.autoRenew ? (
                        <CheckCircle className='h-4 w-4 text-green-400' />
                      ) : (
                        <AlertTriangle className='h-4 w-4 text-red-400' />
                      )}
                      Automatic Renewal
                    </Label>
                    <div className='text-xs text-gray-600'>
                      {subscription.stripe.autoRenew ? (
                        <p>
                          ✅ Your subscription will automatically renew at the
                          end of each billing period
                        </p>
                      ) : (
                        <div className='space-y-1'>
                          <p className='text-red-400'>
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
                          <p className='text-blue-400'>
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
                <div className='bg-blue-900/20 p-4 rounded-lg border border-blue-600/50'>
                  <div className='flex items-start gap-3'>
                    <RefreshCw className='h-5 w-5 text-blue-400 mt-0.5' />
                    <div>
                      <h5 className='font-medium text-blue-300'>
                        Want to continue your subscription?
                      </h5>
                      <p className='text-sm text-blue-200 mt-1'>
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
            <AlertDialogContent className='max-w-sm sm:max-w-2xl md:max-w-4xl w-[95%] sm:w-full mx-auto max-h-[80vh] sm:max-h-[90vh] overflow-y-auto'>
              {/* Step 1: Reason Selection */}
              {cancelStep === 'reason' && (
                <>
                  <AlertDialogHeader className='text-center pb-3 sm:pb-6 px-3 sm:px-4'>
                    <div className='flex items-center justify-center mb-3 sm:mb-6'>
                      <div className='w-10 h-10 sm:w-16 sm:h-16 bg-gradient-to-r from-red-500 to-orange-500 rounded-full flex items-center justify-center shadow-lg'>
                        <AlertTriangle className='h-5 w-5 sm:h-8 sm:w-8 text-white' />
                      </div>
                    </div>
                    <AlertDialogTitle className='text-lg sm:text-2xl md:text-3xl mb-2 sm:mb-4 font-bold bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent leading-tight'>
                      Why do you wish to quit your journey with us?
                    </AlertDialogTitle>
                    <AlertDialogDescription className='text-center text-sm sm:text-base md:text-lg text-gray-600 leading-relaxed px-1 sm:px-2'>
                      Please tell us the reason before we continue.
                      <br className='hidden sm:inline' />
                      <span className='block sm:inline sm:ml-1'>
                        We can help with many situations.
                      </span>
                    </AlertDialogDescription>
                  </AlertDialogHeader>

                  <div className='space-y-2 sm:space-y-4 py-2 sm:py-6 px-3 sm:px-4'>
                    {[
                      {
                        id: 'nevermind',
                        label: 'Never mind, I decided to stay',
                        icon: '💚',
                        color: 'green',
                      },
                      {
                        id: 'time',
                        label: "I don't have enough time",
                        icon: '⏰',
                        color: 'blue',
                      },
                      {
                        id: 'afford',
                        label: "I can't afford it",
                        icon: '💰',
                        color: 'yellow',
                      },
                      {
                        id: 'ready',
                        label: "I'm not ready yet",
                        icon: '🤔',
                        color: 'purple',
                      },
                      {
                        id: 'money',
                        label: 'I already make money',
                        icon: '💸',
                        color: 'emerald',
                      },
                      {
                        id: 'unknown',
                        label: "I don't know what to do",
                        icon: '❓',
                        color: 'gray',
                      },
                    ].map((reason, index) => (
                      <button
                        key={reason.id}
                        onClick={() => setSelectedReason(reason.id)}
                        className={`w-full p-2 sm:p-4 md:p-5 text-left rounded-lg sm:rounded-2xl border-2 transition-all duration-300 transform hover:scale-[1.02] touch-manipulation min-h-[50px] sm:min-h-[70px] ${
                          selectedReason === reason.id
                            ? `border-${reason.color}-500 bg-gradient-to-r from-${reason.color}-50 to-${reason.color}-100${reason.color}-900/30${reason.color}-800/20 shadow-lg shadow-${reason.color}-200/50${reason.color}-900/20`
                            : 'border-gray-200 hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100 hover:border-gray-300 hover:shadow-md'
                        }`}
                      >
                        <div className='flex items-center gap-2 sm:gap-4'>
                          <div className='flex items-center gap-1 sm:gap-3'>
                            <span className='text-base sm:text-xl'>
                              {reason.icon}
                            </span>
                            <div
                              className={`w-5 h-5 sm:w-8 sm:h-8 rounded-full border-2 flex items-center justify-center font-bold text-xs sm:text-sm transition-all duration-300 ${
                                selectedReason === reason.id
                                  ? `border-${reason.color}-500 bg-${reason.color}-500 text-white shadow-lg`
                                  : 'border-gray-300 text-gray-500'
                              }`}
                            >
                              {String.fromCharCode(65 + index)}
                            </div>
                          </div>
                          <span className='text-xs sm:text-base md:text-lg font-medium leading-tight flex-1'>
                            {reason.label}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>

                  <AlertDialogFooter className='pt-3 sm:pt-6 px-3 sm:px-4 flex-col sm:flex-row gap-2 sm:gap-4'>
                    <AlertDialogCancel className='h-10 sm:h-12 text-sm sm:text-base w-full sm:w-auto min-w-[120px] rounded-lg sm:rounded-xl touch-manipulation border-2 border-gray-300 hover:border-gray-400'>
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
                      className='h-10 sm:h-12 text-sm sm:text-base w-full sm:flex-1 bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white font-semibold rounded-lg sm:rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 touch-manipulation disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none px-4 sm:px-8'
                    >
                      <span className='flex items-center justify-center gap-2'>
                        NEXT
                        <span className='text-lg'>→</span>
                      </span>
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
                      <AlertDialogHeader className='text-center pb-4 sm:pb-6 px-2 sm:px-4'>
                        <div className='flex items-center justify-center mb-4 sm:mb-6'>
                          <div className='w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-r from-red-500 to-red-600 rounded-full flex items-center justify-center shadow-lg'>
                            <XCircle className='h-6 w-6 sm:h-8 sm:w-8 text-white' />
                          </div>
                        </div>
                        <AlertDialogTitle className='text-lg sm:text-xl md:text-2xl mb-3 sm:mb-4 font-bold text-red-600 leading-tight'>
                          Hold Up...
                        </AlertDialogTitle>
                      </AlertDialogHeader>

                      <div className='py-4 sm:py-6 px-2 sm:px-4'>
                        <div className='bg-gradient-to-br from-red-50 to-orange-50 rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-red-200 space-y-3 sm:space-y-4 text-center'>
                          <p className='text-sm sm:text-base font-semibold text-gray-800'>
                            If you already make money, then why the hell did you
                            sign up in the first place?
                          </p>
                          <p className='text-sm sm:text-base text-gray-700'>
                            Let's be real — people who are actually winning
                            don't cancel a service designed to help them win
                            more.
                          </p>
                          <p className='text-sm sm:text-base text-gray-700'>
                            You didn't join because you needed charity — you
                            joined because you knew something was missing. Now
                            you're quitting and hiding behind the 'I'm good now'
                            excuse? Nah. That's not it.
                          </p>
                          <p className='text-sm sm:text-base font-semibold text-red-600'>
                            This isn't about money. It's about mindset. And
                            right now, yours is slipping.
                          </p>
                          <div className='bg-blue-100 rounded-lg p-3 sm:p-4 border border-blue-300'>
                            <p className='text-sm sm:text-base text-blue-800 font-medium'>
                              💡 Hit 'Go Back' if you're not ready to settle for
                              average.
                            </p>
                          </div>
                        </div>
                      </div>

                      <AlertDialogFooter className='pt-4 sm:pt-6 px-2 sm:px-4 flex-col sm:flex-row gap-3 sm:gap-4'>
                        <Button
                          onClick={() => setCancelStep('reason')}
                          variant='outline'
                          className='h-11 sm:h-12 text-sm sm:text-base w-full sm:w-auto min-w-[140px] rounded-lg sm:rounded-xl border-2 border-blue-500 text-blue-600 hover:bg-blue-50 touch-manipulation'
                        >
                          ← Go Back
                        </Button>
                        <Button
                          onClick={() => setCancelStep('intermediate')}
                          className='h-11 sm:h-12 text-sm sm:text-base w-full sm:flex-1 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold rounded-lg sm:rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 touch-manipulation'
                        >
                          Continue Anyway
                        </Button>
                      </AlertDialogFooter>
                    </>
                  ) : selectedReason === 'time' ? (
                    // Custom message for "I don't have enough time"
                    <>
                      <AlertDialogHeader className='text-center pb-4 sm:pb-6 px-2 sm:px-4'>
                        <div className='flex items-center justify-center mb-4 sm:mb-6'>
                          <div className='w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full flex items-center justify-center shadow-lg'>
                            <Clock className='h-6 w-6 sm:h-8 sm:w-8 text-white' />
                          </div>
                        </div>
                        <AlertDialogTitle className='text-lg sm:text-xl md:text-2xl mb-3 sm:mb-4 font-bold text-blue-600 leading-tight'>
                          ⏱ Good news — you don't need much time at all.
                        </AlertDialogTitle>
                      </AlertDialogHeader>

                      <div className='py-4 sm:py-6 px-2 sm:px-4'>
                        <div className='bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-blue-200 space-y-3 sm:space-y-4 text-center'>
                          <p className='text-sm sm:text-base text-gray-700'>
                            This isn't day trading. These are swing trades built
                            specifically for people with full-time jobs.
                          </p>
                          <p className='text-sm sm:text-base text-gray-700'>
                            Most members spend just{' '}
                            <strong className='text-blue-600'>
                              5–15 minutes a month
                            </strong>{' '}
                            copying alerts — and even if you're a little late to
                            enter, it's fine. We look for big moves and often
                            hold positions for weeks or even months.
                          </p>
                          <p className='text-sm sm:text-base text-gray-700'>
                            You get exact entries, exits, and updates. No
                            overthinking. No screen-watching.
                          </p>
                          <p className='text-sm sm:text-base font-semibold text-gray-800'>
                            Truth is, saying "I don't have time" is just an
                            excuse. Even Elon Musk could make time for this.
                          </p>
                          <div className='bg-green-100 rounded-lg p-3 sm:p-4 border border-green-300'>
                            <p className='text-sm sm:text-base text-green-800 font-medium'>
                              🔁 Want to give it another shot?
                            </p>
                          </div>
                        </div>
                      </div>

                      <AlertDialogFooter className='pt-4 sm:pt-6 px-2 sm:px-4 flex-col sm:flex-row gap-3 sm:gap-4'>
                        <Button
                          onClick={() => setCancelStep('reason')}
                          variant='outline'
                          className='h-11 sm:h-12 text-sm sm:text-base w-full sm:w-auto min-w-[140px] rounded-lg sm:rounded-xl border-2 border-blue-500 text-blue-600 hover:bg-blue-50 touch-manipulation'
                        >
                          ← Go Back
                        </Button>
                        <Button
                          onClick={() => setCancelStep('intermediate')}
                          className='h-11 sm:h-12 text-sm sm:text-base w-full sm:flex-1 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold rounded-lg sm:rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 touch-manipulation'
                        >
                          Continue Anyway
                        </Button>
                      </AlertDialogFooter>
                    </>
                  ) : selectedReason === 'ready' ? (
                    // Custom message for "I'm not ready yet"
                    <>
                      <AlertDialogHeader className='text-center pb-4 sm:pb-6 px-2 sm:px-4'>
                        <div className='flex items-center justify-center mb-4 sm:mb-6'>
                          <div className='w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-r from-orange-500 to-orange-600 rounded-full flex items-center justify-center shadow-lg'>
                            <AlertTriangle className='h-6 w-6 sm:h-8 sm:w-8 text-white' />
                          </div>
                        </div>
                        <AlertDialogTitle className='text-lg sm:text-xl md:text-2xl mb-3 sm:mb-4 font-bold text-orange-600 leading-tight'>
                          Let's be real...
                        </AlertDialogTitle>
                      </AlertDialogHeader>

                      <div className='py-4 sm:py-6 px-2 sm:px-4'>
                        <div className='bg-gradient-to-br from-orange-50 to-yellow-50 rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-orange-200 space-y-3 sm:space-y-4 text-center'>
                          <p className='text-sm sm:text-base font-semibold text-gray-800'>
                            Let me be real with you — 'I'm not ready yet' is
                            just another excuse.
                          </p>
                          <p className='text-sm sm:text-base text-gray-700'>
                            This isn't rocket science. You're not building a
                            business from scratch — you're getting trade alerts.
                          </p>
                          <p className='text-sm sm:text-base text-gray-700'>
                            If you don't know how to use them, we've got
                            tutorial videos that walk you through everything
                            step-by-step.
                          </p>
                          <p className='text-sm sm:text-base font-semibold text-gray-800'>
                            You don't need to be 'ready.' You just need to stop
                            hesitating.
                          </p>
                          <p className='text-sm sm:text-base text-gray-700'>
                            Most people who say this stay stuck for years… or
                            forever.
                          </p>
                          <div className='bg-blue-100 rounded-lg p-3 sm:p-4 border border-blue-300'>
                            <p className='text-sm sm:text-base text-blue-800 font-medium'>
                              💪 Hit 'Go Back' if you're done quitting on
                              yourself.
                            </p>
                          </div>
                        </div>
                      </div>

                      <AlertDialogFooter className='pt-4 sm:pt-6 px-2 sm:px-4 flex-col sm:flex-row gap-3 sm:gap-4'>
                        <Button
                          onClick={() => setCancelStep('reason')}
                          variant='outline'
                          className='h-11 sm:h-12 text-sm sm:text-base w-full sm:w-auto min-w-[140px] rounded-lg sm:rounded-xl border-2 border-blue-500 text-blue-600 hover:bg-blue-50 touch-manipulation'
                        >
                          ← Go Back
                        </Button>
                        <Button
                          onClick={() => setCancelStep('intermediate')}
                          className='h-11 sm:h-12 text-sm sm:text-base w-full sm:flex-1 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold rounded-lg sm:rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 touch-manipulation'
                        >
                          Continue Anyway
                        </Button>
                      </AlertDialogFooter>
                    </>
                  ) : selectedReason === 'unknown' ? (
                    // Custom message for "I don't know what to do"
                    <>
                      <AlertDialogHeader className='text-center pb-4 sm:pb-6 px-2 sm:px-4'>
                        <div className='flex items-center justify-center mb-4 sm:mb-6'>
                          <div className='w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-r from-purple-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg'>
                            <CheckCircle className='h-6 w-6 sm:h-8 sm:w-8 text-white' />
                          </div>
                        </div>
                        <AlertDialogTitle className='text-lg sm:text-xl md:text-2xl mb-3 sm:mb-4 font-bold text-purple-600 leading-tight'>
                          That's exactly why you should stay!
                        </AlertDialogTitle>
                      </AlertDialogHeader>

                      <div className='py-4 sm:py-6 px-2 sm:px-4'>
                        <div className='bg-gradient-to-br from-purple-50 to-violet-50 rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-purple-200 space-y-3 sm:space-y-4 text-center'>
                          <p className='text-sm sm:text-base font-semibold text-gray-800'>
                            Saying 'I don't know what to do' is exactly why you
                            shouldn't quit.
                          </p>
                          <p className='text-sm sm:text-base text-gray-700'>
                            We literally made this foolproof — just click the{' '}
                            <strong className='text-purple-600'>
                              #start-here
                            </strong>{' '}
                            section and follow the steps. That's it.
                          </p>
                          <p className='text-sm sm:text-base text-gray-700'>
                            It explains exactly how to use the alerts, how to
                            get help, and how to get results — step by step.
                          </p>
                          <p className='text-sm sm:text-base font-semibold text-gray-800'>
                            You don't need to figure anything out. You just need
                            to follow instructions.
                          </p>
                          <p className='text-sm sm:text-base text-gray-700'>
                            Don't give up before even starting.
                          </p>
                          <div className='bg-green-100 rounded-lg p-3 sm:p-4 border border-green-300'>
                            <p className='text-sm sm:text-base text-green-800 font-medium'>
                              🤝 Hit 'Go Back' — I'll walk with you the whole
                              way.
                            </p>
                          </div>
                        </div>
                      </div>

                      <AlertDialogFooter className='pt-4 sm:pt-6 px-2 sm:px-4 flex-col sm:flex-row gap-3 sm:gap-4'>
                        <Button
                          onClick={() => setCancelStep('reason')}
                          variant='outline'
                          className='h-11 sm:h-12 text-sm sm:text-base w-full sm:w-auto min-w-[140px] rounded-lg sm:rounded-xl border-2 border-blue-500 text-blue-600 hover:bg-blue-50 touch-manipulation'
                        >
                          ← Go Back
                        </Button>
                        <Button
                          onClick={() => setCancelStep('intermediate')}
                          className='h-11 sm:h-12 text-sm sm:text-base w-full sm:flex-1 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold rounded-lg sm:rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 touch-manipulation'
                        >
                          Continue Anyway
                        </Button>
                      </AlertDialogFooter>
                    </>
                  ) : (
                    // Default message for other reasons
                    <>
                      <AlertDialogHeader className='text-center pb-4 sm:pb-6 px-2 sm:px-4'>
                        <div className='flex items-center justify-center mb-4 sm:mb-6'>
                          <div className='w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-r from-gray-500 to-gray-600 rounded-full flex items-center justify-center shadow-lg'>
                            <CheckCircle className='h-6 w-6 sm:h-8 sm:w-8 text-white' />
                          </div>
                        </div>
                        <AlertDialogTitle className='text-lg sm:text-xl md:text-2xl mb-3 sm:mb-4 font-bold text-gray-700 leading-tight'>
                          We understand your concern
                        </AlertDialogTitle>
                        <AlertDialogDescription className='text-center text-sm sm:text-base text-gray-600 px-2'>
                          Thank you for your feedback. We'll take this into
                          consideration for future improvements.
                        </AlertDialogDescription>
                      </AlertDialogHeader>

                      <div className='py-6 sm:py-8 px-2 sm:px-4'>
                        <div className='bg-gradient-to-br from-gray-50 to-slate-50 rounded-xl sm:rounded-2xl p-6 sm:p-8 border border-gray-200 min-h-[120px] flex items-center justify-center'>
                          <p className='text-gray-500 text-sm sm:text-base italic'>
                            We appreciate your honesty and will use this
                            feedback to improve our service.
                          </p>
                        </div>
                      </div>

                      <AlertDialogFooter className='pt-4 sm:pt-6 px-2 sm:px-4 flex-col sm:flex-row gap-3 sm:gap-4'>
                        <Button
                          onClick={() => setCancelStep('reason')}
                          variant='outline'
                          className='h-11 sm:h-12 text-sm sm:text-base w-full sm:w-auto min-w-[140px] rounded-lg sm:rounded-xl border-2 border-blue-500 text-blue-600 hover:bg-blue-50 touch-manipulation'
                        >
                          ← Back
                        </Button>
                        <Button
                          onClick={() => setCancelStep('intermediate')}
                          className='h-11 sm:h-12 text-sm sm:text-base w-full sm:flex-1 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold rounded-lg sm:rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 touch-manipulation'
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
                  <AlertDialogHeader className='text-center pb-4 sm:pb-6 px-2 sm:px-4'>
                    <div className='flex items-center justify-center mb-4 sm:mb-6'>
                      <div className='w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center shadow-lg'>
                        <DollarSign className='h-6 w-6 sm:h-8 sm:w-8 text-white' />
                      </div>
                    </div>
                    <AlertDialogTitle className='text-xl sm:text-2xl md:text-3xl mb-3 sm:mb-4 font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent leading-tight'>
                      💰 Wait, let's find a price that works
                    </AlertDialogTitle>
                    <AlertDialogDescription className='text-center text-sm sm:text-base md:text-lg text-gray-600 leading-relaxed px-2'>
                      Hey, is there a price that you would be able to afford and
                      would work for you long term?
                    </AlertDialogDescription>
                  </AlertDialogHeader>

                  <div className='py-6 sm:py-8 px-2 sm:px-4'>
                    <div className='bg-gradient-to-br from-green-900/20 to-emerald-900/20 rounded-xl sm:rounded-2xl p-4 sm:p-6 md:p-8 border-2 border-green-700 shadow-lg'>
                      <div className='space-y-4 sm:space-y-6'>
                        <Label
                          htmlFor='price-input'
                          className='text-base sm:text-lg md:text-xl font-semibold text-center block text-gray-800'
                        >
                          What price would work for you? (per month)
                        </Label>
                        <div className='flex items-center justify-center space-x-2 sm:space-x-3'>
                          <span className='text-2xl sm:text-3xl md:text-4xl font-bold text-green-600'>
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
                            className='text-center text-xl sm:text-2xl md:text-3xl font-bold h-12 sm:h-14 md:h-16 w-24 sm:w-28 md:w-32 border-2 border-green-300 focus:border-green-500 rounded-lg sm:rounded-xl bg-white shadow-inner'
                          />
                        </div>
                        <p className='text-center text-xs sm:text-sm text-gray-500 leading-relaxed'>
                          Enter any amount you feel comfortable paying monthly
                        </p>
                        <div className='bg-gradient-to-r from-yellow-900/20 to-orange-900/20 rounded-lg p-3 sm:p-4 border border-yellow-700'>
                          <p className='text-xs sm:text-sm text-yellow-300 text-center font-medium'>
                            💡 <strong>Tip:</strong> We'll make you our best
                            offer based on your budget!
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <AlertDialogFooter className='pt-4 sm:pt-6 px-2 sm:px-4 flex-col space-y-3 sm:space-y-4'>
                    <div className='flex w-full gap-3 sm:gap-4 flex-col sm:flex-row'>
                      <Button
                        onClick={() => setCancelStep('confirmation')}
                        variant='outline'
                        className='h-11 sm:h-12 text-sm sm:text-base w-full sm:flex-1 rounded-lg sm:rounded-xl border-2 border-gray-300 hover:border-gray-400 touch-manipulation'
                      >
                        ← Back
                      </Button>
                      <Button
                        onClick={handlePriceSubmit}
                        disabled={!priceInput.trim()}
                        className='h-11 sm:h-12 text-sm sm:text-base w-full sm:flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold rounded-lg sm:rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 touch-manipulation disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none'
                      >
                        <span className='flex items-center justify-center gap-2'>
                          ✨ Submit Price
                        </span>
                      </Button>
                    </div>
                    <Button
                      onClick={handleFinalOffer}
                      variant='outline'
                      className='w-full h-11 sm:h-12 text-sm sm:text-base border-2 border-red-500 text-red-600 hover:bg-red-50 rounded-lg sm:rounded-xl font-medium touch-manipulation'
                    >
                      NO, continue to cancel
                    </Button>
                  </AlertDialogFooter>
                </>
              )}

              {/* Step 4: Authentication */}
              {cancelStep === 'auth' && (
                <>
                  <AlertDialogHeader className='pb-4 sm:pb-6 px-2 sm:px-4'>
                    <div className='flex items-center justify-center mb-4 sm:mb-6'>
                      <div className='w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-r from-red-500 to-red-600 rounded-full flex items-center justify-center shadow-lg'>
                        <AlertTriangle className='h-6 w-6 sm:h-8 sm:w-8 text-white' />
                      </div>
                    </div>
                    <AlertDialogTitle className='text-lg sm:text-xl md:text-2xl font-bold text-red-600 text-center leading-tight'>
                      Disable Auto-Renewal?
                    </AlertDialogTitle>
                    <AlertDialogDescription asChild>
                      <div className='text-center mt-3 sm:mt-4 px-2'>
                        <div className='space-y-3 sm:space-y-4'>
                          <p className='text-sm sm:text-base md:text-lg text-gray-600 leading-relaxed'>
                            This will disable auto-renewal for your
                            subscription. Here's what happens:
                          </p>
                          <div className='bg-gradient-to-br from-gray-800/50 to-slate-800/50 rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-gray-600'>
                            <ul className='space-y-2 sm:space-y-3 text-left'>
                              <li className='flex items-start gap-2 sm:gap-3'>
                                <span className='text-green-500 text-sm sm:text-base'>
                                  ✅
                                </span>
                                <span className='text-xs sm:text-sm md:text-base text-gray-700 leading-relaxed'>
                                  Your subscription stays{' '}
                                  <strong className='text-green-600'>
                                    active
                                  </strong>{' '}
                                  until{' '}
                                  <strong className='text-blue-600'>
                                    {subscription?.stripe?.currentPeriodEnd
                                      ? new Date(
                                          subscription.stripe.currentPeriodEnd
                                        ).toLocaleDateString()
                                      : new Date(
                                          subscription.subscriptionEnd
                                        ).toLocaleDateString()}
                                  </strong>
                                </span>
                              </li>
                              <li className='flex items-start gap-2 sm:gap-3'>
                                <span className='text-green-500 text-sm sm:text-base'>
                                  ✅
                                </span>
                                <span className='text-xs sm:text-sm md:text-base text-gray-700'>
                                  You keep all premium features until then
                                </span>
                              </li>
                              <li className='flex items-start gap-2 sm:gap-3'>
                                <span className='text-blue-500 text-sm sm:text-base'>
                                  🔄
                                </span>
                                <span className='text-xs sm:text-sm md:text-base text-gray-700'>
                                  <strong className='text-blue-600'>
                                    You can re-enable auto-renewal anytime
                                  </strong>{' '}
                                  before expiration
                                </span>
                              </li>
                              <li className='flex items-start gap-2 sm:gap-3'>
                                <span className='text-orange-500 text-sm sm:text-base'>
                                  ⏹️
                                </span>
                                <span className='text-xs sm:text-sm md:text-base text-gray-700'>
                                  Only expires if auto-renewal stays disabled
                                </span>
                              </li>
                            </ul>
                          </div>
                          <div className='bg-gradient-to-r from-blue-900/20 to-cyan-900/20 p-3 sm:p-4 rounded-lg sm:rounded-xl border border-blue-700'>
                            <p className='text-xs sm:text-sm text-blue-300 font-medium'>
                              💡 <strong>Pro Tip:</strong> This is reversible!
                              Simply toggle auto-renewal back on to resume
                              normal billing.
                            </p>
                          </div>
                        </div>
                      </div>
                    </AlertDialogDescription>
                  </AlertDialogHeader>

                  <div className='space-y-3 sm:space-y-4 py-4 sm:py-6 px-2 sm:px-4'>
                    <Label
                      htmlFor='cancel-password'
                      className='text-sm sm:text-base md:text-lg font-semibold text-gray-800'
                    >
                      Enter your password to confirm:
                    </Label>
                    <div className='relative'>
                      <Input
                        id='cancel-password'
                        type='password'
                        value={cancelPassword}
                        onChange={e => setCancelPassword(e.target.value)}
                        placeholder='Your account password'
                        className='h-11 sm:h-12 md:h-14 text-sm sm:text-base border-2 border-red-200 focus:border-red-400 rounded-lg sm:rounded-xl bg-white shadow-inner pr-4 touch-manipulation'
                      />
                      <div className='absolute right-3 top-1/2 transform -translate-y-1/2'>
                        <Shield className='h-4 w-4 sm:h-5 sm:w-5 text-red-400' />
                      </div>
                    </div>
                    <p className='text-xs sm:text-sm text-gray-500 leading-relaxed'>
                      Password confirmation is required for account security
                    </p>
                  </div>

                  <AlertDialogFooter className='pt-4 sm:pt-6 px-2 sm:px-4 flex-col sm:flex-row gap-3 sm:gap-4'>
                    <Button
                      onClick={() => {
                        setCancelPassword('');
                        setCancelStep('intermediate');
                      }}
                      variant='outline'
                      className='h-11 sm:h-12 text-sm sm:text-base w-full sm:w-auto min-w-[140px] rounded-lg sm:rounded-xl border-2 border-gray-300 hover:border-gray-400 touch-manipulation'
                    >
                      ← Back
                    </Button>
                    <Button
                      onClick={handleCancelSubscription}
                      disabled={isCancelling || !cancelPassword.trim()}
                      className='h-11 sm:h-12 text-sm sm:text-base w-full sm:flex-1 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-semibold rounded-lg sm:rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 touch-manipulation disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none px-4 sm:px-6'
                    >
                      {isCancelling ? (
                        <span className='flex items-center justify-center gap-2'>
                          <Loader2 className='h-4 w-4 animate-spin' />
                          Disabling...
                        </span>
                      ) : (
                        <span className='flex items-center justify-center gap-2'>
                          <Shield className='h-4 w-4' />
                          Disable Auto-Renewal
                        </span>
                      )}
                    </Button>
                  </AlertDialogFooter>
                </>
              )}
            </AlertDialogContent>
          </AlertDialog>

          {/* Price Offer Modal */}
          <AlertDialog open={showOfferModal} onOpenChange={setShowOfferModal}>
            <AlertDialogContent className='max-w-sm sm:max-w-2xl md:max-w-4xl w-[95%] sm:w-full mx-auto max-h-[80vh] sm:max-h-[90vh] overflow-y-auto'>
              <AlertDialogHeader className='text-center pb-4 sm:pb-6 px-2 sm:px-4'>
                <div className='flex items-center justify-center mb-4 sm:mb-6'>
                  <div className='w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center shadow-lg animate-pulse'>
                    <span className='text-xl sm:text-2xl'>🔒</span>
                  </div>
                </div>
                <AlertDialogTitle className='text-2xl sm:text-3xl md:text-4xl mb-3 sm:mb-4 font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent leading-tight'>
                  🔒 ONE TIME OFFER
                </AlertDialogTitle>
                <AlertDialogDescription className='text-center text-sm sm:text-base md:text-lg text-gray-600 leading-relaxed px-2'>
                  Hey — we've got a{' '}
                  <strong className='text-green-600'>🔒 ONE TIME OFFER</strong>{' '}
                  for you:{' '}
                  <strong className='text-2xl sm:text-3xl text-green-600'>
                    ${currentOffer}/month
                  </strong>
                  <br className='hidden sm:inline' />
                  <span className='block sm:inline sm:ml-1'>
                    , locked in for life as long as you stay subscribed
                    {currentOffer === 19.99
                      ? ' and this is the LOWEST offer we have!'
                      : currentOffer === 15
                        ? '.'
                        : ' and this is the LOWEST offer we have!'}
                  </span>
                </AlertDialogDescription>
              </AlertDialogHeader>

              <div className='py-6 sm:py-8 px-2 sm:px-4'>
                <div className='bg-gradient-to-br from-green-900/20 to-emerald-900/20 rounded-xl sm:rounded-2xl p-6 sm:p-8 border-2 border-green-700 text-center shadow-lg relative overflow-hidden'>
                  {/* Background decoration */}
                  <div className='absolute top-0 right-0 w-20 h-20 bg-green-300/20 rounded-full blur-xl'></div>
                  <div className='absolute bottom-0 left-0 w-16 h-16 bg-emerald-300/20 rounded-full blur-xl'></div>

                  <div className='relative z-10'>
                    <div className='text-4xl sm:text-5xl md:text-6xl font-bold text-green-600 mb-3 sm:mb-4 animate-pulse'>
                      ${currentOffer}/month
                    </div>
                    <div className='flex flex-col sm:flex-row items-center justify-center space-y-2 sm:space-y-0 sm:space-x-4 text-xs sm:text-sm text-gray-600'>
                      <span className='flex items-center gap-1'>
                        🔒 <span>Locked in for life</span>
                      </span>
                      <span className='hidden sm:block text-gray-400'>•</span>
                      <span className='flex items-center gap-1'>
                        📈 <span>No price increases ever</span>
                      </span>
                    </div>
                    <div className='mt-3 sm:mt-4 bg-gray-800/50 rounded-lg p-2 sm:p-3 backdrop-blur-sm'>
                      <p className='text-xs sm:text-sm text-gray-300 font-medium'>
                        💎 This offer expires when you leave this page
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <AlertDialogFooter className='pt-4 sm:pt-6 px-2 sm:px-4 flex-col space-y-3 sm:space-y-4'>
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
                  className='w-full h-12 sm:h-14 md:h-16 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white text-base sm:text-lg md:text-xl font-bold rounded-lg sm:rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 touch-manipulation disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none'
                >
                  {isApplyingCoupon ? (
                    <span className='flex items-center justify-center gap-2'>
                      <Loader2 className='h-4 w-4 sm:h-5 sm:w-5 animate-spin' />
                      Applying Discount...
                    </span>
                  ) : (
                    <span className='flex items-center justify-center gap-2'>
                      ✅ ACCEPT THIS OFFER
                    </span>
                  )}
                </Button>
                <div className='flex w-full gap-3 sm:gap-4 flex-col sm:flex-row'>
                  <Button
                    onClick={() => {
                      setShowOfferModal(false);
                      setCancelStep('intermediate');
                      setShowCancelDialog(true);
                    }}
                    variant='outline'
                    className='h-10 sm:h-12 text-sm sm:text-base w-full sm:w-auto min-w-[140px] rounded-lg sm:rounded-xl border-2 border-gray-300 hover:border-gray-400 touch-manipulation'
                  >
                    ← Back
                  </Button>
                  <Button
                    onClick={() => {
                      setShowOfferModal(false);
                      setCancelStep('auth');
                      setShowCancelDialog(true);
                    }}
                    variant='outline'
                    className='w-full sm:flex-1 h-10 sm:h-12 text-sm sm:text-base border-2 border-red-500 text-red-600 hover:bg-red-50 rounded-lg sm:rounded-xl font-medium touch-manipulation'
                  >
                    Continue to cancel
                  </Button>
                </div>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Final Offer Modal */}
          <AlertDialog open={showFinalOffer} onOpenChange={setShowFinalOffer}>
            <AlertDialogContent className='max-w-sm sm:max-w-2xl md:max-w-4xl w-[95%] sm:w-full mx-auto max-h-[80vh] sm:max-h-[90vh] overflow-y-auto'>
              <AlertDialogHeader className='text-center pb-4 sm:pb-6 px-2 sm:px-4'>
                <div className='flex items-center justify-center mb-4 sm:mb-6'>
                  <div className='w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-r from-red-500 to-orange-500 rounded-full flex items-center justify-center shadow-lg animate-pulse'>
                    <span className='text-xl sm:text-2xl'>🚨</span>
                  </div>
                </div>
                <AlertDialogTitle className='text-xl sm:text-2xl md:text-4xl mb-3 sm:mb-4 font-bold bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent leading-tight'>
                  🚨 LAST OFFER — $19.99/Month
                </AlertDialogTitle>
                <AlertDialogDescription className='text-center text-sm sm:text-base md:text-lg text-gray-600 leading-relaxed px-2'>
                  This is the absolute lowest price we'll ever offer. No games.
                  No second chances.
                  <br className='hidden sm:inline' />
                  <br className='hidden sm:inline' />
                  <span className='block sm:inline'>
                    It's a one-time deal — take it or leave it.
                  </span>
                  <br className='hidden sm:inline' />
                  <span className='block sm:inline'>
                    But just know:{' '}
                    <strong className='text-red-600'>
                      you will never see a discount again. Period.
                    </strong>
                  </span>
                </AlertDialogDescription>
              </AlertDialogHeader>

              <div className='py-6 sm:py-8 px-2 sm:px-4'>
                <div className='bg-gradient-to-br from-red-900/20 to-orange-900/20 rounded-xl sm:rounded-2xl p-6 sm:p-8 border-2 border-red-700 text-center shadow-lg relative overflow-hidden'>
                  {/* Background decoration */}
                  <div className='absolute top-0 right-0 w-20 h-20 bg-red-300/20 rounded-full blur-xl animate-pulse'></div>
                  <div className='absolute bottom-0 left-0 w-16 h-16 bg-orange-300/20 rounded-full blur-xl animate-pulse delay-1000'></div>

                  <div className='relative z-10'>
                    <div className='text-3xl sm:text-4xl md:text-6xl font-bold text-red-600 mb-3 sm:mb-4 animate-pulse'>
                      $19.99/month
                    </div>
                    <div className='flex flex-col sm:flex-row items-center justify-center space-y-2 sm:space-y-0 sm:space-x-4 text-xs sm:text-sm text-gray-600'>
                      <span className='flex items-center gap-1'>
                        ⚡ <span>Final offer</span>
                      </span>
                      <span className='hidden sm:block text-gray-400'>•</span>
                      <span className='flex items-center gap-1'>
                        🔒 <span>Locked in for life</span>
                      </span>
                    </div>
                    <div className='mt-3 sm:mt-4 bg-gradient-to-r from-red-900/20 to-orange-900/20 rounded-lg p-3 sm:p-4 border border-red-700'>
                      <p className='text-xs sm:text-sm text-red-300 font-bold'>
                        ⚠️ This is your final chance — no more offers after
                        this!
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <AlertDialogFooter className='pt-4 sm:pt-6 px-2 sm:px-4 flex-col space-y-3 sm:space-y-4'>
                <Button
                  onClick={async () => {
                    const success = await createAndApplyCoupon(19.99);
                    if (success) {
                      setShowFinalOffer(false);
                      setShowCancelDialog(false);
                    }
                  }}
                  disabled={isApplyingCoupon}
                  className='w-full h-12 sm:h-14 md:h-16 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white text-base sm:text-lg md:text-xl font-bold rounded-lg sm:rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 touch-manipulation disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none'
                >
                  {isApplyingCoupon ? (
                    <span className='flex items-center justify-center gap-2'>
                      <Loader2 className='h-4 w-4 sm:h-5 sm:w-5 animate-spin' />
                      Applying Discount...
                    </span>
                  ) : (
                    <span className='flex items-center justify-center gap-2'>
                      ✅ TAKE THE DEAL
                    </span>
                  )}
                </Button>
                <div className='flex w-full gap-3 sm:gap-4 flex-col sm:flex-row'>
                  <Button
                    onClick={() => {
                      setShowFinalOffer(false);
                      setCancelStep('intermediate');
                      setShowCancelDialog(true);
                    }}
                    variant='outline'
                    className='h-10 sm:h-12 text-sm sm:text-base w-full sm:w-auto min-w-[140px] rounded-lg sm:rounded-xl border-2 border-gray-300 hover:border-gray-400 touch-manipulation'
                  >
                    ← Back
                  </Button>
                  <Button
                    onClick={() => {
                      setShowFinalOffer(false);
                      setCancelStep('auth');
                      setShowCancelDialog(true);
                    }}
                    variant='outline'
                    className='w-full sm:flex-1 h-10 sm:h-12 text-sm sm:text-base border-2 border-gray-500 text-gray-600 hover:bg-gray-50 rounded-lg sm:rounded-xl font-medium touch-manipulation'
                  >
                    <span className='flex items-center justify-center gap-2'>
                      <XCircle className='h-4 w-4' />
                      Cancel my subscription
                    </span>
                  </Button>
                </div>
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
                  <span className='text-gray-600'>Customer ID:</span>
                  <span className='font-mono text-xs'>
                    {subscription.customer.id}
                  </span>
                </div>
                <div className='flex justify-between'>
                  <span className='text-gray-600'>Account Created:</span>
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

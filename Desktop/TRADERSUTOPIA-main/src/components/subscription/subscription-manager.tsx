"use client";

/* Add to your global CSS for scrollbar hiding:
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
*/

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  Crown,
  Sparkles,
  Clock,
  Lock
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
  const [subscription, setSubscription] = useState<SubscriptionDetails | null>(null);
  const [isUpdatingAutoRenew, setIsUpdatingAutoRenew] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelPassword, setCancelPassword] = useState('');
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  
  // Multi-step cancellation flow
  const [cancelStep, setCancelStep] = useState<'reason' | 'confirmation' | 'intermediate' | 'auth'>('reason');
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
      const currentDiscountedPrice = subscription?.stripe?.amount ? subscription.stripe.amount / 100 : 0;
      
      // Get the original price (before any discounts)
      const originalPrice = subscription?.stripe?.originalAmount 
        ? subscription.stripe.originalAmount / 100 
        : currentDiscountedPrice;
      
      console.log(`🔍 Price Analysis: Original: $${originalPrice}, Current: $${currentDiscountedPrice}, Target: $${newPrice}`);
      
      if (newPrice >= currentDiscountedPrice) {
        showToast.error('Error', 'New price must be lower than current price');
        return false;
      }

      // Calculate the percentage discount needed to go from ORIGINAL price to TARGET price
      const totalDiscountAmount = originalPrice - newPrice;
      const percentOff = Math.round((totalDiscountAmount / originalPrice) * 100);

      console.log(`🎯 Creating coupon: Original: $${originalPrice}, Target: $${newPrice}, Total Discount: ${percentOff}%`);

      const response = await makeSecureRequest('/api/subscription/create-coupon', {
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
      });

      const data = await response.json();
      
      if (response.ok) {
        showToast.success('🎉 Discount Applied!', `Your new rate of $${newPrice}/month has been locked in permanently!`);
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
          reason: 'Rejected all offers'
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        showToast.success('✅ Subscription Cancelled', 'Your subscription has been cancelled immediately.');
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
          console.log('⚠️ No Stripe subscription data found - Billing controls will be limited');
        }
        setSubscription(data.subscription);
      } else {
        console.error('❌ Failed to fetch subscription details:', response.status);
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
        showToast.success('🔄 Refreshed!', 'Subscription data synchronized and updated');
        console.log('✅ Sync successful, fetching updated details...');
      } else {
        const syncData = await syncResponse.json();
        console.log('⚠️ Sync failed, still refreshing local data...');
        showToast.warning('⚠️ Sync Warning', `Couldn't sync with Stripe, but refreshed local data. ${syncData.error || ''}`);
      }

      // Always fetch subscription details (even if sync failed)
      const response = await fetch('/api/subscription/details');
      if (response.ok) {
        const data = await response.json();
        console.log('📊 Updated subscription data received:', data);
        setSubscription(data.subscription);
      } else {
        console.error('❌ Failed to fetch subscription details:', response.status);
        showToast.error('Error', 'Failed to refresh subscription details');
      }
    } catch (error) {
      console.error('❌ Error refreshing subscription:', error);
      showToast.error('❌ Refresh Error', 'Failed to refresh subscription data');
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
      const response = await makeSecureRequest('/api/subscription/toggle-autorenew', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ autoRenew }),
      });

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
            }
          });
        }
      } else {
        showToast.error('Error', data.error || 'Failed to update auto-renewal setting');
        // Reset local state to prevent UI inconsistency and refresh current state
        if (subscription?.stripe) {
          setSubscription({
            ...subscription,
            stripe: {
              ...subscription.stripe,
              autoRenew: !autoRenew, // Reset to opposite of what user tried to set
              cancelAtPeriodEnd: autoRenew, // Reset cancel flag too
            }
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
          }
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
          confirmCancel: true 
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

${autoRenew ? 
  '✅ AUTO-RENEWAL IS ON: Your subscription WILL automatically renew at the end of the period.' :
  '❌ AUTO-RENEWAL IS OFF: Your subscription WILL EXPIRE at the end of the period unless you re-enable it.'
}

This data comes directly from Stripe and shows the REAL status of your subscription.
        `;

        alert(verificationMessage);
        showToast.success('✅ Verified!', 'Auto-renewal status confirmed with Stripe');
        
        // Refresh the UI with latest data
        await fetchSubscriptionDetails();
      } else {
        const errorData = await response.json();
        showToast.error('❌ Verification Failed', errorData.error || 'Failed to verify with Stripe');
      }
    } catch (error) {
      console.error('❌ Error verifying auto-renewal:', error);
      showToast.error('❌ Verification Error', 'Failed to verify auto-renewal status');
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
      ACTIVE: { 
        color: 'bg-gradient-to-r from-green-500 to-green-600 text-white border-green-400/50', 
        icon: CheckCircle, 
        text: 'Active',
        shadowColor: 'shadow-green-400/20'
      },
      CANCELLED: { 
        color: 'bg-gradient-to-r from-red-500 to-red-600 text-white border-red-400/50', 
        icon: XCircle, 
        text: 'Cancelled',
        shadowColor: 'shadow-red-400/20'
      },
      EXPIRED: { 
        color: 'bg-gradient-to-r from-gray-500 to-gray-600 text-white border-gray-400/50', 
        icon: XCircle, 
        text: 'Expired',
        shadowColor: 'shadow-gray-400/20'
      },
      FREE: { 
        color: 'bg-gradient-to-r from-blue-500 to-blue-600 text-white border-blue-400/50', 
        icon: Shield, 
        text: 'Free',
        shadowColor: 'shadow-blue-400/20'
      },
    } as const;

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.FREE;
    const Icon = config.icon;

    return (
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border backdrop-blur-sm font-bold text-sm shadow-lg ${config.color} ${config.shadowColor}`}>
        <Icon className="h-4 w-4" />
        {config.text}
      </div>
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
      <div className="w-full">
        <Card className="bg-gradient-to-br from-gray-800/60 via-gray-800/40 to-gray-900/60 border border-gray-600/30 backdrop-blur-md">
          <CardContent className="flex items-center justify-center py-8 sm:py-12">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-2xl flex items-center justify-center shadow-lg">
                <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin text-black" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg sm:text-xl font-semibold text-white">Loading subscription details...</h3>
                <p className="text-sm text-gray-400">Please wait while we fetch your billing information</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!subscription) {
    console.log('❌ SubscriptionManager: No subscription data found');
    return (
      <div className="w-full">
        <Card className="bg-gradient-to-br from-gray-800/60 via-gray-800/40 to-gray-900/60 border border-gray-600/30 backdrop-blur-md">
          <CardHeader className="text-center pb-4 sm:pb-6">
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-red-500/20 to-red-600/20 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-400/20">
              <XCircle className="h-6 w-6 sm:h-8 sm:w-8 text-red-400" />
            </div>
            <CardTitle className="text-xl sm:text-2xl font-bold text-white">
              No Subscription Found
            </CardTitle>
            <CardDescription className="text-gray-400 text-sm sm:text-base">
              We couldn't find any subscription information for your account
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  console.log('✅ SubscriptionManager: Rendering subscription UI for', subscription.status, 'subscription');

  return (
    <div className="w-full space-y-6 sm:space-y-8">
      <Card className="bg-gradient-to-br from-gray-800/60 via-gray-800/40 to-gray-900/60 border border-gray-600/30 backdrop-blur-md hover:border-blue-400/50 transition-all duration-500 hover:shadow-2xl hover:shadow-blue-400/10">
        <CardHeader className="pb-4 sm:pb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                <CreditCard className="h-5 h-5 sm:h-6 w-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-lg sm:text-2xl font-bold bg-gradient-to-r from-white to-gray-200 bg-clip-text text-transparent">
                  Subscription Management
                </CardTitle>
                <CardDescription className="text-gray-400 text-sm sm:text-base mt-1">
                  Manage your subscription and billing preferences
                </CardDescription>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full sm:w-auto">
              {getStatusBadge(subscription.status)}
              <Button
                variant="outline"
                size="sm"
                onClick={refreshAndSync}
                disabled={isLoading}
                title="Refresh & sync with Stripe"
                className="flex items-center gap-2 bg-gray-700/30 hover:bg-gray-600/50 border-gray-600/30 text-white w-full sm:w-auto"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                <span className="hidden sm:inline">Refresh</span>
                <span className="sm:hidden">Sync</span>
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="px-4 sm:px-6 lg:px-10 pb-4 sm:pb-6 lg:pb-10 space-y-6 sm:space-y-8">
          {/* Product Information */}
          {subscription.product && (
            <div className="space-y-4 sm:space-y-6">
              <h4 className="font-semibold text-lg sm:text-xl flex items-center gap-3 text-white">
                <div className="w-8 h-8 bg-gradient-to-br from-yellow-400/20 to-yellow-600/20 rounded-xl flex items-center justify-center border border-yellow-400/20">
                  <Crown className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-400" />
                </div>
                Current Plan
              </h4>
              <div className="bg-gradient-to-br from-gray-700/40 to-gray-800/40 backdrop-blur-sm p-4 sm:p-6 rounded-2xl border border-gray-600/30 hover:border-yellow-400/50 transition-all duration-300">
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 lg:gap-6">
                  <div className="flex-1">
                    <h5 className="font-bold text-lg sm:text-xl text-white mb-2">{subscription.product.name}</h5>
                    {subscription.product.description && (
                      <p className="text-sm sm:text-base text-gray-300 leading-relaxed">
                        {subscription.product.description}
                      </p>
                    )}
                  </div>
                  {subscription.stripe?.amount && (
                    <div className="text-center lg:text-right">
                      {subscription.stripe.hasDiscount && subscription.stripe.originalAmount ? (
                        <div className="space-y-2">
                          <div className="flex flex-col sm:flex-row items-center lg:items-end gap-2 lg:gap-3">
                            <span className="text-sm sm:text-base text-gray-400 line-through">
                              {formatCurrency(subscription.stripe.originalAmount, subscription.stripe.currency)}
                            </span>
                            <span className="text-xs sm:text-sm bg-gradient-to-r from-green-500 to-green-600 text-white px-3 py-1 rounded-full font-bold shadow-lg">
                              {subscription.stripe.discountPercent}% OFF
                            </span>
                          </div>
                          <div className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-green-400 to-green-500 bg-clip-text text-transparent">
                            {formatCurrency(subscription.stripe.amount, subscription.stripe.currency)}
                          </div>
                          <div className="text-sm sm:text-base text-gray-400">
                            per {subscription.stripe.interval}
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="text-2xl sm:text-3xl font-bold text-white">
                            {formatCurrency(subscription.stripe.amount, subscription.stripe.currency)}
                          </div>
                          <div className="text-sm sm:text-base text-gray-400">
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
          {subscription.stripe?.hasDiscount && subscription.stripe?.discountDetails && (
            <div className="bg-gradient-to-r from-green-500/10 via-green-500/5 to-emerald-500/10 backdrop-blur-sm p-4 sm:p-6 rounded-2xl border border-green-400/30 hover:border-green-400/50 transition-all duration-300 shadow-lg shadow-green-400/10">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg">
                    <Sparkles className="h-6 w-6 sm:h-7 sm:w-7 text-white" />
                  </div>
                </div>
                <div className="flex-1 space-y-2">
                  <h5 className="font-bold text-lg sm:text-xl text-green-300">
                    Permanent Discount Active!
                  </h5>
                  <p className="text-sm sm:text-base text-green-200 leading-relaxed">
                    You're saving <strong className="text-green-100">{subscription.stripe.discountPercent}% forever</strong> on your subscription. 
                    This discount will continue for the lifetime of your subscription.
                  </p>
                </div>
                <div className="flex-shrink-0">
                  <div className="bg-gradient-to-r from-green-500 to-emerald-600 px-4 py-2 rounded-xl shadow-lg">
                    <span className="text-xs sm:text-sm font-bold text-white">
                      {subscription.stripe.discountDetails.duration === 'forever' ? '🔒 PERMANENT' : '⏰ LIMITED TIME'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

        {/* Billing Information */}
        {(subscription.stripe || subscription.subscriptionStart) && (
          <div className="space-y-3">
            <h4 className="font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Billing Information
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Current Period</Label>
                <div className="text-sm text-gray-600 dark:text-gray-300">
                  {subscription.stripe && subscription.stripe.currentPeriodStart && subscription.stripe.currentPeriodEnd ? (
                    <>
                      {new Date(subscription.stripe.currentPeriodStart).toLocaleDateString()} - {' '}
                      {new Date(subscription.stripe.currentPeriodEnd).toLocaleDateString()}
                    </>
                  ) : (
                    <>
                      {new Date(subscription.subscriptionStart).toLocaleDateString()} - {' '}
                      {new Date(subscription.subscriptionEnd).toLocaleDateString()}
                    </>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Next Billing</Label>
                <div className="text-sm text-gray-600 dark:text-gray-300">
                  {subscription.stripe && subscription.stripe.currentPeriodEnd ? (
                    subscription.stripe.cancelAtPeriodEnd ? (
                      <span className="text-red-600 dark:text-red-400">
                        Cancelled - Expires {formatDistanceToNow(new Date(subscription.stripe.currentPeriodEnd), { addSuffix: true })}
                      </span>
                    ) : (
                      formatDistanceToNow(new Date(subscription.stripe.currentPeriodEnd), { addSuffix: true })
                    )
                  ) : (
                    <span className="text-blue-600 dark:text-blue-400">
                      Expires {formatDistanceToNow(new Date(subscription.subscriptionEnd), { addSuffix: true })}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Stripe Connection Status */}
        {!subscription.stripe && subscription.status === 'ACTIVE' && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div>
                <h5 className="font-medium text-yellow-900 dark:text-yellow-100">
                  Limited Subscription Management
                </h5>
                <p className="text-sm text-yellow-700 dark:text-yellow-200 mt-1">
                  Your subscription is active in our database, but we couldn't connect to detailed billing information from Stripe. 
                  Advanced features like auto-renewal management are currently unavailable.
                </p>
                <p className="text-xs text-yellow-600 dark:text-yellow-300 mt-2">
                  Contact support if you need to make changes to your subscription.
                </p>
              </div>
            </div>
          </div>
        )}

        <Separator />

        {/* Auto-Renewal Toggle with Integrated Cancellation */}
        {subscription.stripe && subscription.status === 'ACTIVE' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium flex items-center gap-2">
                <RefreshCw className="h-4 w-4" />
                Auto-Renewal & Subscription Management
              </h4>
              <Button
                variant="outline"
                size="sm"
                onClick={verifyAutoRenewalStatus}
                disabled={isLoading}
                title="Verify auto-renewal status directly with Stripe"
                className="flex items-center gap-1.5 text-blue-600 border-blue-200 hover:bg-blue-50"
              >
                {isLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Eye className="h-3 w-3" />
                )}
                Verify Status
              </Button>
            </div>
            <div className={`p-4 rounded-lg border ${
              subscription.stripe.autoRenew 
                ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' 
                : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
            }`}>
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <Label htmlFor="auto-renew" className="text-sm font-medium flex items-center gap-2">
                    {subscription.stripe.autoRenew ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                    )}
                    Automatic Renewal
                  </Label>
                  <div className="text-xs text-gray-600 dark:text-gray-300">
                    {subscription.stripe.autoRenew ? (
                      <p>✅ Your subscription will automatically renew at the end of each billing period</p>
                    ) : (
                      <div className="space-y-1">
                        <p className="text-red-600 dark:text-red-400">
                          ⚠️ Auto-renewal is disabled. Your subscription will expire on{' '}
                          {subscription.stripe.currentPeriodEnd 
                            ? new Date(subscription.stripe.currentPeriodEnd).toLocaleDateString()
                            : new Date(subscription.subscriptionEnd).toLocaleDateString()}
                        </p>
                        <p className="text-blue-600 dark:text-blue-400">
                          💡 You can turn auto-renewal back on anytime before then to continue your subscription
                        </p>
                      </div>
                    )}
                  </div>
                </div>
                <Switch
                  id="auto-renew"
                  checked={subscription.stripe.autoRenew}
                  onCheckedChange={handleAutoRenewToggle}
                  disabled={isUpdatingAutoRenew}
                />
              </div>
            </div>
            
            {/* Re-enable Auto-Renewal Notice */}
            {!subscription.stripe.autoRenew && (
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-start gap-3">
                  <RefreshCw className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div>
                    <h5 className="font-medium text-blue-900 dark:text-blue-100">
                      Want to continue your subscription?
                    </h5>
                    <p className="text-sm text-blue-700 dark:text-blue-200 mt-1">
                      Simply toggle auto-renewal back on above to resume normal billing and keep your premium access.
                      Your subscription will then automatically renew on{' '}
                      {subscription.stripe.currentPeriodEnd 
                        ? new Date(subscription.stripe.currentPeriodEnd).toLocaleDateString()
                        : new Date(subscription.subscriptionEnd).toLocaleDateString()}.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {isUpdatingAutoRenew && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Loader2 className="h-3 w-3 animate-spin" />
                Updating subscription settings...
              </div>
            )}
          </div>
        )}

          {/* Cancellation Confirmation Dialog */}
          <AlertDialog open={showCancelDialog} onOpenChange={(open) => {
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
          }}>
            <AlertDialogContent className="!fixed !left-1/2 !top-1/2 !-translate-x-1/2 !-translate-y-1/2 w-[95vw] sm:w-[85vw] md:w-[75vw] lg:w-[65vw] xl:w-[55vw] max-w-2xl max-h-[85vh] sm:max-h-[80vh] bg-gradient-to-br from-gray-800/95 via-gray-800/90 to-gray-900/95 backdrop-blur-xl border border-gray-600/30 rounded-2xl shadow-2xl">
              
              {/* Animated Background Effects */}
              <div className="absolute inset-0 overflow-hidden rounded-2xl">
                <div className="absolute -top-10 -right-10 w-20 h-20 bg-blue-500/10 rounded-full blur-xl animate-pulse"></div>
                <div className="absolute bottom-0 -left-10 w-16 h-16 bg-purple-500/10 rounded-full blur-xl animate-pulse delay-1000"></div>
              </div>
              
              <div className="relative z-10 flex flex-col h-full max-h-[85vh] sm:max-h-[80vh]">
                <div className="flex-1 overflow-y-auto scrollbar-hide p-3 sm:p-4 md:p-6">
            
                            {/* Step 1: Reason Selection */}
                {cancelStep === 'reason' && (
                  <>
                    <AlertDialogHeader className="text-center pb-4 sm:pb-6">
                      <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-red-500 to-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                        <AlertTriangle className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
                      </div>
                      <AlertDialogTitle className="text-xl sm:text-2xl lg:text-3xl mb-3 sm:mb-4 font-bold bg-gradient-to-r from-white to-gray-200 bg-clip-text text-transparent">
                        Why do you wish to quit your journey with us?
                      </AlertDialogTitle>
                      <AlertDialogDescription className="text-center text-sm sm:text-base lg:text-lg text-gray-300 leading-relaxed">
                        Please tell us the reason before we continue.
                        <br className="hidden sm:block" />
                        <span className="sm:hidden"> </span>
                        We can help with many situations.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    
                    <div className="space-y-2 sm:space-y-3 py-4 sm:py-6 px-1 sm:px-2">
                      {[
                        { id: 'nevermind', label: 'Never mind, I decided to stay' },
                        { id: 'time', label: "I don't have Enough Time" },
                        { id: 'afford', label: "I can't afford it" },
                        { id: 'ready', label: "I'm not ready yet" },
                        { id: 'money', label: 'I already Make money' },
                        { id: 'unknown', label: "I don't know what to do" }
                      ].map((reason, index) => (
                        <button
                          key={reason.id}
                          onClick={() => setSelectedReason(reason.id)}
                          className={`w-full p-3 sm:p-4 text-left rounded-xl border-2 transition-all duration-200 transform hover:scale-[1.02] ${
                            selectedReason === reason.id
                              ? 'border-blue-400 bg-gradient-to-r from-blue-500/20 to-blue-600/20 shadow-lg shadow-blue-400/20'
                              : 'border-gray-600/50 bg-gray-700/30 hover:bg-gray-600/40 hover:border-gray-500/70'
                          }`}
                        >
                          <div className="flex items-center gap-3 sm:gap-4">
                            <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full border-2 flex items-center justify-center font-bold text-xs sm:text-sm transition-colors ${
                              selectedReason === reason.id
                                ? 'border-blue-400 bg-blue-500 text-white shadow-lg'
                                : 'border-gray-400 text-gray-400 bg-gray-700/50'
                            }`}>
                              {String.fromCharCode(65 + index)}
                            </div>
                            <span className="text-sm sm:text-base font-medium text-white leading-tight">{reason.label}</span>
                          </div>
                        </button>
                      ))}
                    </div>

                    <div className="flex-shrink-0 border-t border-gray-600/30 bg-gray-800/50 px-4 sm:px-6 py-4 sm:py-5">
                      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                        <AlertDialogCancel className="flex-1 h-11 sm:h-12 text-sm sm:text-base bg-gray-700/50 hover:bg-gray-600/70 border-gray-600/50 text-white font-medium rounded-xl transition-all duration-200">
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
                          className="flex-1 h-11 sm:h-12 text-sm sm:text-base bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl shadow-lg transition-all duration-200"
                        >
                          NEXT →
                        </Button>
                      </div>
                    </div>
                  </>
                )}

            {/* Step 2: Confirmation Screen */}
            {cancelStep === 'confirmation' && (
              <>
                {selectedReason === 'money' ? (
                  // Custom message for "I already make money"
                  <>
                    <AlertDialogHeader className="text-center pb-4 sm:pb-6">
                      <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-red-500 to-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                        <DollarSign className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
                      </div>
                      <AlertDialogTitle className="text-lg sm:text-xl lg:text-2xl mb-3 sm:mb-4 font-bold bg-gradient-to-r from-red-400 to-red-300 bg-clip-text text-transparent">
                        Hold Up...
                      </AlertDialogTitle>
                    </AlertDialogHeader>
                    
                    <div className="py-4 px-2 sm:px-4">
                      <div className="bg-gradient-to-br from-red-500/10 to-red-600/10 backdrop-blur-sm rounded-2xl p-4 sm:p-6 border border-red-400/20 space-y-3 sm:space-y-4">
                        <p className="text-center text-xs sm:text-sm lg:text-base font-semibold text-white">
                          If you already make money, then why the hell did you sign up in the first place?
                        </p>
                        <p className="text-center text-xs sm:text-sm lg:text-base text-gray-300 leading-relaxed">
                          Let&apos;s be real — people who are actually winning don&apos;t cancel a service designed to help them win more.
                        </p>
                        <p className="text-center text-xs sm:text-sm lg:text-base text-gray-300 leading-relaxed">
                          You didn&apos;t join because you needed charity — you joined because you knew something was missing.
                          Now you&apos;re quitting and hiding behind the &apos;I&apos;m good now&apos; excuse? Nah. That&apos;s not it.
                        </p>
                        <p className="text-center text-xs sm:text-sm lg:text-base font-semibold text-red-400">
                          This isn&apos;t about money. It&apos;s about mindset. And right now, yours is slipping.
                        </p>
                        <div className="text-center bg-blue-500/10 p-3 rounded-xl border border-blue-400/20">
                          <p className="text-blue-400 font-medium text-sm sm:text-base">
                            Hit 'Go Back' if you're not ready to settle for average.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex-shrink-0 border-t border-gray-600/30 bg-gray-800/50 px-4 sm:px-6 py-4 sm:py-5">
                      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                        <Button 
                          onClick={() => setCancelStep('reason')}
                          variant="outline"
                          className="flex-1 h-11 sm:h-12 text-sm sm:text-base bg-blue-500/10 border-blue-400/50 text-blue-400 hover:bg-blue-500/20 font-medium rounded-xl transition-all duration-200"
                        >
                          ← Go Back
                        </Button>
                        <Button 
                          onClick={() => setCancelStep('intermediate')}
                          className="flex-1 h-11 sm:h-12 text-sm sm:text-base bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold rounded-xl shadow-lg transition-all duration-200"
                        >
                          Continue Anyway
                        </Button>
                      </div>
                    </div>
                  </>
                  ) : selectedReason === 'time' ? (
                    // Custom message for "I don't have enough time"
                    <>
                      <AlertDialogHeader className="text-center pb-4 sm:pb-6">
                        <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                          <Clock className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
                        </div>
                        <AlertDialogTitle className="text-lg sm:text-xl lg:text-2xl mb-3 sm:mb-4 font-bold bg-gradient-to-r from-blue-400 to-blue-300 bg-clip-text text-transparent">
                          ⏱ Good news — you don't need much time at all.
                        </AlertDialogTitle>
                      </AlertDialogHeader>
                      
                      <div className="py-4 px-2 sm:px-4">
                        <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/10 backdrop-blur-sm rounded-2xl p-4 sm:p-6 border border-blue-400/20 space-y-3 sm:space-y-4">
                          <p className="text-center text-xs sm:text-sm lg:text-base text-gray-300 leading-relaxed">
                            This isn't day trading. These are swing trades built specifically for people with full-time jobs.
                          </p>
                          <p className="text-center text-xs sm:text-sm lg:text-base text-gray-300 leading-relaxed">
                            Most members spend just <strong className="text-blue-400">5–15 minutes a month</strong> copying alerts — and even if you're a little late to enter, it's fine. We look for big moves and often hold positions for weeks or even months.
                          </p>
                          <p className="text-center text-xs sm:text-sm lg:text-base text-gray-300 leading-relaxed">
                            You get exact entries, exits, and updates. No overthinking. No screen-watching.
                          </p>
                          <p className="text-center text-xs sm:text-sm lg:text-base font-semibold text-white">
                            Truth is, saying "I don't have time" is just an excuse. Even Elon Musk could make time for this.
                          </p>
                          <div className="text-center bg-blue-500/10 p-3 rounded-xl border border-blue-400/20">
                            <p className="text-blue-400 font-medium text-sm sm:text-base">
                              🔁 Want to give it another shot?
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex-shrink-0 border-t border-gray-600/30 bg-gray-800/50 px-4 sm:px-6 py-4 sm:py-5">
                        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                          <Button 
                            onClick={() => setCancelStep('reason')}
                            variant="outline"
                            className="flex-1 h-11 sm:h-12 text-sm sm:text-base bg-blue-500/10 border-blue-400/50 text-blue-400 hover:bg-blue-500/20 font-medium rounded-xl transition-all duration-200"
                          >
                            Give it another shot
                          </Button>
                          <Button 
                            onClick={() => setCancelStep('intermediate')}
                            className="flex-1 h-11 sm:h-12 text-sm sm:text-base bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold rounded-xl shadow-lg transition-all duration-200"
                          >
                            Continue Anyway
                          </Button>
                        </div>
                      </div>
                    </>
                  ) : selectedReason === 'ready' ? (
                  // Custom message for "I'm not ready yet"
                  <>
                    <AlertDialogHeader className="text-center pb-4 sm:pb-6">
                      <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                        <AlertTriangle className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
                      </div>
                      <AlertDialogTitle className="text-lg sm:text-xl lg:text-2xl mb-3 sm:mb-4 font-bold bg-gradient-to-r from-orange-400 to-orange-300 bg-clip-text text-transparent">
                        Let's be real...
                      </AlertDialogTitle>
                    </AlertDialogHeader>
                    
                    <div className="py-4 px-2 sm:px-4">
                      <div className="bg-gradient-to-br from-orange-500/10 to-orange-600/10 backdrop-blur-sm rounded-2xl p-4 sm:p-6 border border-orange-400/20 space-y-3 sm:space-y-4">
                        <p className="text-center text-xs sm:text-sm lg:text-base font-semibold text-white">
                          Let me be real with you — 'I'm not ready yet' is just another excuse.
                        </p>
                        <p className="text-center text-xs sm:text-sm lg:text-base text-gray-300 leading-relaxed">
                          This isn't rocket science. You're not building a business from scratch — you're getting trade alerts.
                        </p>
                        <p className="text-center text-xs sm:text-sm lg:text-base text-gray-300 leading-relaxed">
                          If you don't know how to use them, we've got tutorial videos that walk you through everything step-by-step.
                        </p>
                        <p className="text-center text-xs sm:text-sm lg:text-base font-semibold text-white">
                          You don't need to be 'ready.' You just need to stop hesitating.
                        </p>
                        <p className="text-center text-xs sm:text-sm lg:text-base text-gray-300 leading-relaxed">
                          Most people who say this stay stuck for years… or forever.
                        </p>
                        <div className="text-center bg-blue-500/10 p-3 rounded-xl border border-blue-400/20">
                          <p className="text-blue-400 font-medium text-sm sm:text-base">
                            Hit 'Go Back' if you're done quitting on yourself.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex-shrink-0 border-t border-gray-600/30 bg-gray-800/50 px-4 sm:px-6 py-4 sm:py-5">
                      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                        <Button 
                          onClick={() => setCancelStep('reason')}
                          variant="outline"
                          className="flex-1 h-11 sm:h-12 text-sm sm:text-base bg-blue-500/10 border-blue-400/50 text-blue-400 hover:bg-blue-500/20 font-medium rounded-xl transition-all duration-200"
                        >
                          ← Go Back
                        </Button>
                        <Button 
                          onClick={() => setCancelStep('intermediate')}
                          className="flex-1 h-11 sm:h-12 text-sm sm:text-base bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold rounded-xl shadow-lg transition-all duration-200"
                        >
                          Continue Anyway
                        </Button>
                      </div>
                    </div>
                  </>
                ) : selectedReason === 'unknown' ? (
                  // Custom message for "I don't know what to do"
                  <>
                    <AlertDialogHeader className="text-center pb-4 sm:pb-6">
                      <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                        <Shield className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
                      </div>
                      <AlertDialogTitle className="text-lg sm:text-xl lg:text-2xl mb-3 sm:mb-4 font-bold bg-gradient-to-r from-purple-400 to-purple-300 bg-clip-text text-transparent">
                        That's exactly why you should stay!
                      </AlertDialogTitle>
                    </AlertDialogHeader>
                    
                    <div className="py-4 px-2 sm:px-4">
                      <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/10 backdrop-blur-sm rounded-2xl p-4 sm:p-6 border border-purple-400/20 space-y-3 sm:space-y-4">
                        <p className="text-center text-xs sm:text-sm lg:text-base font-semibold text-white">
                          Saying 'I don't know what to do' is exactly why you shouldn't quit.
                        </p>
                        <p className="text-center text-xs sm:text-sm lg:text-base text-gray-300 leading-relaxed">
                          We literally made this foolproof — just click the <strong className="text-purple-400">#start-here</strong> section and follow the steps. That's it.
                        </p>
                        <p className="text-center text-xs sm:text-sm lg:text-base text-gray-300 leading-relaxed">
                          It explains exactly how to use the alerts, how to get help, and how to get results — step by step.
                        </p>
                        <p className="text-center text-xs sm:text-sm lg:text-base font-semibold text-white">
                          You don't need to figure anything out. You just need to follow instructions.
                        </p>
                        <p className="text-center text-xs sm:text-sm lg:text-base text-gray-300 leading-relaxed">
                          Don't give up before even starting.
                        </p>
                        <div className="text-center bg-blue-500/10 p-3 rounded-xl border border-blue-400/20">
                          <p className="text-blue-400 font-medium text-sm sm:text-base">
                            Hit 'Go Back' — I'll walk with you the whole way.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex-shrink-0 border-t border-gray-600/30 bg-gray-800/50 px-4 sm:px-6 py-4 sm:py-5">
                      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                        <Button 
                          onClick={() => setCancelStep('reason')}
                          variant="outline"
                          className="flex-1 h-11 sm:h-12 text-sm sm:text-base bg-blue-500/10 border-blue-400/50 text-blue-400 hover:bg-blue-500/20 font-medium rounded-xl transition-all duration-200"
                        >
                          ← Go Back
                        </Button>
                        <Button 
                          onClick={() => setCancelStep('intermediate')}
                          className="flex-1 h-11 sm:h-12 text-sm sm:text-base bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold rounded-xl shadow-lg transition-all duration-200"
                        >
                          Continue Anyway
                        </Button>
                      </div>
                    </div>
                  </>
                ) : (
                  // Default message for other reasons (I can't afford it)
                  <>
                    <AlertDialogHeader className="text-center pb-4 sm:pb-6">
                      <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-gray-500 to-gray-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                        <DollarSign className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
                      </div>
                      <AlertDialogTitle className="text-lg sm:text-xl lg:text-2xl mb-3 sm:mb-4 font-bold bg-gradient-to-r from-white to-gray-200 bg-clip-text text-transparent">
                        We understand your concern
                      </AlertDialogTitle>
                      <AlertDialogDescription className="text-center text-sm sm:text-base text-gray-300">
                        Thank you for your feedback. We'll take this into consideration for future improvements.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    
                    <div className="py-6 sm:py-8">
                      {/* Blank space as requested */}
                    </div>

                    <div className="flex-shrink-0 border-t border-gray-600/30 bg-gray-800/50 px-4 sm:px-6 py-4 sm:py-5">
                      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                        <Button 
                          onClick={() => setCancelStep('reason')}
                          variant="outline"
                          className="flex-1 h-11 sm:h-12 text-sm sm:text-base bg-gray-700/50 hover:bg-gray-600/70 border-gray-600/50 text-white font-medium rounded-xl transition-all duration-200"
                        >
                          ← Back
                        </Button>
                        <Button 
                          onClick={() => setCancelStep('intermediate')}
                          className="flex-1 h-11 sm:h-12 text-sm sm:text-base bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold rounded-xl shadow-lg transition-all duration-200"
                        >
                          Continue
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </>
            )}

                {/* Step 3: Intermediate Screen - Price Negotiation */}
                {cancelStep === 'intermediate' && (
                  <>
                    <AlertDialogHeader className="text-center pb-4 sm:pb-6">
                      <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                        <DollarSign className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
                      </div>
                      <AlertDialogTitle className="text-lg sm:text-xl lg:text-2xl mb-3 sm:mb-4 font-bold bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">
                        💰 Wait, let's find a price that works
                      </AlertDialogTitle>
                      <AlertDialogDescription className="text-center text-sm sm:text-base lg:text-lg text-gray-300 leading-relaxed">
                        Hey, is there a price that you would be able to afford and would work for you long term?
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    
                    <div className="py-4 sm:py-6 px-2 sm:px-4">
                      <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 backdrop-blur-sm rounded-2xl p-4 sm:p-6 border border-blue-400/20 hover:border-blue-400/40 transition-all duration-300">
                        <div className="space-y-4 sm:space-y-6">
                          <Label htmlFor="price-input" className="text-sm sm:text-base lg:text-lg font-semibold text-center block text-white">
                            What price would work for you? (per month)
                          </Label>
                          <div className="flex items-center justify-center space-x-2 sm:space-x-3">
                            <span className="text-2xl sm:text-3xl font-bold text-green-400">$</span>
                            <Input
                              id="price-input"
                              type="number"
                              min="1"
                              step="0.01"
                              value={priceInput}
                              onChange={(e) => setPriceInput(e.target.value)}
                              placeholder="0.00"
                              className="text-center text-lg sm:text-2xl font-bold h-12 sm:h-16 w-24 sm:w-32 border-2 border-green-400/50 focus:border-green-400 rounded-xl bg-gray-800/50 text-white"
                            />
                          </div>
                          <p className="text-center text-xs sm:text-sm text-gray-400 leading-relaxed">
                            Enter any amount you feel comfortable paying monthly
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex-shrink-0 border-t border-gray-600/30 bg-gray-800/50 px-4 sm:px-6 py-4 sm:py-5">
                      <div className="flex flex-col gap-3">
                        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                          <Button 
                            onClick={() => setCancelStep('confirmation')} 
                            variant="outline"
                            className="flex-1 h-11 sm:h-12 text-sm sm:text-base bg-gray-700/50 hover:bg-gray-600/70 border-gray-600/50 text-white font-medium rounded-xl transition-all duration-200"
                          >
                            ← Back
                          </Button>
                          <Button 
                            onClick={handlePriceSubmit}
                            disabled={!priceInput.trim()}
                            className="flex-1 h-11 sm:h-12 text-sm sm:text-base bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl shadow-lg transition-all duration-200"
                          >
                            ✨ Submit Price
                          </Button>
                        </div>
                        <Button 
                          onClick={handleFinalOffer}
                          variant="outline"
                          className="w-full h-11 sm:h-12 text-sm sm:text-base border-2 border-red-500/50 text-red-400 hover:bg-red-500/10 rounded-xl font-medium bg-gray-800/50 transition-all duration-200"
                        >
                          NO, continue to cancel
                        </Button>
                      </div>
                    </div>
                  </>
                )}

            {/* Step 4: Authentication */}
            {cancelStep === 'auth' && (
              <>
                <AlertDialogHeader className="text-center pb-4 sm:pb-6">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-red-500 to-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <AlertTriangle className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
                  </div>
                  <AlertDialogTitle className="text-lg sm:text-xl lg:text-2xl mb-3 sm:mb-4 font-bold bg-gradient-to-r from-red-400 to-red-300 bg-clip-text text-transparent">
                    Disable Auto-Renewal?
                  </AlertDialogTitle>
                  <AlertDialogDescription className="text-center mt-4">
                    <div className="space-y-3 sm:space-y-4">
                      <p className="text-sm sm:text-base lg:text-lg text-gray-300">
                        This will disable auto-renewal for your subscription. Here's what happens:
                      </p>
                      <div className="bg-gray-700/30 backdrop-blur-sm rounded-xl p-4 sm:p-6 border border-gray-600/30">
                        <ul className="space-y-2 sm:space-y-3 text-left">
                          <li className="flex items-start gap-2">
                            <span className="text-green-400">✅</span>
                            <span className="text-xs sm:text-sm text-gray-300">Your subscription stays <strong className="text-white">active</strong> until {subscription?.stripe?.currentPeriodEnd 
                              ? new Date(subscription.stripe.currentPeriodEnd).toLocaleDateString()
                              : new Date(subscription.subscriptionEnd).toLocaleDateString()}</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-green-400">✅</span>
                            <span className="text-xs sm:text-sm text-gray-300">You keep all premium features until then</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-blue-400">🔄</span>
                            <span className="text-xs sm:text-sm text-gray-300"><strong className="text-white">You can re-enable auto-renewal anytime</strong> before expiration</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-orange-400">⏹️</span>
                            <span className="text-xs sm:text-sm text-gray-300">Only expires if auto-renewal stays disabled</span>
                          </li>
                        </ul>
                      </div>
                      <div className="bg-blue-500/10 p-3 sm:p-4 rounded-xl border border-blue-400/20">
                        <p className="text-blue-300 text-xs sm:text-sm">
                          💡 <strong>Pro Tip:</strong> This is reversible! Simply toggle auto-renewal back on to resume normal billing.
                        </p>
                      </div>
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                
                <div className="space-y-3 sm:space-y-4 py-4 sm:py-6 px-2 sm:px-4">
                  <Label htmlFor="cancel-password" className="text-sm sm:text-base lg:text-lg font-semibold text-white">
                    Enter your password to confirm:
                  </Label>
                  <Input
                    id="cancel-password"
                    type="password"
                    value={cancelPassword}
                    onChange={(e) => setCancelPassword(e.target.value)}
                    placeholder="Your account password"
                    className="h-10 sm:h-12 text-sm sm:text-base border-2 border-red-400/50 focus:border-red-400 rounded-xl bg-gray-800/50 text-white"
                  />
                </div>
                
                <div className="flex-shrink-0 border-t border-gray-600/30 bg-gray-800/50 px-4 sm:px-6 py-4 sm:py-5">
                  <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                    <Button 
                      onClick={() => {
                        setCancelPassword('');
                        setCancelStep('intermediate');
                      }}
                      variant="outline"
                      className="flex-1 h-11 sm:h-12 text-sm sm:text-base bg-gray-700/50 hover:bg-gray-600/70 border-gray-600/50 text-white font-medium rounded-xl transition-all duration-200"
                    >
                      ← Back
                    </Button>
                    <Button
                      onClick={handleCancelSubscription}
                      disabled={isCancelling || !cancelPassword.trim()}
                      className="flex-1 h-11 sm:h-12 text-sm sm:text-base bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-semibold transition-all duration-200"
                    >
                      {isCancelling ? (
                        <>
                          <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin mr-2" />
                          Disabling...
                        </>
                      ) : (
                        'Disable Auto-Renewal'
                      )}
                    </Button>
                  </div>
                </div>
                </>
              )}
                </div>
              </div>
            </AlertDialogContent>
          </AlertDialog>

          {/* Price Offer Modal */}
          <AlertDialog open={showOfferModal} onOpenChange={setShowOfferModal}>
            <AlertDialogContent className="!fixed !left-1/2 !top-1/2 !-translate-x-1/2 !-translate-y-1/2 w-[95vw] sm:w-[85vw] md:w-[75vw] lg:w-[65vw] xl:w-[55vw] max-w-2xl max-h-[85vh] sm:max-h-[80vh] bg-gradient-to-br from-gray-800/95 via-gray-800/90 to-gray-900/95 backdrop-blur-xl border border-gray-600/30 rounded-2xl shadow-2xl">
              
              {/* Animated Background Effects */}
              <div className="absolute inset-0 overflow-hidden rounded-2xl">
                <div className="absolute -top-10 -right-10 w-20 h-20 bg-green-500/10 rounded-full blur-xl animate-pulse"></div>
                <div className="absolute bottom-0 -left-10 w-16 h-16 bg-emerald-500/10 rounded-full blur-xl animate-pulse delay-1000"></div>
              </div>
              
              <div className="relative z-10 flex flex-col h-full max-h-[85vh] sm:max-h-[80vh]">
                <div className="flex-1 overflow-y-auto scrollbar-hide p-3 sm:p-4 md:p-6">
                <AlertDialogHeader className="text-center pb-4 sm:pb-6">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <Lock className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
                  </div>
                  <AlertDialogTitle className="text-lg sm:text-xl lg:text-2xl mb-3 sm:mb-4 font-bold bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
                    🔒 ONE TIME OFFER
                  </AlertDialogTitle>
                  <AlertDialogDescription className="text-center text-xs sm:text-sm lg:text-base text-gray-300 leading-relaxed">
                    Hey — we've got a 🔒 ONE TIME OFFER for you: <strong className="text-green-400">${currentOffer}/month</strong>, locked in for life as long as you stay subscribed{currentOffer === 19.99 ? ' and this is the LOWEST offer we have!' : currentOffer === 15 ? '.' : ' and this is the LOWEST offer we have!'}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                
                <div className="py-4 sm:py-6">
                  <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 backdrop-blur-sm rounded-2xl p-4 sm:p-6 border-2 border-green-400/30 text-center hover:border-green-400/50 transition-all duration-300">
                    <div className="text-3xl sm:text-4xl lg:text-5xl font-bold text-green-400 mb-3 sm:mb-4">
                      ${currentOffer}/month
                    </div>
                    <div className="flex flex-col sm:flex-row items-center justify-center space-y-2 sm:space-y-0 sm:space-x-4 text-xs sm:text-sm text-gray-300">
                      <span className="flex items-center bg-green-500/10 px-3 py-1 rounded-full border border-green-400/20">
                        🔒 <span className="ml-1">Locked in for life</span>
                      </span>
                      <span className="hidden sm:block text-gray-500">•</span>
                      <span className="flex items-center bg-green-500/10 px-3 py-1 rounded-full border border-green-400/20">
                        📈 <span className="ml-1">No price increases ever</span>
                      </span>
                    </div>
                  </div>
                </div>

                </div>
                <div className="flex-shrink-0 border-t border-gray-600/30 bg-gray-800/50 px-4 sm:px-6 py-4 sm:py-5">
                  <div className="flex flex-col gap-3">
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
                      className="w-full h-12 sm:h-14 lg:h-16 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm sm:text-lg lg:text-xl font-bold rounded-xl shadow-lg transition-all duration-200"
                    >
                      {isApplyingCoupon ? (
                        <>
                          <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin mr-2" />
                          Applying Discount...
                        </>
                      ) : (
                        '✅ ACCEPT THIS OFFER'
                      )}
                    </Button>
                    <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                      <Button 
                        onClick={() => {
                          setShowOfferModal(false);
                          setCancelStep('intermediate');
                        }}
                        variant="outline"
                        className="flex-1 h-11 sm:h-12 text-sm sm:text-base bg-gray-700/50 hover:bg-gray-600/70 border-gray-600/50 text-white font-medium rounded-xl transition-all duration-200"
                      >
                        ← Back
                      </Button>
                      <Button 
                        onClick={() => {
                          setShowOfferModal(false);
                          setCancelStep('auth');
                        }}
                        variant="outline"
                        className="flex-1 h-11 sm:h-12 text-sm sm:text-base border-2 border-red-500/50 text-red-400 hover:bg-red-500/10 rounded-xl bg-gray-800/50 font-medium transition-all duration-200"
                      >
                        Continue to cancel
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </AlertDialogContent>
          </AlertDialog>

          {/* Final Offer Modal */}
          <AlertDialog open={showFinalOffer} onOpenChange={setShowFinalOffer}>
            <AlertDialogContent className="!fixed !left-1/2 !top-1/2 !-translate-x-1/2 !-translate-y-1/2 w-[95vw] sm:w-[85vw] md:w-[75vw] lg:w-[65vw] xl:w-[55vw] max-w-2xl max-h-[85vh] sm:max-h-[80vh] bg-gradient-to-br from-gray-800/95 via-gray-800/90 to-gray-900/95 backdrop-blur-xl border border-gray-600/30 rounded-2xl shadow-2xl">
              
              {/* Animated Background Effects */}
              <div className="absolute inset-0 overflow-hidden rounded-2xl">
                <div className="absolute -top-10 -right-10 w-20 h-20 bg-red-500/10 rounded-full blur-xl animate-pulse"></div>
                <div className="absolute bottom-0 -left-10 w-16 h-16 bg-orange-500/10 rounded-full blur-xl animate-pulse delay-1000"></div>
              </div>
              
              <div className="relative z-10 flex flex-col h-full max-h-[85vh] sm:max-h-[80vh]">
                <div className="flex-1 overflow-y-auto scrollbar-hide p-3 sm:p-4 md:p-6">
                <AlertDialogHeader className="text-center pb-4 sm:pb-6">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-red-500 to-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <AlertTriangle className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
                  </div>
                  <AlertDialogTitle className="text-lg sm:text-xl lg:text-2xl mb-3 sm:mb-4 font-bold bg-gradient-to-r from-red-400 to-red-300 bg-clip-text text-transparent">
                    🚨 LAST OFFER — $19.99/Month
                  </AlertDialogTitle>
                  <AlertDialogDescription className="text-center text-xs sm:text-sm lg:text-base text-gray-300 leading-relaxed">
                    This is the absolute lowest price we'll ever offer. No games. No second chances.
                    <br className="hidden sm:block" /><br className="hidden sm:block" />
                    <span className="sm:hidden"> </span>
                    It's a one-time deal — take it or leave it.
                    <br className="hidden sm:block" />
                    <span className="sm:hidden"> </span>
                    But just know: <strong className="text-red-400">you will never see a discount again. Period.</strong>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                
                <div className="py-4 sm:py-6">
                  <div className="bg-gradient-to-br from-red-500/10 to-orange-500/10 backdrop-blur-sm rounded-2xl p-4 sm:p-6 border-2 border-red-400/30 text-center hover:border-red-400/50 transition-all duration-300">
                    <div className="text-3xl sm:text-4xl lg:text-5xl font-bold text-red-400 mb-3 sm:mb-4">
                      $19.99/month
                    </div>
                    <div className="flex flex-col sm:flex-row items-center justify-center space-y-2 sm:space-y-0 sm:space-x-4 text-xs sm:text-sm text-gray-300">
                      <span className="flex items-center bg-red-500/10 px-3 py-1 rounded-full border border-red-400/20">
                        ⚡ <span className="ml-1">Final offer</span>
                      </span>
                      <span className="hidden sm:block text-gray-500">•</span>
                      <span className="flex items-center bg-red-500/10 px-3 py-1 rounded-full border border-red-400/20">
                        🔒 <span className="ml-1">Locked in for life</span>
                      </span>
                    </div>
                  </div>
                </div>

                </div>
                <div className="flex-shrink-0 border-t border-gray-600/30 bg-gray-800/50 px-4 sm:px-6 py-4 sm:py-5">
                  <div className="flex flex-col gap-3">
                    <Button 
                      onClick={async () => {
                        const success = await createAndApplyCoupon(19.99);
                        if (success) {
                          setShowFinalOffer(false);
                          setShowCancelDialog(false);
                        }
                      }}
                      disabled={isApplyingCoupon}
                      className="w-full h-12 sm:h-14 lg:h-16 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm sm:text-lg lg:text-xl font-bold rounded-xl shadow-lg transition-all duration-200"
                    >
                      {isApplyingCoupon ? (
                        <>
                          <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin mr-2" />
                          Applying Discount...
                        </>
                      ) : (
                        '✅ TAKE THE DEAL'
                      )}
                    </Button>
                    <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                      <Button 
                        onClick={() => {
                          setShowFinalOffer(false);
                          setCancelStep('intermediate');
                        }}
                        variant="outline"
                        className="flex-1 h-11 sm:h-12 text-sm sm:text-base bg-gray-700/50 hover:bg-gray-600/70 border-gray-600/50 text-white font-medium rounded-xl transition-all duration-200"
                      >
                        ← Back
                      </Button>
                      <Button 
                        onClick={handleImmediateCancel}
                        variant="outline"
                        className="flex-1 h-11 sm:h-12 text-sm sm:text-base border-2 border-gray-500/50 text-gray-400 hover:bg-gray-500/10 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl bg-gray-800/50 font-medium transition-all duration-200"
                        disabled={isCancelling}
                      >
                        {isCancelling ? (
                          <>
                            <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin mr-2" />
                            Cancelling...
                          </>
                        ) : (
                          'Cancel my subscription'
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </AlertDialogContent>
          </AlertDialog>

        {/* Customer Information */}
        {subscription.customer && (
          <div className="space-y-3">
            <h4 className="font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Billing Account
            </h4>
            <div className="text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-300">Customer ID:</span>
                <span className="font-mono text-xs">{subscription.customer.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-300">Account Created:</span>
                <span>{new Date(subscription.customer.created).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
                  )}
      </CardContent>
    </Card>
  </div>
  );
} 
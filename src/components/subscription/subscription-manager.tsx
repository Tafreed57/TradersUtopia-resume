"use client";

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
  EyeOff
} from 'lucide-react';
import { showToast } from '@/lib/notifications';
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
    currency: string;
    interval: string;
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
  const [cancelStep, setCancelStep] = useState<'reason' | 'confirmation' | 'auth'>('reason');
  const [selectedReason, setSelectedReason] = useState<string>('');

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
      ACTIVE: { color: 'default', icon: CheckCircle, text: 'Active' },
      CANCELLED: { color: 'destructive', icon: XCircle, text: 'Cancelled' },
      EXPIRED: { color: 'secondary', icon: XCircle, text: 'Expired' },
      FREE: { color: 'secondary', icon: Shield, text: 'Free' },
    } as const;

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.FREE;
    const Icon = config.icon;

    return (
      <Badge variant={config.color} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {config.text}
      </Badge>
    );
  };

  useEffect(() => {
    if (user) {
      fetchSubscriptionDetails();
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
        <CardContent className="flex items-center justify-center py-6">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
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
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Subscription
          </CardTitle>
          <CardDescription>No subscription found</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  console.log('✅ SubscriptionManager: Rendering subscription UI for', subscription.status, 'subscription');

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            <CardTitle>Subscription</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {getStatusBadge(subscription.status)}
            <Button
              variant="outline"
              size="sm"
              onClick={refreshAndSync}
              disabled={isLoading}
              title="Refresh & sync with Stripe"
              className="flex items-center gap-1.5"
            >
              {isLoading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
              Refresh
            </Button>
          </div>
        </div>
        <CardDescription>
          Manage your subscription and billing preferences
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Product Information */}
        {subscription.product && (
          <div className="space-y-3">
            <h4 className="font-medium flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Current Plan
            </h4>
            <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h5 className="font-semibold">{subscription.product.name}</h5>
                  {subscription.product.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                      {subscription.product.description}
                    </p>
                  )}
                </div>
                {subscription.stripe?.amount && (
                  <div className="text-right">
                    <div className="text-lg font-bold">
                      {formatCurrency(subscription.stripe.amount, subscription.stripe.currency)}
                    </div>
                    <div className="text-sm text-gray-500">
                      per {subscription.stripe.interval}
                    </div>
                  </div>
                )}
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
          }
        }}>
          <AlertDialogContent className="max-w-md">
            
            {/* Step 1: Reason Selection */}
            {cancelStep === 'reason' && (
              <>
                <AlertDialogHeader className="text-center">
                  <AlertDialogTitle className="text-xl mb-2">
                    Why do you wish to quit your journey with us?
                  </AlertDialogTitle>
                  <AlertDialogDescription className="text-center">
                    Please tell us the reason before we continue.
                    <br />
                    We can help with many situations.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                
                <div className="space-y-3 py-4">
                  {[
                    { id: 'nevermind', label: 'Nevermind, I decided to stay.' },
                    { id: 'time', label: "I don't have enough time" },
                    { id: 'ready', label: "I'm not ready yet" },
                    { id: 'money', label: 'I already make money' },
                    { id: 'unknown', label: "I don't know what to do" }
                  ].map((reason, index) => (
                    <button
                      key={reason.id}
                      onClick={() => setSelectedReason(reason.id)}
                      className={`w-full p-3 text-left rounded-lg border transition-colors ${
                        selectedReason === reason.id
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                          selectedReason === reason.id
                            ? 'border-blue-500 bg-blue-500'
                            : 'border-gray-300'
                        }`}>
                          <span className="text-xs font-bold text-white">
                            {selectedReason === reason.id ? index + 1 : index + 1}
                          </span>
                        </div>
                        <span className="text-sm">{reason.label}</span>
                      </div>
                    </button>
                  ))}
                </div>

                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <Button 
                    onClick={() => {
                      if (selectedReason === 'nevermind') {
                        setShowCancelDialog(false);
                      } else {
                        setCancelStep('confirmation');
                      }
                    }}
                    disabled={!selectedReason}
                    className="bg-orange-500 hover:bg-orange-600 text-white"
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
                    <AlertDialogHeader className="text-center">
                      <AlertDialogTitle className="text-xl mb-2 text-red-600">
                        Hold Up...
                      </AlertDialogTitle>
                    </AlertDialogHeader>
                    
                    <div className="py-4 px-2">
                      <div className="text-center space-y-4 text-sm">
                        <p className="font-semibold">
                          If you already make money, then why the hell did you sign up in the first place?
                        </p>
                        <p>
                          Let's be real — people who are actually winning don't cancel a service designed to help them win more.
                        </p>
                        <p>
                          You didn't join because you needed charity — you joined because you knew something was missing.
                          Now you're quitting and hiding behind the 'I'm good now' excuse? Nah. That's not it.
                        </p>
                        <p className="font-semibold text-red-600">
                          This isn't about money. It's about mindset. And right now, yours is slipping.
                        </p>
                        <p className="text-blue-600 font-medium">
                          Hit 'Go Back' if you're not ready to settle for average.
                        </p>
                      </div>
                    </div>

                    <AlertDialogFooter>
                      <Button 
                        onClick={() => setCancelStep('reason')}
                        variant="outline"
                        className="border-blue-500 text-blue-600 hover:bg-blue-50"
                      >
                        Go Back
                      </Button>
                      <Button 
                        onClick={() => setCancelStep('auth')}
                        className="bg-red-500 hover:bg-red-600 text-white"
                      >
                        Continue Anyway
                      </Button>
                    </AlertDialogFooter>
                  </>
                ) : (
                  // Default message for other reasons
                  <>
                    <AlertDialogHeader className="text-center">
                      <AlertDialogTitle className="text-xl mb-2">
                        We understand your concern
                      </AlertDialogTitle>
                      <AlertDialogDescription className="text-center">
                        Thank you for your feedback. We'll take this into consideration for future improvements.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    
                    <div className="py-8">
                      {/* Blank space as requested */}
                    </div>

                    <AlertDialogFooter>
                      <AlertDialogCancel onClick={() => setCancelStep('reason')}>
                        Back
                      </AlertDialogCancel>
                      <Button 
                        onClick={() => setCancelStep('auth')}
                        className="bg-red-500 hover:bg-red-600 text-white"
                      >
                        Continue
                      </Button>
                    </AlertDialogFooter>
                  </>
                )}
              </>
            )}

            {/* Step 3: Authentication */}
            {cancelStep === 'auth' && (
              <>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                    Disable Auto-Renewal?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    <div className="space-y-3">
                      <p>
                        This will disable auto-renewal for your subscription. Here's what happens:
                      </p>
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        <li>✅ Your subscription stays <strong>active</strong> until {subscription?.stripe?.currentPeriodEnd 
                          ? new Date(subscription.stripe.currentPeriodEnd).toLocaleDateString()
                          : new Date(subscription.subscriptionEnd).toLocaleDateString()}</li>
                        <li>✅ You keep all premium features until then</li>
                        <li>🔄 <strong>You can re-enable auto-renewal anytime</strong> before expiration</li>
                        <li>⏹️ Only expires if auto-renewal stays disabled</li>
                      </ul>
                      <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded border border-blue-200 dark:border-blue-800">
                        <p className="text-sm text-blue-800 dark:text-blue-200">
                          💡 <strong>Pro Tip:</strong> This is reversible! Simply toggle auto-renewal back on to resume normal billing.
                        </p>
                      </div>
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                
                <div className="space-y-3">
              <Label htmlFor="cancel-password">
                Enter your password to confirm:
              </Label>
              <Input
                id="cancel-password"
                type="password"
                value={cancelPassword}
                onChange={(e) => setCancelPassword(e.target.value)}
                placeholder="Your account password"
                className="border-red-200 focus:border-red-400 dark:border-red-800"
              />
            </div>
            
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => {
                setCancelPassword('');
                setCancelStep('confirmation');
              }}>
                Back
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleCancelSubscription}
                disabled={isCancelling || !cancelPassword.trim()}
                className="bg-red-600 hover:bg-red-700"
              >
                {isCancelling ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin mr-2" />
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
  );
} 
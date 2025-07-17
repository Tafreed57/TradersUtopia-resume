'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function SubscriptionStatusPage() {
  const [envStatus, setEnvStatus] = useState<any>(null);
  const [paymentStatus, setPaymentStatus] = useState<any>(null);
  const [stripeDebug, setStripeDebug] = useState<any>(null);
  const [emailDebug, setEmailDebug] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);
  const [debugLoading, setDebugLoading] = useState(false);
  const [emailDebugLoading, setEmailDebugLoading] = useState(false);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        // Environment check removed for production
        setEnvStatus({ message: 'Environment check disabled in production' });

        // Check payment status
        const paymentResponse = await fetch('/api/check-payment-status');
        const paymentData = await paymentResponse.json();
        setPaymentStatus(paymentData);
      } catch (error) {
        console.error('Error checking status:', error);
      } finally {
        setLoading(false);
      }
    };

    checkStatus();
  }, []);

  const verifyStripePayment = async () => {
    setActivating(true);
    try {
      const response = await fetch('/api/verify-stripe-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (response.ok && result.success) {
        alert(`✅ ${result.message}`);
        // Refresh the page
        window.location.reload();
      } else {
        alert(`❌ ${result.message || result.error}`);
      }
    } catch (error) {
      console.error('Error verifying payment:', error);
      alert('❌ Error verifying payment with Stripe');
    } finally {
      setActivating(false);
    }
  };

  const debugStripeData = async () => {
    setDebugLoading(true);
    try {
      const response = await fetch('/api/debug-stripe');
      const data = await response.json();
      setStripeDebug(data);
    } catch (error) {
      console.error('Error fetching Stripe debug data:', error);
    } finally {
      setDebugLoading(false);
    }
  };

  const debugEmails = async () => {
    setEmailDebugLoading(true);
    try {
      const response = await fetch('/api/debug-emails');
      const data = await response.json();
      setEmailDebug(data);
    } catch (error) {
      console.error('Error fetching email debug data:', error);
    } finally {
      setEmailDebugLoading(false);
    }
  };

  if (loading) {
    return (
      <div className='container mx-auto p-6'>
        <div className='flex items-center justify-center'>
          <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-primary'></div>
        </div>
      </div>
    );
  }

  return (
    <div className='min-h-screen pwa-layout safe-min-height bg-gray-50 dark:bg-gray-900'>
      <div className='pwa-safe-top pwa-safe-bottom safe-area-inset-left safe-area-inset-right'>
        <div className='container mx-auto p-6 max-w-4xl'>
          <h1 className='text-3xl font-bold mb-6'>Subscription Status</h1>

          <div className='grid gap-6'>
            {/* Environment Check */}
            <Card>
              <CardHeader>
                <CardTitle>Environment Configuration</CardTitle>
                <CardDescription>
                  Checking if all required environment variables are set
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Payment Status */}
            <Card>
              <CardHeader>
                <CardTitle>Current Subscription Status</CardTitle>
                <CardDescription>Your current access status</CardDescription>
              </CardHeader>
              <CardContent>
                {paymentStatus && (
                  <div className='space-y-2'>
                    <p>
                      <strong>Has Access:</strong>
                      <span
                        className={`ml-2 px-2 py-1 rounded text-sm ${
                          paymentStatus.hasAccess
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {paymentStatus.hasAccess ? '✅ YES' : '❌ NO'}
                      </span>
                    </p>
                    <p>
                      <strong>Subscription Status:</strong>{' '}
                      {paymentStatus.subscriptionStatus}
                    </p>
                    <p>
                      <strong>Subscription End:</strong>{' '}
                      {paymentStatus.subscriptionEnd || 'N/A'}
                    </p>
                    <p>
                      <strong>Reason:</strong> {paymentStatus.reason}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Stripe Verification */}
            <Card>
              <CardHeader>
                <CardTitle>Verify Stripe Payment</CardTitle>
                <CardDescription>
                  This will check Stripe to verify if you have actually paid,
                  then grant access automatically.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={verifyStripePayment}
                  disabled={activating}
                  className='bg-blue-600 hover:bg-blue-700'
                  size='lg'
                >
                  {activating
                    ? 'Verifying...'
                    : '🔍 Verify My Payment with Stripe'}
                </Button>

                <div className='mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg'>
                  <h4 className='font-semibold mb-2'>How This Works:</h4>
                  <ol className='list-decimal list-inside text-sm text-gray-600 dark:text-gray-300 space-y-1'>
                    <li>
                      Checks if you exist as a customer in Stripe using your
                      email
                    </li>
                    <li>
                      Verifies you have active subscriptions or successful
                      payments
                    </li>
                    <li>Creates/updates your profile in our database</li>
                    <li>
                      Grants access only if payment is confirmed in Stripe
                    </li>
                  </ol>
                  <p className='text-sm text-gray-600 dark:text-gray-300 mt-2 font-medium'>
                    ✅ This ensures only people who actually paid get access!
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Clerk Test Section */}
            <Card>
              <CardHeader>
                <CardTitle>🔧 Debug: Test Clerk Authentication</CardTitle>
                <CardDescription>
                  First, let&apos;s check if Clerk can access your user data at
                  all
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className='space-y-4'>
                  <div className='p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200'>
                    <p className='text-sm text-blue-700'>
                      🔒 Debug endpoints have been removed for production
                      security. Authentication is handled through secure
                      production endpoints.
                    </p>
                  </div>

                  <div className='p-3 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200'>
                    <p className='text-sm text-blue-700'>
                      <strong>Click the button above first!</strong> This will
                      open a new tab showing your raw Clerk user data. If you
                      see an error or &quot;Not authenticated&quot;, that&apos;s
                      the root problem.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Email Debug Section */}
            <Card>
              <CardHeader>
                <CardTitle>🚨 Debug: Email Mismatch Check</CardTitle>
                <CardDescription>
                  Check if your Clerk email matches any customers in Stripe
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={debugEmails}
                  disabled={emailDebugLoading}
                  variant='outline'
                  size='lg'
                  className='mb-4 bg-red-50 border-red-200 text-red-700 hover:bg-red-100'
                >
                  {emailDebugLoading ? 'Checking...' : '🔍 Check Email Match'}
                </Button>

                {emailDebug && (
                  <div className='mt-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200'>
                    <h4 className='font-semibold mb-3 text-red-800'>
                      Email Comparison Results:
                    </h4>

                    <div className='space-y-4'>
                      <div>
                        <h5 className='font-medium text-red-700'>
                          Your Clerk Account:
                        </h5>
                        <p className='text-sm'>
                          Primary Email:{' '}
                          <strong>
                            {emailDebug.clerkUser?.primaryEmail || 'Not found'}
                          </strong>
                        </p>
                        <p className='text-sm'>
                          All Emails:{' '}
                          {emailDebug.clerkUser?.allEmails?.length > 0
                            ? emailDebug.clerkUser.allEmails.join(', ')
                            : 'None found'}
                        </p>
                        <p className='text-sm'>
                          User ID: {emailDebug.clerkUser?.id || 'Not found'}
                        </p>
                        <p className='text-sm'>
                          Name: {emailDebug.clerkUser?.firstName}{' '}
                          {emailDebug.clerkUser?.lastName}
                        </p>

                        <details className='mt-2'>
                          <summary className='text-xs text-gray-600 cursor-pointer'>
                            Show Raw Debug Data
                          </summary>
                          <pre className='text-xs bg-gray-100 p-2 rounded mt-1 overflow-x-auto'>
                            {JSON.stringify(emailDebug, null, 2)}
                          </pre>
                        </details>
                      </div>

                      <div>
                        <h5 className='font-medium text-red-700'>
                          Stripe Search Results:
                        </h5>
                        {emailDebug.stripeSearchByEmail?.map(
                          (result: any, i: number) => (
                            <div key={i} className='text-sm ml-2'>
                              <p>
                                <strong>{result.searchEmail}:</strong>
                                {result.found ? (
                                  <span className='text-green-600 ml-2'>
                                    ✅ Found {result.customers.length}{' '}
                                    customer(s)
                                  </span>
                                ) : (
                                  <span className='text-red-600 ml-2'>
                                    ❌ No customer found
                                  </span>
                                )}
                              </p>
                              {result.customers?.map(
                                (customer: any, j: number) => (
                                  <p
                                    key={j}
                                    className='text-xs text-gray-600 ml-4'
                                  >
                                    Customer: {customer.email} - {customer.name}{' '}
                                    (ID: {customer.id})
                                  </p>
                                )
                              )}
                            </div>
                          )
                        )}
                      </div>

                      {emailDebug.stripeSearchByName?.length > 0 && (
                        <div>
                          <h5 className='font-medium text-red-700'>
                            Found by Name Search:
                          </h5>
                          {emailDebug.stripeSearchByName.map(
                            (customer: any, i: number) => (
                              <p key={i} className='text-sm ml-2'>
                                <strong>{customer.name}</strong> - Email:{' '}
                                {customer.email} (ID: {customer.id})
                              </p>
                            )
                          )}
                        </div>
                      )}

                      <div className='bg-red-100 dark:bg-red-800/20 p-3 rounded'>
                        <h6 className='font-semibold text-red-800'>
                          Quick Fix:
                        </h6>
                        <p className='text-sm text-red-700'>
                          If you see a Stripe customer above with a different
                          email, that&apos;s the issue! You need to either:
                        </p>
                        <ul className='text-sm text-red-700 list-disc list-inside mt-1'>
                          <li>Add that email to your Clerk account, OR</li>
                          <li>
                            Update your Stripe customer email to match your
                            Clerk email
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Stripe Debug Section */}
            <Card>
              <CardHeader>
                <CardTitle>Debug: What&apos;s in Your Stripe Account</CardTitle>
                <CardDescription>
                  See exactly what data exists in Stripe for your email address
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={debugStripeData}
                  disabled={debugLoading}
                  variant='outline'
                  size='lg'
                  className='mb-4'
                >
                  {debugLoading ? 'Loading...' : '🔍 Show My Stripe Data'}
                </Button>

                {stripeDebug && (
                  <div className='mt-4 p-4 bg-gray-50 dark:bg-gray-900/20 rounded-lg'>
                    <h4 className='font-semibold mb-3'>
                      Stripe Account Summary:
                    </h4>

                    {stripeDebug.customerExists ? (
                      <div className='space-y-4'>
                        <div>
                          <h5 className='font-medium'>Customer Info:</h5>
                          <p className='text-sm'>
                            ID: {stripeDebug.customer.id}
                          </p>
                          <p className='text-sm'>
                            Email: {stripeDebug.customer.email}
                          </p>
                          <p className='text-sm'>
                            Created:{' '}
                            {new Date(
                              stripeDebug.customer.created
                            ).toLocaleDateString()}
                          </p>
                        </div>

                        <div>
                          <h5 className='font-medium'>
                            Subscriptions: {stripeDebug.subscriptions.total}
                          </h5>
                          <p className='text-sm'>
                            Active: {stripeDebug.subscriptions.active}
                          </p>
                          {stripeDebug.subscriptions.data.map(
                            (sub: any, i: number) => (
                              <p key={i} className='text-xs text-gray-600'>
                                {sub.id} - Status: {sub.status}
                              </p>
                            )
                          )}
                        </div>

                        <div>
                          <h5 className='font-medium'>
                            Payment Intents: {stripeDebug.paymentIntents.total}
                          </h5>
                          <p className='text-sm'>
                            Succeeded: {stripeDebug.paymentIntents.succeeded}
                          </p>
                          {stripeDebug.paymentIntents.data.map(
                            (payment: any, i: number) => (
                              <p key={i} className='text-xs text-gray-600'>
                                ${(payment.amount / 100).toFixed(2)} - Status:{' '}
                                {payment.status}
                              </p>
                            )
                          )}
                        </div>

                        <div>
                          <h5 className='font-medium'>
                            Checkout Sessions:{' '}
                            {stripeDebug.checkoutSessions.total}
                          </h5>
                          <p className='text-sm'>
                            Completed: {stripeDebug.checkoutSessions.completed}
                          </p>
                          {stripeDebug.checkoutSessions.data.map(
                            (session: any, i: number) => (
                              <p key={i} className='text-xs text-gray-600'>
                                $
                                {((session.amount_total || 0) / 100).toFixed(2)}{' '}
                                - Status: {session.status} - Payment:{' '}
                                {session.payment_status}
                              </p>
                            )
                          )}
                        </div>

                        <div>
                          <h5 className='font-medium'>
                            Invoices: {stripeDebug.invoices.total}
                          </h5>
                          <p className='text-sm'>
                            Paid: {stripeDebug.invoices.paid}
                          </p>
                          {stripeDebug.invoices.data.map(
                            (invoice: any, i: number) => (
                              <p key={i} className='text-xs text-gray-600'>
                                ${(invoice.amount_paid / 100).toFixed(2)} paid
                                of ${(invoice.amount_due / 100).toFixed(2)} -
                                Status: {invoice.status}
                              </p>
                            )
                          )}
                        </div>
                      </div>
                    ) : (
                      <p className='text-red-600'>
                        ❌ No customer found in Stripe with your email
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

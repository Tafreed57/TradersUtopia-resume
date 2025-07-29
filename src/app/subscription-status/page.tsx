'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

interface SubscriptionStatus {
  hasAccess: boolean;
  subscriptionStatus: string;
  subscriptionEnd?: string;
  reason: string;
  stripeSubscriptionId?: string;
}

export default function SubscriptionStatusPage() {
  const router = useRouter();
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/check-payment-status');
      const data = await response.json();
      setStatus(data);

      // Redirect users with access to servers
      if (data.hasAccess) {
        router.push('/rome');
        return;
      }
    } catch (error) {
      console.error('Error fetching subscription status:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchStatus();
  };

  if (loading) {
    return (
      <div className='container mx-auto p-6'>
        <div className='flex items-center justify-center min-h-[400px]'>
          <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-primary'></div>
        </div>
      </div>
    );
  }

  return (
    <div className='min-h-screen pwa-layout safe-min-height bg-gray-50 dark:bg-gray-900'>
      <div className='pwa-safe-top pwa-safe-bottom safe-area-inset-left safe-area-inset-right'>
        <div className='container mx-auto p-6 max-w-2xl'>
          <h1 className='text-3xl font-bold mb-6'>Subscription Status</h1>

          <Card>
            <CardHeader>
              <CardTitle>Current Status</CardTitle>
              <CardDescription>
                Your subscription and access details
              </CardDescription>
            </CardHeader>
            <CardContent>
              {status ? (
                <div className='space-y-4'>
                  <div className='flex items-center justify-between'>
                    <span className='font-medium'>Access Status:</span>
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-medium ${
                        status.hasAccess
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                          : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                      }`}
                    >
                      {status.hasAccess ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  <div className='flex items-center justify-between'>
                    <span className='font-medium'>Subscription:</span>
                    <span className='text-sm text-gray-600 dark:text-gray-300'>
                      {status.subscriptionStatus}
                    </span>
                  </div>

                  {status.subscriptionEnd && (
                    <div className='flex items-center justify-between'>
                      <span className='font-medium'>Valid Until:</span>
                      <span className='text-sm text-gray-600 dark:text-gray-300'>
                        {new Date(status.subscriptionEnd).toLocaleDateString()}
                      </span>
                    </div>
                  )}

                  <div className='pt-4 border-t'>
                    <p className='text-sm text-gray-600 dark:text-gray-300'>
                      {status.reason}
                    </p>
                  </div>

                  <div className='pt-4'>
                    <Button
                      onClick={handleRefresh}
                      disabled={refreshing}
                      variant='outline'
                      className='w-full'
                    >
                      {refreshing ? 'Refreshing...' : 'Refresh Status'}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className='text-center py-8'>
                  <p className='text-gray-500 dark:text-gray-400'>
                    Unable to load subscription status
                  </p>
                  <Button
                    onClick={handleRefresh}
                    disabled={refreshing}
                    variant='outline'
                    className='mt-4'
                  >
                    Try Again
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {!status?.hasAccess && (
            <Card className='mt-6'>
              <CardHeader>
                <CardTitle>Need Access?</CardTitle>
                <CardDescription>
                  If you believe this is an error, you can contact support
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className='space-y-3'>
                  <p className='text-sm text-gray-600 dark:text-gray-300'>
                    If you recently purchased a subscription and don't see
                    access, please wait a few minutes for the system to update,
                    or contact our support team.
                  </p>
                  <Button
                    onClick={() => (window.location.href = '/support')}
                    variant='default'
                    className='w-full'
                  >
                    Contact Support
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

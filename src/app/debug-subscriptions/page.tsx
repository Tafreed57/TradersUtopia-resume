'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw } from 'lucide-react';

interface Subscription {
  id: string;
  customer: string;
  customerEmail: string;
  status: string;
  products: string[];
  created: string;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
}

interface DebugData {
  userEmails: string[];
  totalSubscriptions: number;
  subscriptions: Subscription[];
  stripeMode: string;
  keyPrefix: string;
}

export default function DebugSubscriptionsPage() {
  const [debugData, setDebugData] = useState<DebugData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDebugData = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/debug-stripe-subscriptions');

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setDebugData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDebugData();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500';
      case 'canceled':
        return 'bg-red-500';
      case 'incomplete':
        return 'bg-yellow-500';
      case 'past_due':
        return 'bg-orange-500';
      default:
        return 'bg-gray-500';
    }
  };

  const isNewProduct = (productId: string) => {
    const newProducts = [
      'prod_SDiGAAqaeO0evl',
      'prod_SCHs4JlyD7gXtP',
      'prod_Qw1H4GoEIfftjk',
      'prod_QiTgT5kRBYkTow',
      'prod_QhRSRDcYmiwNPQ',
      'prod_PjwDEddsi171yy',
      'prod_PWrdZSGb1DPJR9',
    ];
    return newProducts.includes(productId);
  };

  return (
    <div className='min-h-screen bg-gray-50 py-8 px-4'>
      <div className='max-w-4xl mx-auto'>
        <div className='flex items-center justify-between mb-8'>
          <h1 className='text-3xl font-bold text-gray-900'>
            🔍 Stripe Subscriptions Debug
          </h1>
          <Button onClick={fetchDebugData} disabled={loading}>
            {loading ? (
              <Loader2 className='w-4 h-4 mr-2 animate-spin' />
            ) : (
              <RefreshCw className='w-4 h-4 mr-2' />
            )}
            Refresh
          </Button>
        </div>

        {error && (
          <Card className='mb-6 border-red-200'>
            <CardContent className='pt-6'>
              <p className='text-red-600'>❌ Error: {error}</p>
            </CardContent>
          </Card>
        )}

        {debugData && (
          <>
            <Card className='mb-6'>
              <CardHeader>
                <CardTitle className='flex items-center gap-2'>
                  🔑 Stripe Configuration
                  <Badge
                    variant={
                      debugData.stripeMode === 'TEST'
                        ? 'destructive'
                        : 'default'
                    }
                    className='ml-auto'
                  >
                    {debugData.stripeMode} MODE
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className='space-y-2'>
                  <div className='flex justify-between items-center'>
                    <span className='font-medium'>Mode:</span>
                    <Badge
                      variant={
                        debugData.stripeMode === 'TEST'
                          ? 'destructive'
                          : 'default'
                      }
                    >
                      {debugData.stripeMode}
                    </Badge>
                  </div>
                  <div className='flex justify-between items-center'>
                    <span className='font-medium'>Key Prefix:</span>
                    <code className='text-sm bg-gray-100 px-2 py-1 rounded'>
                      {debugData.keyPrefix}...
                    </code>
                  </div>
                </div>
                {debugData.stripeMode === 'TEST' && (
                  <div className='mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg'>
                    <p className='text-sm text-yellow-800'>
                      ⚠️ <strong>You're in TEST mode!</strong> To access your
                      live subscription with product ID{' '}
                      <code>prod_PWrdZSGb1DPJR9</code>, you need to update your
                      environment variables to use live Stripe keys.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className='mb-6'>
              <CardHeader>
                <CardTitle>📧 Your Email Addresses</CardTitle>
              </CardHeader>
              <CardContent>
                <div className='flex flex-wrap gap-2'>
                  {debugData.userEmails.map((email, index) => (
                    <Badge key={index} variant='outline'>
                      {email}
                    </Badge>
                  ))}
                </div>
                <p className='text-sm text-gray-600 mt-2'>
                  System searches Stripe for subscriptions using ALL these
                  emails
                </p>
              </CardContent>
            </Card>

            <Card className='mb-6'>
              <CardHeader>
                <CardTitle>
                  📊 Found {debugData.totalSubscriptions} Subscription(s)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {debugData.subscriptions.length === 0 ? (
                  <p className='text-gray-600'>
                    No subscriptions found in Stripe
                  </p>
                ) : (
                  <div className='space-y-4'>
                    {debugData.subscriptions.map(sub => (
                      <div
                        key={sub.id}
                        className='border rounded-lg p-4 space-y-3'
                      >
                        <div className='flex items-center justify-between'>
                          <code className='text-sm bg-gray-100 px-2 py-1 rounded'>
                            {sub.id}
                          </code>
                          <Badge className={getStatusColor(sub.status)}>
                            {sub.status.toUpperCase()}
                          </Badge>
                        </div>

                        <div className='grid grid-cols-1 md:grid-cols-2 gap-4 text-sm'>
                          <div>
                            <strong>Customer:</strong> {sub.customerEmail}
                          </div>
                          <div>
                            <strong>Created:</strong>{' '}
                            {new Date(sub.created).toLocaleDateString()}
                          </div>
                          {sub.currentPeriodStart && (
                            <div>
                              <strong>Period Start:</strong>{' '}
                              {new Date(
                                sub.currentPeriodStart
                              ).toLocaleDateString()}
                            </div>
                          )}
                          {sub.currentPeriodEnd && (
                            <div>
                              <strong>Period End:</strong>{' '}
                              {new Date(
                                sub.currentPeriodEnd
                              ).toLocaleDateString()}
                            </div>
                          )}
                        </div>

                        <div>
                          <strong className='block mb-2'>Products:</strong>
                          <div className='flex flex-wrap gap-2'>
                            {sub.products.map((productId, index) => (
                              <Badge
                                key={index}
                                variant={
                                  isNewProduct(productId)
                                    ? 'default'
                                    : 'destructive'
                                }
                              >
                                {productId}
                                {isNewProduct(productId) ? ' ✅' : ' ❌ OLD'}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>🎯 Current Allowed Products</CardTitle>
              </CardHeader>
              <CardContent>
                <div className='grid grid-cols-1 gap-2'>
                  {[
                    'prod_SDiGAAqaeO0evl',
                    'prod_SCHs4JlyD7gXtP',
                    'prod_Qw1H4GoEIfftjk',
                    'prod_QiTgT5kRBYkTow',
                    'prod_QhRSRDcYmiwNPQ',
                    'prod_PjwDEddsi171yy',
                    'prod_PWrdZSGb1DPJR9',
                  ].map(productId => (
                    <Badge key={productId} variant='default' className='w-fit'>
                      {productId}
                    </Badge>
                  ))}
                </div>
                <p className='text-sm text-gray-600 mt-4'>
                  Only subscriptions with these product IDs will grant access to
                  the platform.
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

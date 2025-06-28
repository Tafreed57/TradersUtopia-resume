"use client";

import { useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Lock, Shield, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { makeSecureRequest } from '@/lib/csrf-client';

export function SecureEntryButton() {
  const { isLoaded, user } = useUser();
  const router = useRouter();
  const [isVerifying, setIsVerifying] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{
    success: boolean;
    message: string;
    hasAccess: boolean;
  } | null>(null);

  const handleSecureEntry = async () => {
    console.log('🔐 Starting secure entry verification...');
    setIsVerifying(true);
    setShowResult(false);

    try {
      // Step 1: Check if user is authenticated
      if (!isLoaded || !user) {
        console.log('❌ User not authenticated, redirecting to sign-in');
        router.push('/sign-in');
        return;
      }

      console.log('✅ User authenticated:', user.emailAddresses[0]?.emailAddress);

      // Step 2: Auto-sync and verify subscription with Stripe
      console.log('🔄 Running auto-sync and Stripe verification...');
      
      const verifyResponse = await fetch('/api/verify-stripe-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const verifyResult = await verifyResponse.json();
      console.log('📋 Stripe verification result:', verifyResult);

      // Step 3: Check product-specific subscription
      console.log('🎯 Checking product-specific subscription...');
      
      const productResponse = await fetch('/api/check-product-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          allowedProductIds: ['prod_SWIyAf2tfVrJao'] // Your product ID
        })
      });

      const productResult = await productResponse.json();
      console.log('🛡️ Product subscription result:', productResult);

      // Step 4: Evaluate access
      if (productResult.hasAccess && verifyResult.success) {
        console.log('✅ All security checks passed - granting access');
        
        setVerificationResult({
          success: true,
          message: `Access granted! Welcome to Traders Utopia Premium.`,
          hasAccess: true
        });
        
        setShowResult(true);
        
        // Get default server and redirect to it after short delay
        setTimeout(async () => {
          try {
            const serverResponse = await makeSecureRequest('/api/servers/ensure-default', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
            });

            const serverResult = await serverResponse.json();
            
            if (serverResult.success && serverResult.server) {
              const server = serverResult.server;
              const firstChannel = server.channels?.[0];
              
              if (firstChannel) {
                console.log('🎯 Redirecting to server channel:', `${server.name}/${firstChannel.name}`);
                router.push(`/servers/${server.id}/channels/${firstChannel.id}`);
              } else {
                console.log('🎯 Redirecting to server:', server.name);
                router.push(`/servers/${server.id}`);
              }
            } else {
              console.log('⚠️ Could not get server, falling back to dashboard...');
              router.push('/dashboard');
            }
          } catch (error) {
            console.log('⚠️ Error getting server, falling back to dashboard...', error);
            router.push('/dashboard');
          }
        }, 1500);
        
      } else {
        console.log('❌ Security checks failed - access denied');
        console.log('Product access:', productResult.hasAccess);
        console.log('Stripe verification:', verifyResult.success);
        
        // Handle different failure scenarios
        let message = 'Access denied. ';
        let reason = '';
        
        if (!productResult.hasAccess) {
          message += `You need an active subscription to "Premium Dashboard Access" to continue.`;
          reason = 'No valid product subscription found';
        } else if (!verifyResult.success) {
          message += `Payment verification failed: ${verifyResult.message || 'Unknown error'}`;
          reason = 'Stripe payment verification failed';
        } else {
          message += 'Subscription verification failed.';
          reason = 'General subscription verification failure';
        }

        // Step 5: Revoke access and update subscription status
        console.log('🚫 Revoking access and updating subscription status...');
        try {
          await makeSecureRequest('/api/revoke-access', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ reason })
          });
          console.log('✅ Access revocation completed');
        } catch (revokeError) {
          console.error('❌ Error during access revocation:', revokeError);
        }
        
        setVerificationResult({
          success: false,
          message,
          hasAccess: false
        });
        
        setShowResult(true);
        
        // Redirect to pricing after delay
        setTimeout(() => {
          router.push('/pricing');
        }, 3000);
      }

    } catch (error) {
      console.error('❌ Security verification error:', error);
      
      setVerificationResult({
        success: false,
        message: 'Security verification failed. Please try again or contact support.',
        hasAccess: false
      });
      
      setShowResult(true);
    } finally {
      setIsVerifying(false);
    }
  };

  // Show verification result overlay
  if (showResult && verificationResult) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 p-3 rounded-full w-fit bg-gray-100 dark:bg-gray-800">
              {verificationResult.success ? (
                <CheckCircle className="h-8 w-8 text-green-600" />
              ) : (
                <AlertTriangle className="h-8 w-8 text-red-600" />
              )}
            </div>
            <CardTitle className={verificationResult.success ? 'text-green-600' : 'text-red-600'}>
              {verificationResult.success ? '✅ Access Granted' : '❌ Access Denied'}
            </CardTitle>
            <CardDescription>
              {verificationResult.message}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            {verificationResult.success ? (
              <p className="text-sm text-muted-foreground">
                Redirecting to Traders Utopia server...
              </p>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Redirecting to pricing page...
                </p>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setShowResult(false)}
                >
                  Close
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <Button 
      size="lg" 
      className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 text-lg font-semibold rounded-full transition-all duration-200 transform hover:scale-105 shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
      onClick={handleSecureEntry}
      disabled={isVerifying}
    >
      {isVerifying ? (
        <div className="flex items-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Verifying Access...</span>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          <span>Enter Traders Utopia</span>
        </div>
      )}
    </Button>
  );
} 
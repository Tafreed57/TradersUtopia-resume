"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "./ui/button";
import { useLoading } from "@/contexts/loading-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Lock, Star, CheckCircle } from 'lucide-react';

interface PaymentStatus {
  hasAccess: boolean;
  subscriptionStatus: string;
  subscriptionEnd: string | null;
  reason: string;
}

interface ServerPaymentGateProps {
  children: React.ReactNode;
  serverId: string;
}

export function ServerPaymentGate({ children, serverId }: ServerPaymentGateProps) {
  const { isLoaded, user } = useUser();
  const router = useRouter();
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const { startLoading, stopLoading } = useLoading();
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | null>(null);

  useEffect(() => {
    async function checkAccess() {
      if (!isLoaded || !user) {
        return;
      }

      startLoading("Checking server access...");

      try {
        const response = await fetch("/api/subscription/check");
        const data = await response.json();
        
        if (data.hasAccess) {
          setHasAccess(true);
        } else {
          setHasAccess(false);
        }
      } catch (error) {
        console.error("Error checking subscription:", error);
        setHasAccess(false);
      } finally {
        stopLoading();
      }
    }

    checkAccess();
  }, [isLoaded, user, startLoading, stopLoading]);

  useEffect(() => {
    const checkPaymentStatus = async () => {
      if (!isLoaded || !user) {
        setPaymentStatus(null);
        return;
      }

      try {
        const response = await fetch('/api/check-payment-status');
        const data = await response.json();
        setPaymentStatus(data);
      } catch (error) {
        console.error('Error checking payment status:', error);
        setPaymentStatus({
          hasAccess: false,
          subscriptionStatus: 'FREE',
          subscriptionEnd: null,
          reason: 'Error checking status'
        });
      }
    };

    checkPaymentStatus();
  }, [isLoaded, user]);

  if (hasAccess === null) {
    return null; // Loading is handled by LoadingProvider
  }

  if (!isLoaded || !user) {
    router.push("/sign-in");
    return null;
  }

  if (hasAccess === false) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-slate-950/90 to-black flex items-center justify-center p-6">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 max-w-md w-full border border-white/20 text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-2xl font-bold text-white mb-4">
            Server Access Restricted
          </h2>
          <p className="text-gray-300 mb-6">
            This server requires an active subscription. Upgrade to access premium trading discussions and alerts.
          </p>
          <Button 
            onClick={() => router.push("/pricing")}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 text-lg font-semibold"
          >
            View Pricing
          </Button>
        </div>
      </div>
    );
  }

  if (!paymentStatus?.hasAccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-slate-950/90 to-black flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 p-3 bg-yellow-100 dark:bg-yellow-900/20 rounded-full w-fit">
              <Lock className="h-8 w-8 text-yellow-600 dark:text-yellow-400" />
            </div>
            <CardTitle className="text-2xl mb-2">
              🔒 Premium Access Required
            </CardTitle>
            <CardDescription className="text-lg">
              Unlock exclusive trading alerts and market insights
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            <div className="text-center">
              <p className="text-muted-foreground mb-4">
                Current Status: <span className="font-semibold text-red-600">{paymentStatus?.subscriptionStatus || 'FREE'}</span>
              </p>
              <p className="text-sm text-muted-foreground">
                {paymentStatus?.reason}
              </p>
            </div>

            <div className="grid gap-4">
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-6 rounded-lg border">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Star className="h-5 w-5 text-yellow-500" />
                  What You Get With Premium:
                </h3>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Real-time trading alerts and signals
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Exclusive market analysis and insights
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Access to premium trading community
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Advanced trading tools and resources
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    24/7 support and guidance
                  </li>
                </ul>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button 
                size="lg" 
                className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                onClick={() => router.push("/pricing")}
              >
                View Pricing
              </Button>
              <Button 
                variant="outline" 
                size="lg"
                onClick={() => window.location.href = '/'}
              >
                Back to Homepage
              </Button>
            </div>

            <div className="text-center text-xs text-muted-foreground">
              <p>Secure payment processing by Stripe</p>
              <p>Cancel anytime • 30-day money-back guarantee</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}

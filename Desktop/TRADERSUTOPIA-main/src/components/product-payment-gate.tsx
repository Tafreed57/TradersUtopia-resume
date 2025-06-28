"use client";

import { useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { CheckCircle } from 'lucide-react';

interface ProductPaymentGateProps {
  children: React.ReactNode;
  allowedProductIds: string[];
  productName?: string;
  upgradeUrl?: string;
  features?: string[];
}

interface ProductAccessStatus {
  hasAccess: boolean;
  productId?: string;
  reason: string;
  subscriptionEnd?: string;
}

export function ProductPaymentGate({ 
  children, 
  allowedProductIds, 
  productName = "Premium Product",
  upgradeUrl = "/pricing",
  features = [
    "Exclusive dashboard access",
    "Premium features", 
    "Priority support"
  ]
}: ProductPaymentGateProps) {
  const { isLoaded, user } = useUser();
  const router = useRouter();
  const [accessStatus, setAccessStatus] = useState<ProductAccessStatus | null>(null);
  const [hasChecked, setHasChecked] = useState(false);

  useEffect(() => {
    // Only run once when component mounts and user is loaded
    if (!isLoaded || !user || hasChecked) {
      return;
    }

    const checkProductAccess = async () => {
      setHasChecked(true); // Mark as checked to prevent infinite loops
      
      try {
        console.log('🔍 [PRODUCT-GATE] Checking access for products:', allowedProductIds);
        
        const response = await fetch("/api/check-product-subscription", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            allowedProductIds
          })
        });

        if (!response.ok) {
          console.log('❌ [PRODUCT-GATE] API response not ok:', response.status);
          setAccessStatus({
            hasAccess: false,
            reason: 'Error checking subscription status'
          });
          return;
        }

        const data = await response.json();
        console.log('📊 [PRODUCT-GATE] API response:', data);
        
        if (data.hasAccess) {
          console.log('✅ [PRODUCT-GATE] Access granted');
          setAccessStatus({
            hasAccess: true,
            productId: data.productId,
            subscriptionEnd: data.subscriptionEnd,
            reason: 'VALID_SUBSCRIPTION'
          });
        } else {
          console.log('❌ [PRODUCT-GATE] Access denied');
          setAccessStatus({
            hasAccess: false,
            reason: 'Access denied'
          });
        }
      } catch (error) {
        console.error("❌ [PRODUCT-GATE] Error checking product subscription:", error);
        setAccessStatus({
          hasAccess: false,
          reason: 'Error checking subscription status'
        });
      }
    };

    checkProductAccess();
  }, [isLoaded, user, hasChecked, allowedProductIds]);

  // Redirect to sign-in if not authenticated
  useEffect(() => {
    if (isLoaded && !user) {
      router.push("/sign-in");
    }
  }, [isLoaded, user, router]);

  if (!isLoaded || !user) {
    return null;
  }

  if (accessStatus === null) {
    return null; // Loading
  }

  if (!accessStatus.hasAccess) {
    console.log('🚫 [PRODUCT-GATE] Showing paywall');
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-slate-950/90 to-black flex items-center justify-center p-6">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 max-w-md w-full border border-white/20 text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-2xl font-bold text-white mb-4">
            Premium Access Required
          </h2>
          <p className="text-gray-300 mb-4">
            This feature requires a premium subscription to our trading platform.
          </p>
          <p className="text-gray-400 text-sm mb-6">
            Join thousands of successful traders with our proven strategies and real-time alerts.
          </p>
          <Button 
            onClick={() => router.push("/pricing")}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 text-lg font-semibold mb-3"
          >
            Upgrade to Premium
          </Button>
          <Button 
            variant="ghost"
            onClick={() => router.push("/dashboard")}
            className="w-full text-gray-300 hover:text-white"
          >
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  // User has access to the required product, render the protected content
  return (
    <>
      {children}
    </>
  );
} 
"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface SimplePaymentGateProps {
  children: React.ReactNode;
}

export function SimplePaymentGate({ children }: SimplePaymentGateProps) {
  const { isLoaded, user } = useUser();
  const router = useRouter();
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkSubscriptionStatus = async () => {
      if (!isLoaded || !user) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch("/api/check-payment-status");
        const data = await response.json();
        
        console.log("Payment status check:", data);
        
        if (data.hasAccess) {
          setHasAccess(true);
        } else {
          setHasAccess(false);
          router.push("/pricing");
        }
      } catch (error) {
        console.error("Error checking payment status:", error);
        setHasAccess(false);
        router.push("/pricing");
      } finally {
        setLoading(false);
      }
    };

    checkSubscriptionStatus();
  }, [isLoaded, user, router]);

  if (!isLoaded || !user) {
    router.push("/sign-in");
    return null;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!hasAccess) {
    return null; // Will redirect to pricing
  }

  return children;
} 
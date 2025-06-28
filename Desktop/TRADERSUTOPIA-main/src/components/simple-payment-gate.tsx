"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "./ui/button";
import { useLoading } from "@/contexts/loading-provider";

interface SimplePaymentGateProps {
  children: React.ReactNode;
}

export function SimplePaymentGate({ children }: SimplePaymentGateProps) {
  const { isLoaded, user } = useUser();
  const router = useRouter();
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const { startLoading, stopLoading } = useLoading();

  useEffect(() => {
    async function checkAccess() {
      if (!isLoaded) {
        return;
      }

      if (!user) {
        router.push("/sign-in");
        return;
      }

      startLoading("Verifying subscription...");

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
  }, [isLoaded, user, router, startLoading, stopLoading]);

  if (hasAccess === null) {
    return null; // Loading is handled by LoadingProvider
  }

  if (!isLoaded || !user) {
    return null;
  }

  if (hasAccess === false) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-slate-950/90 to-black flex items-center justify-center">
        <div className="text-white text-center max-w-md mx-auto p-8">
          <div className="text-6xl mb-6">🔒</div>
          <h2 className="text-2xl font-bold mb-4">Premium Access Required</h2>
          <p className="text-gray-300 mb-6">
            You need an active subscription to access this content.
          </p>
          <Button 
            onClick={() => router.push("/pricing")}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 text-lg"
          >
            View Pricing
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
} 
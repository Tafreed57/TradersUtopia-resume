"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "./ui/button";

interface PaymentGateProps {
  children: React.ReactNode;
}

export function PaymentGate({ children }: PaymentGateProps) {
  const { isLoaded, user } = useUser();
  const router = useRouter();
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkAccess() {
      if (!isLoaded || !user) {
        setLoading(false);
        return;
      }

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
        setLoading(false);
      }
    }

    checkAccess();
  }, [isLoaded, user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-xl">Checking your subscription...</p>
        </div>
      </div>
    );
  }

  if (!isLoaded || !user) {
    router.push("/sign-in");
    return null;
  }

  if (hasAccess === false) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center p-6">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 max-w-md w-full border border-white/20 text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-2xl font-bold text-white mb-4">
            Subscription Required
          </h2>
          <p className="text-gray-300 mb-6">
            You need an active subscription to access the dashboard. Join our
            premium trading community today!
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

  return <>{children}</>;
}

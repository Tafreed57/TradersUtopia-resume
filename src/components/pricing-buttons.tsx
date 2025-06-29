"use client";

import { Button } from "./ui/button";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";

export function PricingButtons() {
  const router = useRouter();
  const { user } = useUser();
  const [loading, setLoading] = useState(false);
  const [subscriptionData, setSubscriptionData] = useState<any>(null);
  const [checkingStatus, setCheckingStatus] = useState(true);

  useEffect(() => {
    async function checkSubscription() {
      try {
        const response = await fetch("/api/subscription/check");
        const data = await response.json();
        setSubscriptionData(data);
      } catch (error) {
        console.error("Error checking subscription:", error);
      } finally {
        setCheckingStatus(false);
      }
    }

    if (user) {
      checkSubscription();
    }
  }, [user]);

  const handleStartTrial = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/subscription/start-trial", {
        method: "POST",
      });

      const data = await response.json();

      if (data.success) {
        router.push("/dashboard");
      } else {
        alert(data.error || "Failed to start trial");
      }
    } catch (error) {
      console.error("Error starting trial:", error);
      alert("Failed to start trial. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleBuyNow = () => {
    router.push("/checkout");
  };

  if (checkingStatus) {
    return (
      <div className="space-y-4">
        <Button
          size="lg"
          className="w-full bg-gray-600 text-white py-4 text-lg font-semibold rounded-full"
          disabled
        >
          Checking status...
        </Button>
      </div>
    );
  }

  // User has active subscription
  if (subscriptionData?.hasAccess) {
    return (
      <div className="space-y-4">
        <Button
          size="lg"
          onClick={() => router.push("/dashboard")}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 text-lg font-semibold rounded-full transition-all duration-200 transform hover:scale-105 shadow-xl"
        >
          Go to Dashboard
        </Button>
        <p className="text-green-400 text-sm text-center">
          ✅ You have access to Traders Utopia
        </p>
      </div>
    );
  }

  // User can start trial
  if (subscriptionData?.canStartTrial) {
    return (
      <div className="space-y-4">
        <Button
          size="lg"
          onClick={handleStartTrial}
          disabled={loading}
          className="w-full bg-green-600 hover:bg-green-700 text-white py-4 text-lg font-semibold rounded-full transition-all duration-200 transform hover:scale-105 shadow-xl"
        >
          {loading ? "Processing..." : "Subscribe Now"}
        </Button>
        <Button
          size="lg"
          onClick={handleBuyNow}
          variant="outline"
          className="w-full border-white/30 text-white hover:bg-white/10 py-4 text-lg font-semibold rounded-full"
        >
          Buy Now - $149.99/month
        </Button>
        <p className="text-gray-400 text-sm text-center">
          $149.99/month
        </p>
      </div>
    );
  }

  // User cannot start trial (already used)
  return (
    <div className="space-y-4">
      <Button
        size="lg"
        onClick={handleBuyNow}
        className="w-full bg-green-600 hover:bg-green-700 text-white py-4 text-lg font-semibold rounded-full transition-all duration-200 transform hover:scale-105 shadow-xl"
      >
        Subscribe Now - $149.99/month
      </Button>
      <p className="text-gray-400 text-sm text-center">
        Automatic recurring payments • Secure billing
      </p>
    </div>
  );
}

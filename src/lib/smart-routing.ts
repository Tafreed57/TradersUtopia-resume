// Smart routing utility for handling authentication and subscription-based navigation
"use client";

import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";

interface SmartRoutingOptions {
  onError?: (error: Error) => void;
  loadingCallback?: (isLoading: boolean) => void;
}

export function useSmartRouting(options: SmartRoutingOptions = {}) {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useUser();
  const { onError, loadingCallback } = options;

  const handleSmartNavigation = async () => {
    if (!isLoaded) {
      return; // Wait for Clerk to load
    }

    try {
      loadingCallback?.(true);

      // If user is not signed in, redirect to sign-in page
      if (!isSignedIn) {
        console.log("📍 User not signed in, redirecting to sign-in...");
        router.push("/sign-in");
        return;
      }

      // User is signed in - check subscription status
      console.log("🔍 User signed in, checking subscription status...");

      const response = await fetch("/api/check-product-subscription", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          allowedProductIds: ["prod_SWIyAf2tfVrJao"],
        }),
      });

      if (!response.ok) {
        console.log("❌ API response not ok, redirecting to pricing...");
        router.push("/pricing");
        return;
      }

      const result = await response.json();
      console.log("📊 [SmartRouting] Subscription check result:", result);

      if (result.hasAccess) {
        // User has subscription - go to dashboard
        console.log("✅ User has subscription, redirecting to dashboard...");
        router.push("/dashboard");
      } else {
        // User doesn't have subscription - go to pricing
        console.log("❌ User needs subscription, redirecting to pricing...");
        router.push("/pricing");
      }
    } catch (error) {
      console.error("❌ Error in smart routing:", error);
      onError?.(error as Error);
      // On error, redirect to pricing to be safe
      router.push("/pricing");
    } finally {
      loadingCallback?.(false);
    }
  };

  return {
    handleSmartNavigation,
    isLoaded,
    isSignedIn,
  };
}

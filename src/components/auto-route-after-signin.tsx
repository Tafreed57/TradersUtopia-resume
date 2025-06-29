"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter, useSearchParams } from "next/navigation";

export function AutoRouteAfterSignIn() {
  const { isLoaded, isSignedIn, user } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [hasChecked, setHasChecked] = useState(false);
  const [isAutoRouting, setIsAutoRouting] = useState(false);

  useEffect(() => {
    const checkAndRoute = async () => {
      // Only run this check once per page load and only if user is signed in
      if (!isLoaded || !isSignedIn || hasChecked) {
        return;
      }

      // Check if user just came from sign-in and should be auto-routed
      const autoRoute = searchParams?.get("auto_route");
      const hasRedirectParam = searchParams?.get("redirect_url") !== null;
      const hasClerkParam = searchParams?.get("__clerk_redirect_url") !== null;
      const shouldAutoRoute =
        autoRoute === "true" || hasRedirectParam || hasClerkParam;

      if (!shouldAutoRoute) {
        setHasChecked(true);
        return;
      }

      console.log(
        "🎯 User returned from sign-in, automatically checking subscription...",
      );
      setHasChecked(true);
      setIsAutoRouting(true);

      try {
        // Add timeout to prevent hanging
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Auto-route timeout")), 5000),
        );

        // Check subscription status
        const productPromise = fetch("/api/check-product-subscription", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            allowedProductIds: ["prod_SWIyAf2tfVrJao"],
          }),
        });

        const productResponse = (await Promise.race([
          productPromise,
          timeoutPromise,
        ])) as Response;
        const productResult = await productResponse.json();
        console.log("📊 Auto-check subscription result:", productResult);

        // Route based on subscription status
        if (productResult.hasAccess) {
          console.log("✅ User has subscription, auto-routing to dashboard...");
          setTimeout(() => {
            router.push("/dashboard");
          }, 1000);
        } else {
          console.log("❌ User needs subscription, auto-routing to pricing...");
          setTimeout(() => {
            router.push("/pricing");
          }, 1000);
        }
      } catch (error) {
        console.error("❌ Error in auto-route check:", error);
        setIsAutoRouting(false);
        // On error, don't redirect - let user use the button manually
      }
    };

    checkAndRoute();
  }, [isLoaded, isSignedIn, user, hasChecked, searchParams, router]);

  // Show loading overlay when auto-routing
  if (isAutoRouting) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 text-center max-w-sm">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <h3 className="text-lg font-semibold mb-2">Welcome back!</h3>
          <p className="text-gray-600 dark:text-gray-300">
            Checking your subscription and routing you to the right place...
          </p>
        </div>
      </div>
    );
  }

  // This component doesn't render anything when not auto-routing
  return null;
}

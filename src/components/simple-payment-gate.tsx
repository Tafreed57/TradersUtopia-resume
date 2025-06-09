"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

interface SimplePaymentGateProps {
  children: React.ReactNode;
}

export function SimplePaymentGate({ children }: SimplePaymentGateProps) {
  const { isLoaded, user } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (isLoaded && user) {
      // FOR TESTING: Always redirect to pricing page
      // This ensures you always go through the payment UI flow
      router.push("/pricing");
    }
  }, [isLoaded, user, router]);

  if (!isLoaded || !user) {
    router.push("/sign-in");
    return null;
  }

  // FOR TESTING: Always redirect to pricing, never show dashboard
  return null;
} 
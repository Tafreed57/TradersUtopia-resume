"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface SubscriptionProtectedLinkProps {
  href: string;
  children: React.ReactNode;
  allowedProductIds?: string[];
  className?: string;
  variant?:
    | "default"
    | "destructive"
    | "outline"
    | "secondary"
    | "ghost"
    | "link";
  size?: "default" | "sm" | "lg" | "icon";
  onClick?: () => void;
  disabled?: boolean;
}

export function SubscriptionProtectedLink({
  href,
  children,
  allowedProductIds = ["prod_SWIyAf2tfVrJao"], // Default to your current product
  className,
  variant,
  size,
  onClick,
  disabled = false,
}: SubscriptionProtectedLinkProps) {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(false);

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();

    // Execute any custom onClick first
    if (onClick) {
      onClick();
    }

    // If user is not authenticated, redirect to sign-in
    if (!isLoaded || !user) {
      console.log("🔐 User not authenticated, redirecting to sign-in");
      router.push("/sign-in");
      return;
    }

    // Set loading state
    setIsChecking(true);

    try {
      console.log("🔍 Checking subscription for navigation to:", href);

      // Check subscription status
      const response = await fetch("/api/check-product-subscription", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          allowedProductIds,
        }),
      });

      const result = await response.json();
      console.log("📊 Subscription check result:", result);

      if (result.hasAccess) {
        console.log("✅ Access granted, navigating to:", href);
        router.push(href);
      } else {
        console.log("❌ Access denied, redirecting to pricing page");
        router.push("/pricing");
      }
    } catch (error) {
      console.error("❌ Error checking subscription:", error);
      // On error, redirect to pricing to be safe
      router.push("/pricing");
    } finally {
      setIsChecking(false);
    }
  };

  // If it's a Button component
  if (className?.includes("Button") || variant || size) {
    return (
      <Button
        onClick={handleClick}
        className={className}
        variant={variant}
        size={size}
        disabled={disabled || isChecking}
      >
        {isChecking ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Checking...
          </>
        ) : (
          children
        )}
      </Button>
    );
  }

  // For other clickable elements
  return (
    <div
      onClick={handleClick}
      className={`cursor-pointer ${disabled ? "pointer-events-none opacity-50" : ""} ${className || ""}`}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          handleClick(e as any);
        }
      }}
    >
      {isChecking ? (
        <div className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Checking...</span>
        </div>
      ) : (
        children
      )}
    </div>
  );
}

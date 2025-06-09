"use client";

import { Button } from "./ui/button";
import { useRouter } from "next/navigation";

export function SimplePricingButtons() {
  const router = useRouter();

  const handleStartTrial = () => {
    // Redirect to Stripe hosted checkout
    window.location.href = "https://buy.stripe.com/3cI5kC46X5Bmbft2Kc4Ja0k";
  };

  const handleBuyNow = () => {
    // Redirect to Stripe hosted checkout
    window.location.href = "https://buy.stripe.com/3cI5kC46X5Bmbft2Kc4Ja0k";
  };

  return (
    <div className="space-y-4">
      <Button 
        size="lg" 
        onClick={handleStartTrial}
        className="w-full bg-green-600 hover:bg-green-700 text-white py-4 text-lg font-semibold rounded-full transition-all duration-200 transform hover:scale-105 shadow-xl"
      >
        Start 14-Day Free Trial
      </Button>
      <p className="text-gray-400 text-sm text-center">
        14-day free trial • Cancel anytime
      </p>
    </div>
  );
} 
"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  Zap,
  Crown,
  ArrowRight,
  Shield,
  CheckCircle,
} from "lucide-react";
import { useSmartRouting } from "@/lib/smart-routing";

export function PricingSectionButton() {
  const [isProcessing, setIsProcessing] = useState(false);

  const { handleSmartNavigation, isLoaded, isSignedIn } = useSmartRouting({
    loadingCallback: setIsProcessing,
    onError: (error) => {
      console.error("Smart routing error:", error);
    },
  });

  const handleClick = async () => {
    if (isProcessing) return; // Prevent double clicks
    await handleSmartNavigation();
  };

  // Show loading state while Clerk is loading
  if (!isLoaded) {
    return (
      <div className="flex flex-col items-center gap-4">
        <Button
          size="lg"
          disabled
          className="bg-gradient-to-r from-green-500 to-green-600 text-white px-12 py-8 text-2xl font-bold rounded-2xl opacity-50 w-full max-w-md shadow-2xl"
        >
          <Loader2 className="h-6 w-6 animate-spin mr-3" />
          <span>Loading...</span>
        </Button>
      </div>
    );
  }

  const getButtonText = () => {
    return "View Pricing";
  };

  const getButtonIcon = () => {
    if (!isSignedIn) {
      return <Crown className="h-6 w-6" />;
    }
    return <Zap className="h-6 w-6" />;
  };

  const getButtonColors = () => {
    if (!isSignedIn) {
      return "from-yellow-500 via-orange-500 to-red-500 hover:from-yellow-600 hover:via-orange-600 hover:to-red-600";
    }
    return "from-green-500 via-emerald-500 to-green-600 hover:from-green-600 hover:via-emerald-600 hover:to-green-700";
  };

  return (
    <div className="flex flex-col items-center gap-6">
      <Button
        size="lg"
        onClick={handleClick}
        disabled={isProcessing}
        className={`bg-gradient-to-r ${getButtonColors()} text-white font-black px-12 py-8 text-2xl rounded-2xl transition-all duration-300 transform hover:scale-105 shadow-2xl hover:shadow-3xl disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none w-full max-w-md border-2 border-white/30 relative overflow-hidden group`}
      >
        {/* Animated background pulse */}
        <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 ease-in-out"></div>

        {isProcessing ? (
          <div className="flex items-center gap-3 relative z-10">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span>Loading...</span>
          </div>
        ) : (
          <div className="flex items-center gap-3 relative z-10">
            {getButtonIcon()}
            <span>{getButtonText()}</span>
            <ArrowRight className="h-6 w-6 group-hover:translate-x-1 transition-transform duration-200" />
          </div>
        )}
      </Button>

      {/* Trust indicators for non-signed users */}
      {!isSignedIn && (
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center gap-8 text-sm">
            <div className="flex items-center gap-2 text-green-400">
              <Shield className="w-4 h-4" />
              <span>256-bit SSL Secure</span>
            </div>
            <div className="flex items-center gap-2 text-blue-400">
              <CheckCircle className="w-4 h-4" />
              <span>Instant Access</span>
            </div>
            <div className="flex items-center gap-2 text-yellow-400">
              <Crown className="w-4 h-4" />
              <span>Premium Support</span>
            </div>
          </div>

          {/* Urgency indicator */}
          <div className="bg-red-600/20 border border-red-500/30 rounded-lg px-4 py-2 backdrop-blur-sm">
            <div className="flex items-center justify-center gap-2 text-red-300 text-sm font-bold">
              <span className="animate-pulse">🔥</span>
              <span>47 spots remaining at this price</span>
              <span className="animate-pulse">🔥</span>
            </div>
          </div>

          {/* Money back guarantee */}
          <p className="text-gray-400 text-xs">
            ✅ 30-day money-back guarantee • Cancel anytime • No questions asked
          </p>
        </div>
      )}
    </div>
  );
}

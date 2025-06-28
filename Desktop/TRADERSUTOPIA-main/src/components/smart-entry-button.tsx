"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Star, Zap, ArrowRight, Shield, CheckCircle } from 'lucide-react';
import { useSmartRouting } from '@/lib/smart-routing';

interface SmartEntryButtonProps {
  customContent?: string;
  skipStripeCheckout?: boolean;
}

export function SmartEntryButton({ customContent, skipStripeCheckout = false }: SmartEntryButtonProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  
  const { handleSmartNavigation, isLoaded, isSignedIn } = useSmartRouting({
    loadingCallback: setIsProcessing,
    onError: (error) => {
      console.error('Smart routing error:', error);
    }
  });

  const handleClick = async () => {
    if (isProcessing) return; // Prevent double clicks
    await handleSmartNavigation();
  };

  // Dynamic button text based on user state
  const getButtonText = () => {
    if (customContent) return customContent;
    
    if (!isSignedIn) {
      return "View Pricing & Join 1,000+ Traders";
    }
    
    return "Access Your Trading Platform";
  };

  const getButtonIcon = () => {
    if (!isSignedIn) {
      return <Star className="h-5 h-5 sm:h-6 sm:w-6" />;
    }
    return <Zap className="h-5 h-5 sm:h-6 sm:w-6" />;
  };

  const getButtonColors = () => {
    if (!isSignedIn) {
      return "from-blue-600 via-purple-600 to-blue-700 hover:from-blue-700 hover:via-purple-700 hover:to-blue-800";
    }
    return "from-green-500 via-emerald-500 to-green-600 hover:from-green-600 hover:via-emerald-600 hover:to-green-700";
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <Button 
        size="lg" 
        onClick={handleClick}
        disabled={!isLoaded || isProcessing}
        className={`bg-gradient-to-r ${getButtonColors()} text-white font-black px-8 sm:px-12 md:px-16 py-6 sm:py-8 text-xl sm:text-2xl rounded-2xl transition-all duration-300 transform hover:scale-105 shadow-2xl hover:shadow-3xl disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none w-full sm:w-auto border-2 border-white/20 relative overflow-hidden group`}
      >
        {/* Shimmer effect */}
        <div className="absolute inset-0 -top-2 -bottom-2 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12 opacity-0 group-hover:opacity-100 group-hover:animate-shimmer transition-opacity duration-500"></div>
        
        {!isLoaded || isProcessing ? (
          <div className="flex items-center gap-3 relative z-10">
            <Loader2 className="h-5 h-5 sm:h-6 sm:w-6 animate-spin" />
            <span className="hidden sm:inline">
              {!isLoaded ? 'Loading...' : (!isSignedIn ? 'Loading Pricing...' : 'Accessing Platform...')}
            </span>
            <span className="sm:hidden">Loading...</span>
          </div>
        ) : (
          <div className="flex items-center gap-3 relative z-10">
            {getButtonIcon()}
            <span className="hidden sm:inline">{getButtonText()}</span>
            <span className="sm:hidden">
              {!isSignedIn ? "View Pricing" : "Access Platform"}
            </span>
            <ArrowRight className="h-5 h-5 sm:h-6 sm:w-6 group-hover:translate-x-1 transition-transform duration-200" />
          </div>
        )}
      </Button>

      {/* Trust indicators */}
      {!isSignedIn && (
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center gap-6 text-sm">
            <div className="flex items-center gap-2 text-green-400">
              <Shield className="w-4 h-4" />
              <span className="hidden xs:inline">256-bit SSL Secure</span>
              <span className="xs:hidden">Secure</span>
            </div>
            <div className="flex items-center gap-2 text-blue-400">
              <CheckCircle className="w-4 h-4" />
              <span className="hidden xs:inline">Instant Access</span>
              <span className="xs:hidden">Instant</span>
            </div>
            <div className="flex items-center gap-2 text-yellow-400">
              <Star className="w-4 h-4" />
              <span className="hidden xs:inline">Premium Support</span>
              <span className="xs:hidden">Support</span>
            </div>
          </div>
          
          <p className="text-gray-400 text-xs sm:text-sm">
            ✅ 14-day free trial • No credit card required • Cancel anytime
          </p>
        </div>
      )}
    </div>
  );
} 
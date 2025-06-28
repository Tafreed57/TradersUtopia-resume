"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ExternalLink, CheckCircle } from 'lucide-react';
import { useLoading } from '@/contexts/loading-provider';

interface EnhancedTrialButtonProps {
  isSignedIn?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function EnhancedTrialButton({ 
  isSignedIn = false, 
  className = "",
  children 
}: EnhancedTrialButtonProps) {
  const router = useRouter();
  const { startLoading } = useLoading();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleTrialClick = () => {
    setIsProcessing(true);
    
    // Open Stripe checkout in new tab
    console.log('🚀 Opening Stripe checkout in new tab...');
    window.open("https://buy.stripe.com/test_28E6oG8nd5Bm3N1esU4Ja01", "_blank");
    
    // Redirect current tab after brief delay
    setTimeout(() => {
      if (isSignedIn) {
        console.log('📍 Redirecting signed-in user to payment verification...');
        startLoading('Loading payment verification...');
        router.push("/payment-verification");
      } else {
        console.log('📍 Redirecting non-signed user to homepage for authentication...');
        startLoading('Loading homepage...');
        window.location.href = "/";
      }
    }, 800); // Slightly longer delay for better UX

    // Reset processing state after redirect
    setTimeout(() => {
      setIsProcessing(false);
    }, 1000);
  };

  return (
    <Button 
      size="lg" 
      onClick={handleTrialClick}
      disabled={isProcessing}
      className={`transition-all duration-200 transform hover:scale-105 shadow-xl disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none ${className || "w-full bg-green-600 hover:bg-green-700 text-white py-4 text-lg font-semibold rounded-full"}`}
    >
      {isProcessing ? (
        <div className="flex items-center gap-2">
          <CheckCircle className="h-4 h-4 sm:h-5 sm:w-5 animate-pulse" />
          <span className="hidden sm:inline">Opening Checkout...</span>
          <span className="sm:hidden">Opening...</span>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          {typeof children === 'string' && <ExternalLink className="h-4 h-4 sm:h-5 sm:w-5" />}
          <span>{children}</span>
        </div>
      )}
    </Button>
  );
} 
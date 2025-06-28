"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ExternalLink, CheckCircle } from 'lucide-react';

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
  const [isProcessing, setIsProcessing] = useState(false);

  const handleTrialClick = () => {
    setIsProcessing(true);
    
    // Open Stripe checkout in new tab
    console.log('🚀 Opening Stripe checkout in new tab...');
    window.open("https://buy.stripe.com/test_28E6oG8nd5Bm3N1esU4Ja01", "_blank");
    
    // Redirect current tab after brief delay
    setTimeout(() => {
      if (isSignedIn) {
        console.log('📍 Redirecting signed-in user to dashboard...');
        router.push("/dashboard");
      } else {
        console.log('📍 Redirecting non-signed user to homepage for authentication...');
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
      className={`w-full bg-green-600 hover:bg-green-700 text-white py-4 text-lg font-semibold rounded-full transition-all duration-200 transform hover:scale-105 shadow-xl disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none ${className}`}
    >
      {isProcessing ? (
        <div className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5 animate-pulse" />
          <span>Opening Checkout...</span>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <ExternalLink className="h-5 w-5" />
          <span>{children}</span>
        </div>
      )}
    </Button>
  );
} 
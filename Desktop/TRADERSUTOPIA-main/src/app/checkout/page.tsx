"use client";

import { Button } from "@/components/ui/button";
import Image from "next/image";
import Link from "next/link";
import { AuthHeader } from "@/components/auth-header";
import { NavigationButton } from "@/components/navigation-button";
import { GlobalMobileMenu } from "@/components/global-mobile-menu";

export default function CheckoutPage() {

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-slate-950/90 to-black">
      {/* Header */}
      <header className="flex items-center justify-between p-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-6">
          {/* Logo and Title */}
          <NavigationButton href="/" className="flex items-center gap-3" loadingMessage="Loading homepage...">
            <Image src="/logo.png" alt="TradersUtopia" width={32} height={32} />
            <span className="text-white text-xl font-bold">TradersUtopia</span>
          </NavigationButton>
          
          {/* Authentication Section */}
          <AuthHeader />
        </div>
        <div className="flex items-center gap-3">
          <NavigationButton href="/pricing" asButton={true} variant="ghost" className="text-white hover:bg-white/10" loadingMessage="Loading pricing information...">
            Back to Pricing
          </NavigationButton>
          <GlobalMobileMenu />
        </div>
      </header>

      {/* Redirect Message */}
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)] px-6">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 max-w-md w-full border border-white/20 text-center">
          <div className="text-6xl mb-6">🚀</div>
          <h2 className="text-2xl font-bold text-white mb-4">
            Redirecting to Secure Checkout
          </h2>
          <p className="text-gray-300 mb-6">
            You should have been redirected to our secure Stripe checkout page. If not, click the button below.
          </p>
          <Button 
            onClick={() => window.open("https://buy.stripe.com/test_28E6oG8nd5Bm3N1esU4Ja01", "_blank")}
            className="w-full bg-green-600 hover:bg-green-700 text-white py-3 text-lg font-semibold"
          >
            Go to Secure Checkout
          </Button>
          <p className="text-gray-400 text-xs mt-4">
            Powered by Stripe - Your payment information is secure
          </p>
        </div>
      </div>
    </div>
  );
} 
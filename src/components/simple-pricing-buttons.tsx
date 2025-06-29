"use client";

import { EnhancedTrialButton } from "./enhanced-trial-button";

export function SimplePricingButtons() {
  return (
    <div className="space-y-4">
      <EnhancedTrialButton isSignedIn={true}>
        Subscribe Now
      </EnhancedTrialButton>
      <p className="text-gray-400 text-sm text-center">
        Get instant access
      </p>
    </div>
  );
}

"use client";

import { EnhancedTrialButton } from "./enhanced-trial-button";

export function SimplePricingButtons() {
  return (
    <div className="space-y-4">
      <EnhancedTrialButton isSignedIn={true}>
        Start 14-Day Free Trial
      </EnhancedTrialButton>
      <p className="text-gray-400 text-sm text-center">
        14-day free trial • Cancel anytime
      </p>
    </div>
  );
}

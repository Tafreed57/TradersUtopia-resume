// Simple UI-only subscription checking - no database required

export async function checkUserSubscription() {
  // For UI-only testing, just return that user needs to pay
  return {
    hasAccess: false,
    status: "FREE" as const,
    canStartTrial: true,
  };
}

export async function startTrial(userId: string) {
  // UI-only - just simulate success
  const trialEnd = new Date();
  trialEnd.setDate(trialEnd.getDate() + 14);
  return trialEnd;
}

export async function activateSubscription(userId: string, paymentId: string) {
  // UI-only - just simulate success
  const subscriptionEnd = new Date();
  subscriptionEnd.setMonth(subscriptionEnd.getMonth() + 1);
  return subscriptionEnd;
}

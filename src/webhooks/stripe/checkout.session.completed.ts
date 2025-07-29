import Stripe from 'stripe';
import { UserService } from '@/services/database/user-service';
import { SubscriptionSyncService } from '@/services/subscription-sync-service';

export async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session
) {
  const userService = new UserService();
  const subscriptionSyncService = new SubscriptionSyncService();

  try {
    if (!session.customer || !session.metadata?.email) {
      throw new Error('Missing customer or email in session');
    }

    const customerEmail = session.metadata.email;

    // Find the user in our database
    const user = await userService.findByUserIdOrEmail(customerEmail);

    if (!user) {
      throw new Error(`User not found for email: ${customerEmail}`);
    }

    // Use the new complete sync method that fetches actual subscription data
    // This provides more accurate data including currentPeriodEnd
    await subscriptionSyncService.syncFromCheckoutSessionComplete(
      session,
      user.id
    );

    // Update user access
    await subscriptionSyncService.updateUserAccess(
      typeof session.customer === 'string'
        ? session.customer
        : session.customer.id
    );
  } catch (error) {
    throw error;
  }
}

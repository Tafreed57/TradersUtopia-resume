import Stripe from 'stripe';
import { UserService } from '@/services/database/user-service';
import { CustomerService } from '@/services/stripe/customer-service';
import { SubscriptionService } from '@/services/stripe/subscription-service';
import { SubscriptionSyncService } from '@/services/subscription-sync-service';

export async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session
) {
  const userService = new UserService();
  const customerService = new CustomerService();
  const subscriptionService = new SubscriptionService();
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

    // Get customer details with subscriptions using email
    const customer =
      await customerService.findCustomerWithSubscriptions(customerEmail);

    if (!customer || !customer.subscriptions?.data?.length) {
      throw new Error('No subscriptions found for customer');
    }

    // Find the most recent active subscription
    const activeSubscription = customer.subscriptions.data.find(
      sub => sub.status === 'active' || sub.status === 'trialing'
    );

    if (!activeSubscription) {
      throw new Error('No active subscription found');
    }

    // Sync the subscription to our database
    await subscriptionSyncService.createOrUpdateSubscription(
      activeSubscription,
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

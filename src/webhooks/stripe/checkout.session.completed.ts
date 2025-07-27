import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { UserService } from '@/services/database/user-service';
import { SubscriptionSyncService } from '@/services/subscription-sync-service';
import { CustomerService } from '@/services/stripe/customer-service';
import { apiLogger } from '@/lib/enhanced-logger';

export const completedCheckout = async (event: any) => {
  const session = event.data.object as Stripe.Checkout.Session;

  let email: string | null = null;
  let customerName: string | null = null;
  let customerId: string | null = null;

  // ✅ OPTIMIZED: Use session data directly instead of API calls
  if (session.customer) {
    customerId = session.customer as string;
  }

  // ✅ OPTIMIZED: Always use customer_details from session (no API call needed)
  if (session.customer_details?.email) {
    email = session.customer_details.email;
    customerName = session.customer_details.name;
    apiLogger.subscriptionEvent('checkout_session_completed', {
      email,
      customerId,
      sessionId: session.id,
    });
  }

  if (!email) {
    console.error('No email found in session customer_details');
    return NextResponse.json({ error: 'No email found' }, { status: 400 });
  }

  try {
    // Initialize services
    const userService = new UserService();
    const subscriptionSyncService = new SubscriptionSyncService();
    const customerService = new CustomerService();

    // Check if user exists by email
    const existingUser = await userService.findByUserIdOrEmail(email);

    if (!existingUser) {
      console.log(`No user found for email: ${email}, creating new user...`);

      // Create a new user profile for this Stripe customer
      const newUser = await userService.createUser({
        userId: `stripe_${customerId || session.id}`, // Use session.id if no customer ID
        email: email,
        name: customerName || 'Unknown User',
        imageUrl: '',
        isAdmin: false,
      });

      console.log(`✅ [WEBHOOK-OPTIMIZED] Created new user for: ${email}`);

      // Create initial subscription record if we have customer data
      if (customerId) {
        try {
          // Get customer and subscription data from Stripe
          const customer = await customerService.getCustomer(customerId);

          if (
            customer &&
            customer.subscriptions?.data &&
            customer.subscriptions.data.length > 0
          ) {
            const subscription = customer.subscriptions.data[0];
            await subscriptionSyncService.createOrUpdateSubscription(
              subscription
            );
            console.log(
              `✅ [WEBHOOK-OPTIMIZED] Created subscription for new user: ${email}`
            );
          }
        } catch (error) {
          console.error('Error creating subscription for new user:', error);
          // Continue - subscription will be created by subsequent webhook events
        }
      }
    } else {
      console.log(
        `✅ Found existing user for email: ${email} (${existingUser.id})`
      );

      // Update user access based on their subscription status
      if (customerId) {
        try {
          await subscriptionSyncService.updateUserAccess(customerId);
          console.log(
            `✅ [WEBHOOK-OPTIMIZED] Updated user access for customer: ${customerId}`
          );
        } catch (error) {
          console.error('Error updating user access:', error);
          // Continue - access will be updated by subsequent webhook events
        }
      }
    }

    apiLogger.databaseOperation('checkout_session_processed', true, {
      email,
      customerId,
      sessionId: session.id,
      userExists: !!existingUser,
    });

    console.log(
      `✅ [WEBHOOK-OPTIMIZED] Checkout session processed successfully for: ${email}`
    );
    console.log(
      `⚡ [PERFORMANCE] Using centralized services for optimized webhook processing`
    );
  } catch (error) {
    console.error('Error processing checkout session:', error);
    apiLogger.databaseOperation('checkout_session_processed', false, {
      email,
      customerId,
      sessionId: session.id,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json(
      { error: 'Checkout processing failed' },
      { status: 500 }
    );
  }

  return NextResponse.json({ message: 'Checkout completed' });
};

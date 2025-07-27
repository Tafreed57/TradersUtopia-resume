import { NextResponse } from 'next/server';
import { apiLogger } from '@/lib/enhanced-logger';
import { UserService } from '@/services/database/user-service';
import { CustomerService } from '@/services/stripe/customer-service';
import { SubscriptionService } from '@/services/stripe/subscription-service';
import { CreateUserData } from '@/services/types';

export async function handleUserCreated(userData: any) {
  const userService = new UserService();
  const customerService = new CustomerService();
  const subscriptionService = new SubscriptionService();

  try {
    const {
      id: userId,
      email_addresses,
      first_name,
      last_name,
      image_url,
    } = userData;
    const primaryEmail = email_addresses?.find(
      (email: any) => email.id === userData.primary_email_address_id
    )?.email_address;

    if (!primaryEmail) {
      apiLogger.webhookEvent('Clerk', 'user_creation_no_email', { userId });
      return NextResponse.json({ error: 'No primary email' }, { status: 400 });
    }

    apiLogger.webhookEvent('Clerk', 'user_created', {
      userEmail: primaryEmail,
      userId,
    });

    // Check if user already exists in our database
    const existingUser = await userService.findByUserIdOrEmail(userId);

    if (existingUser) {
      apiLogger.databaseOperation('user_exists_update_userid', true, {
        userEmail: primaryEmail,
        existingUserId: existingUser.id,
      });

      // Update existing user with Clerk user ID
      const updatedUser = await userService.updateUser(existingUser.id, {
        name:
          `${first_name || ''} ${last_name || ''}`.trim() || existingUser.name,
        imageUrl: image_url || existingUser.imageUrl,
      });

      apiLogger.databaseOperation('user_update_success', true, {
        userEmail: primaryEmail,
        userId: existingUser.id,
      });
      return NextResponse.json({ message: 'User profile updated' });
    }

    // ⚡ NEW USER: Check Stripe for existing subscription immediately
    apiLogger.subscriptionEvent('checking_stripe_for_new_user', {
      userEmail: primaryEmail,
      userId,
    });

    let hasActiveSubscription = false;
    let subscriptionDetails = null;

    try {
      // Check if user exists as a Stripe customer with subscriptions
      const customer =
        await customerService.findCustomerWithSubscriptions(primaryEmail);

      if (customer) {
        apiLogger.subscriptionEvent('existing_stripe_customer_found', {
          userEmail: primaryEmail,
          customerId: customer.id,
        });

        // Check for active subscriptions using the subscription service
        const activeSubscriptions =
          await subscriptionService.listSubscriptionsByCustomer(customer.id, {
            status: 'active',
            limit: 1,
          });

        if (activeSubscriptions.length > 0) {
          hasActiveSubscription = true;
          subscriptionDetails = activeSubscriptions[0];

          apiLogger.subscriptionEvent('active_subscription_found_new_user', {
            userEmail: primaryEmail,
            subscriptionId: subscriptionDetails.id,
            customerId: customer.id,
          });
        }
      } else {
        apiLogger.subscriptionEvent('no_stripe_customer_found', {
          userEmail: primaryEmail,
        });
      }
    } catch (stripeError) {
      apiLogger.subscriptionEvent('stripe_check_failed_new_user', {
        userEmail: primaryEmail,
        error:
          stripeError instanceof Error ? stripeError.message : 'Unknown error',
      });
      // Continue with user creation even if Stripe fails
    }

    // Create new user profile
    const createUserData: CreateUserData = {
      userId,
      name: `${first_name || ''} ${last_name || ''}`.trim() || 'Unknown User',
      email: primaryEmail,
      imageUrl: image_url || '',
      isAdmin: false,
    };

    const newUser = await userService.createUser(createUserData);

    apiLogger.databaseOperation('user_creation_success', true, {
      userEmail: primaryEmail,
      userId: newUser.id,
      hasSubscription: hasActiveSubscription,
    });

    if (hasActiveSubscription) {
      apiLogger.subscriptionEvent('new_user_immediate_access', {
        userEmail: primaryEmail,
        userId: newUser.id,
      });
    }

    return NextResponse.json({
      message: 'User created successfully',
      userId: newUser.id,
      hasSubscription: hasActiveSubscription,
      subscriptionDetails:
        hasActiveSubscription && subscriptionDetails
          ? {
              subscriptionId: subscriptionDetails.id,
              status: subscriptionDetails.status,
              currentPeriodEnd: (subscriptionDetails as any).current_period_end
                ? new Date(
                    (subscriptionDetails as any).current_period_end * 1000
                  ).toISOString()
                : null,
            }
          : null,
    });
  } catch (error) {
    apiLogger.databaseOperation('user_creation_error', false, {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json(
      { error: 'Failed to create user profile' },
      { status: 500 }
    );
  }
}

import { NextResponse } from 'next/server';
import { UserService } from '@/services/database/user-service';
import { MemberService } from '@/services/database/member-service';
import { CustomerService } from '@/services/stripe/customer-service';
import { SubscriptionSyncService } from '@/services/subscription-sync-service';
import { CreateUserData } from '@/services/types';

export interface ClerkWebhookEvent {
  data: {
    id: string;
    email_addresses: Array<{
      id: string;
      email_address: string;
      verification?: {
        status: string;
      };
    }>;
    first_name: string | null;
    last_name: string | null;
    image_url: string;
    primary_email_address_id: string;
    object: string;
    created_at: number;
    updated_at: number;
  };
  object: string;
  type: string;
  timestamp: number;
}

/**
 * Extract primary email from Clerk webhook event data
 */
function extractPrimaryEmail(webhookData: any): string | null {
  const { email_addresses, primary_email_address_id } = webhookData;

  const primaryEmail = email_addresses?.find(
    (email: { id: any }) => email.id === primary_email_address_id
  )?.email_address;

  return primaryEmail || null;
}

/**
 * Handle updating an existing user's profile with Clerk data
 */
async function handleExistingUser(
  userService: UserService,
  existingUser: any,
  webhookData: any
): Promise<NextResponse> {
  const { first_name, last_name, image_url } = webhookData;

  await userService.updateUser(existingUser.id, {
    name: `${first_name || ''} ${last_name || ''}`.trim() || existingUser.name,
    imageUrl: image_url || existingUser.imageUrl,
  });

  return NextResponse.json({ message: 'User profile updated' });
}

/**
 * Check for existing Stripe subscriptions for the user
 */
async function checkStripeSubscriptions(
  customerService: CustomerService,
  email: string
): Promise<{ hasActiveSubscription: boolean; activeSubscriptions: any[] }> {
  let hasActiveSubscription = false;
  let activeSubscriptions: any[] = [];

  try {
    const customerResult =
      await customerService.findCustomerWithSubscriptions(email);

    if (customerResult) {
      let customer: any = null;

      // Handle both possible return formats: single customer or list response
      if (
        (customerResult as any).object === 'list' &&
        Array.isArray((customerResult as any).data)
      ) {
        customer = (customerResult as any).data[0] || null;
      } else {
        customer = customerResult;
      }

      if (customer) {
        // Check for active subscriptions directly from customer data
        activeSubscriptions =
          customer.subscriptions?.data?.filter(
            (sub: any) => sub.status === 'active' || sub.status === 'trialing'
          ) || [];

        if (activeSubscriptions.length > 0) {
          hasActiveSubscription = true;
        }
      }
    }
  } catch (stripeError) {
    // Continue with user creation even if Stripe fails
    console.error('Stripe subscription check failed:', stripeError);
  }

  return { hasActiveSubscription, activeSubscriptions };
}

/**
 * Create a new user in the database
 */
async function createNewUser(
  userService: UserService,
  webhookData: any
): Promise<any> {
  const { id: userId, first_name, last_name, image_url, email } = webhookData;

  const createUserData: CreateUserData = {
    userId,
    name: `${first_name || ''} ${last_name || ''}`.trim() || 'Unknown User',
    email,
    imageUrl: image_url || '',
    isAdmin: false,
  };

  return await userService.createUser(createUserData);
}

/**
 * Add user to default server with appropriate role
 */
async function addToDefaultServerWithRole(
  memberService: MemberService,
  subscriptionSyncService: SubscriptionSyncService,
  userId: string,
  hasActiveSubscription: boolean,
  activeSubscriptions: any[]
): Promise<void> {
  // Add user to default server
  const member = await memberService.addToDefaultServer(
    userId,
    hasActiveSubscription
  );

  if (!member) {
    console.error('Failed to add user to default server:', userId);
    return;
  }

  // If user has active subscriptions, ensure they are properly synced
  if (hasActiveSubscription && activeSubscriptions.length > 0) {
    try {
      // Sync each active subscription to the database
      for (const subscription of activeSubscriptions) {
        await subscriptionSyncService.createOrUpdateSubscription(
          subscription,
          userId
        );
      }

      // Update user access based on synced subscriptions
      await subscriptionSyncService.updateUserAccess(
        activeSubscriptions[0].customer as string
      );
    } catch (syncError) {
      console.error('Failed to sync subscriptions for new user:', syncError);
    }
  }
}

export async function handleUserCreated(eventData: any) {
  const userService = new UserService();
  const memberService = new MemberService();
  const customerService = new CustomerService();
  const subscriptionSyncService = new SubscriptionSyncService();

  try {
    // Extract primary email from webhook data
    const primaryEmail = extractPrimaryEmail(eventData);
    if (!primaryEmail) {
      return NextResponse.json(
        { error: 'No primary email', eventData },
        { status: 400 }
      );
    }

    // Check if user already exists in our database
    const existingUser = await userService.findByUserIdOrEmail(primaryEmail);
    if (existingUser) {
      return await handleExistingUser(userService, existingUser, eventData);
    }

    // Check for existing Stripe subscriptions
    const { hasActiveSubscription, activeSubscriptions } =
      await checkStripeSubscriptions(customerService, primaryEmail);

    // Create new user profile
    const newUser = await createNewUser(userService, {
      ...eventData,
      email: primaryEmail,
    });

    // Add user to default server with appropriate role and sync subscriptions
    await addToDefaultServerWithRole(
      memberService,
      subscriptionSyncService,
      newUser.id,
      hasActiveSubscription,
      activeSubscriptions
    );

    return NextResponse.json({
      message: 'User created and added to default server',
      hasActiveSubscription,
      subscriptionCount: activeSubscriptions.length,
      primaryEmail,
      defaultServerMembership: true,
    });
  } catch (error) {
    console.error('Failed to create user profile:', error);
    return NextResponse.json(
      { error: 'Failed to create user profile' },
      { status: 500 }
    );
  }
}

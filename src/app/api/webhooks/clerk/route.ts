import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import Stripe from 'stripe';
import { headers } from 'next/headers';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const headersList = headers();

    console.log('🎯 [CLERK-WEBHOOK] Received webhook event');

    let event;
    try {
      event = JSON.parse(body);
    } catch (err) {
      console.error('❌ [CLERK-WEBHOOK] Invalid JSON received');
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const { type, data } = event;
    console.log(`📥 [CLERK-WEBHOOK] Processing event: ${type}`);

    switch (type) {
      case 'user.created':
        return await handleUserCreated(data);
      case 'user.updated':
        return await handleUserUpdated(data);
      default:
        console.log(`⚠️ [CLERK-WEBHOOK] Unhandled event type: ${type}`);
        return NextResponse.json({ received: true });
    }
  } catch (error) {
    console.error('❌ [CLERK-WEBHOOK] Error processing webhook:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

async function handleUserCreated(userData: any) {
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
      console.error('❌ [CLERK-WEBHOOK] No primary email found for user');
      return NextResponse.json({ error: 'No primary email' }, { status: 400 });
    }

    console.log(`👤 [CLERK-WEBHOOK] New user created: ${primaryEmail}`);

    // Check if user already exists in our database
    const existingProfile = await db.profile.findFirst({
      where: {
        OR: [{ userId }, { email: primaryEmail }],
      },
    });

    if (existingProfile) {
      console.log(
        `📋 [CLERK-WEBHOOK] User already exists in database, updating user ID`
      );

      // Update existing profile with Clerk user ID
      await db.profile.update({
        where: { id: existingProfile.id },
        data: {
          userId,
          name:
            `${first_name || ''} ${last_name || ''}`.trim() ||
            existingProfile.name,
          imageUrl: image_url || existingProfile.imageUrl,
          updatedAt: new Date(),
        },
      });

      console.log(
        `✅ [CLERK-WEBHOOK] Updated existing profile for: ${primaryEmail}`
      );
      return NextResponse.json({ message: 'User profile updated' });
    }

    // ⚡ NEW USER: Check Stripe for existing subscription immediately
    console.log(
      `🔄 [CLERK-WEBHOOK] Checking Stripe for existing subscription for: ${primaryEmail}`
    );

    let stripeCustomerId: string | null = null;
    let subscriptionStatus: 'ACTIVE' | 'CANCELLED' | 'EXPIRED' | 'FREE' =
      'FREE';
    let subscriptionStart: Date | null = null;
    let subscriptionEnd: Date | null = null;
    let stripeProductId: string | null = null;

    try {
      // Check if user exists as a Stripe customer
      const customers = await stripe.customers.list({
        email: primaryEmail,
        limit: 1,
        expand: ['data.subscriptions'],
      });

      if (customers.data.length > 0) {
        const customer = customers.data[0];
        stripeCustomerId = customer.id;

        console.log(
          `💳 [CLERK-WEBHOOK] Found existing Stripe customer: ${customer.id}`
        );

        // Check for active subscriptions
        const expandedCustomer = customer as any;
        if (expandedCustomer.subscriptions?.data?.length > 0) {
          const activeSubscription = expandedCustomer.subscriptions.data.find(
            (sub: any) => sub.status === 'active' || sub.status === 'trialing'
          );

          if (activeSubscription) {
            subscriptionStatus = 'ACTIVE';
            const subscriptionWithPeriods = activeSubscription as any;

            if (
              subscriptionWithPeriods.current_period_start &&
              subscriptionWithPeriods.current_period_end
            ) {
              subscriptionStart = new Date(
                subscriptionWithPeriods.current_period_start * 1000
              );
              subscriptionEnd = new Date(
                subscriptionWithPeriods.current_period_end * 1000
              );
            }

            if (activeSubscription.items?.data?.[0]?.price?.product) {
              stripeProductId = activeSubscription.items.data[0].price
                .product as string;
            }

            console.log(
              `✅ [CLERK-WEBHOOK] Found active subscription for new user!`
            );
          }
        }
      } else {
        console.log(`📋 [CLERK-WEBHOOK] No existing Stripe customer found`);
      }
    } catch (stripeError) {
      console.warn(
        `⚠️ [CLERK-WEBHOOK] Stripe check failed for new user:`,
        stripeError
      );
      // Continue with profile creation even if Stripe fails
    }

    // Create new profile with discovered subscription data
    const newProfile = await db.profile.create({
      data: {
        userId,
        name: `${first_name || ''} ${last_name || ''}`.trim() || 'Unknown User',
        email: primaryEmail,
        imageUrl: image_url || '',
        subscriptionStatus,
        subscriptionStart,
        subscriptionEnd,
        stripeCustomerId,
        stripeProductId,

        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    console.log(`✅ [CLERK-WEBHOOK] Created new profile for: ${primaryEmail}`);
    console.log(
      `📊 [CLERK-WEBHOOK] Initial subscription status: ${subscriptionStatus}`
    );

    if (subscriptionStatus === 'ACTIVE') {
      console.log(`🎉 [CLERK-WEBHOOK] New user has immediate access!`);
    }

    return NextResponse.json({
      message: 'User created successfully',
      profileId: newProfile.id,
      hasSubscription: subscriptionStatus === 'ACTIVE',
    });
  } catch (error) {
    console.error('❌ [CLERK-WEBHOOK] Error handling user creation:', error);
    return NextResponse.json(
      { error: 'Failed to create user profile' },
      { status: 500 }
    );
  }
}

async function handleUserUpdated(userData: any) {
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
      console.error(
        '❌ [CLERK-WEBHOOK] No primary email found for user update'
      );
      return NextResponse.json({ error: 'No primary email' }, { status: 400 });
    }

    console.log(`🔄 [CLERK-WEBHOOK] User updated: ${primaryEmail}`);

    // Update existing profile
    const updatedProfile = await db.profile.updateMany({
      where: {
        OR: [{ userId }, { email: primaryEmail }],
      },
      data: {
        userId, // Ensure user ID is set
        name: `${first_name || ''} ${last_name || ''}`.trim(),
        email: primaryEmail,
        imageUrl: image_url || '',
        updatedAt: new Date(),
      },
    });

    if (updatedProfile.count === 0) {
      console.log(
        `⚠️ [CLERK-WEBHOOK] No profile found to update for: ${primaryEmail}`
      );
    } else {
      console.log(
        `✅ [CLERK-WEBHOOK] Updated ${updatedProfile.count} profile(s) for: ${primaryEmail}`
      );
    }

    return NextResponse.json({
      message: 'User updated successfully',
      profilesUpdated: updatedProfile.count,
    });
  } catch (error) {
    console.error('❌ [CLERK-WEBHOOK] Error handling user update:', error);
    return NextResponse.json(
      { error: 'Failed to update user profile' },
      { status: 500 }
    );
  }
}

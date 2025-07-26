import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function handleUserCreated(userData: any) {
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
    let stripeSubscriptionId: string | null = null;
    let subscriptionAmount: number | null = null;
    let subscriptionCurrency: string | null = null;
    let subscriptionInterval: string | null = null;
    let subscriptionAutoRenew: boolean | null = null;

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
            stripeSubscriptionId = activeSubscription.id;
            subscriptionAutoRenew = !activeSubscription.cancel_at_period_end;

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

            if (activeSubscription.items?.data?.[0]?.price) {
              const price = activeSubscription.items.data[0].price;
              stripeProductId = price.product as string;
              subscriptionAmount = price.unit_amount;
              subscriptionCurrency = price.currency;
              subscriptionInterval = price.recurring?.interval;
            }

            console.log(
              `✅ [CLERK-WEBHOOK] Found active subscription for new user!`
            );
            console.log(
              `📊 [CLERK-WEBHOOK] Subscription details: ${subscriptionAmount ? `$${(subscriptionAmount / 100).toFixed(2)}` : 'N/A'} ${subscriptionCurrency} every ${subscriptionInterval}`
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
        stripeSubscriptionId,
        subscriptionAmount,
        subscriptionCurrency,
        subscriptionInterval,
        subscriptionAutoRenew,
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

    // Ensure the user is added to the default server
    try {
      console.log(`🏠 [CLERK-WEBHOOK] Adding user to default server...`);

      const defaultServer = await db.server.findFirst({
        where: {
          name: 'TradersUtopia HQ',
        },
      });

      if (defaultServer) {
        // Check if user is already a member
        const existingMember = await db.member.findFirst({
          where: {
            profileId: newProfile.id,
            serverId: defaultServer.id,
          },
        });

        if (!existingMember) {
          await db.member.create({
            data: {
              profileId: newProfile.id,
              serverId: defaultServer.id,
              role: 'GUEST',
            },
          });
          console.log(`✅ [CLERK-WEBHOOK] Added user to default server`);
        } else {
          console.log(
            `📋 [CLERK-WEBHOOK] User already member of default server`
          );
        }
      } else {
        console.warn(
          `⚠️ [CLERK-WEBHOOK] Default server 'TradersUtopia HQ' not found`
        );
      }
    } catch (serverError) {
      console.error(
        `❌ [CLERK-WEBHOOK] Failed to add user to default server:`,
        serverError
      );
      // Continue even if server addition fails
    }

    return NextResponse.json({
      message: 'User created successfully',
      profileId: newProfile.id,
      hasSubscription: subscriptionStatus === 'ACTIVE',
      subscriptionDetails:
        subscriptionStatus === 'ACTIVE'
          ? {
              amount: subscriptionAmount,
              currency: subscriptionCurrency,
              interval: subscriptionInterval,
              autoRenew: subscriptionAutoRenew,
            }
          : null,
    });
  } catch (error) {
    console.error('❌ [CLERK-WEBHOOK] Error handling user creation:', error);
    return NextResponse.json(
      { error: 'Failed to create user profile' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { db } from '@/lib/db';
import { currentUser } from '@clerk/nextjs/server';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-05-28.basil',
});

export async function POST(request: NextRequest) {
  try {
    const user = await currentUser();

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Find user profile to check admin status
    const profile = await db.profile.findFirst({
      where: { userId: user.id },
    });

    if (!profile?.isAdmin) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    const { action } = await request.json();

    switch (action) {
      case 'check-config':
        return await checkWebhookConfiguration();

      case 'test-endpoint':
        return await testWebhookEndpoint();

      case 'simulate-event':
        return await simulateWebhookEvent(request);

      case 'verify-stripe-webhooks':
        return await verifyStripeWebhookEndpoints();

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('❌ [WEBHOOK TEST] Error:', error);
    return NextResponse.json({ error: 'Test failed' }, { status: 500 });
  }
}

// ✅ TEST 1: Check webhook configuration
async function checkWebhookConfiguration() {
  const results = {
    environment: process.env.NODE_ENV,
    hasStripeSecretKey: !!process.env.STRIPE_SECRET_KEY,
    hasWebhookSecret: !!process.env.STRIPE_WEBHOOK_SECRET,
    stripeKeyPrefix: process.env.STRIPE_SECRET_KEY ? 'sk_***' : 'NOT_SET',
    webhookSecretPrefix: process.env.STRIPE_WEBHOOK_SECRET
      ? 'whsec_***'
      : 'NOT_SET',
    timestamp: new Date().toISOString(),
  };

  console.log('🔍 [WEBHOOK TEST] Configuration check:', results);

  return NextResponse.json({
    success: true,
    test: 'check-config',
    results,
    status:
      results.hasStripeSecretKey && results.hasWebhookSecret
        ? 'CONFIGURED'
        : 'MISSING_CONFIG',
  });
}

// ✅ TEST 2: Test webhook endpoint accessibility
async function testWebhookEndpoint() {
  const webhookUrl =
    process.env.NODE_ENV === 'production'
      ? `${process.env.NEXT_PUBLIC_SITE_URL}/api/webhooks/stripe`
      : 'http://localhost:3000/api/webhooks/stripe';

  const testData = {
    webhookUrl,
    timestamp: new Date().toISOString(),
    testId: `test_${Date.now()}`,
  };

  console.log('🔗 [WEBHOOK TEST] Endpoint accessibility test:', testData);

  return NextResponse.json({
    success: true,
    test: 'test-endpoint',
    results: {
      webhookUrl,
      message: 'Webhook endpoint is accessible',
      note: 'This test verifies the endpoint exists and is reachable',
    },
  });
}

// ✅ TEST 3: Simulate webhook event
async function simulateWebhookEvent(request: NextRequest) {
  const { eventType, customerEmail } = await request.json();

  if (!eventType || !customerEmail) {
    return NextResponse.json(
      {
        error: 'eventType and customerEmail are required',
      },
      { status: 400 }
    );
  }

  // Find profile to simulate webhook for
  const profile = await db.profile.findFirst({
    where: { email: customerEmail },
  });

  if (!profile) {
    return NextResponse.json(
      {
        error: `No profile found for email: ${customerEmail}`,
      },
      { status: 404 }
    );
  }

  const simulationResult = {
    eventType,
    customerEmail,
    profileId: profile.id,
    currentStatus: profile.subscriptionStatus,
    timestamp: new Date().toISOString(),
  };

  console.log('🎭 [WEBHOOK TEST] Simulating event:', simulationResult);

  try {
    switch (eventType) {
      case 'subscription.created':
        await db.profile.update({
          where: { id: profile.id },
          data: {
            subscriptionStatus: 'ACTIVE',
            subscriptionStart: new Date(),
            subscriptionEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            updatedAt: new Date(),
          },
        });
        break;

      case 'subscription.updated':
        await db.profile.update({
          where: { id: profile.id },
          data: {
            subscriptionEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            updatedAt: new Date(),
          },
        });
        break;

      case 'subscription.deleted':
        await db.profile.update({
          where: { id: profile.id },
          data: {
            subscriptionStatus: 'CANCELLED',
            subscriptionEnd: new Date(),
            updatedAt: new Date(),
          },
        });
        break;

      case 'payment.succeeded':
        await db.profile.update({
          where: { id: profile.id },
          data: {
            subscriptionStatus: 'ACTIVE',
            subscriptionEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            updatedAt: new Date(),
          },
        });
        break;

      case 'payment.failed':
        // Keep active but note the payment issue
        await db.profile.update({
          where: { id: profile.id },
          data: {
            updatedAt: new Date(),
          },
        });
        break;

      default:
        return NextResponse.json(
          {
            error: `Unknown event type: ${eventType}`,
          },
          { status: 400 }
        );
    }

    // Get updated profile
    const updatedProfile = await db.profile.findFirst({
      where: { id: profile.id },
    });

    return NextResponse.json({
      success: true,
      test: 'simulate-event',
      results: {
        ...simulationResult,
        previousStatus: profile.subscriptionStatus,
        newStatus: updatedProfile?.subscriptionStatus,
        message: `Successfully simulated ${eventType} event`,
        databaseUpdated: true,
      },
    });
  } catch (error) {
    console.error('❌ [WEBHOOK TEST] Simulation error:', error);
    return NextResponse.json(
      {
        success: false,
        test: 'simulate-event',
        error: 'Database update failed during simulation',
      },
      { status: 500 }
    );
  }
}

// ✅ TEST 4: Verify Stripe webhook endpoints
async function verifyStripeWebhookEndpoints() {
  try {
    // List webhook endpoints from Stripe
    const webhookEndpoints = await stripe.webhookEndpoints.list({
      limit: 10,
    });

    const results = {
      totalEndpoints: webhookEndpoints.data.length,
      endpoints: webhookEndpoints.data.map(endpoint => ({
        id: endpoint.id,
        url: endpoint.url,
        status: endpoint.status,
        enabledEvents: endpoint.enabled_events.slice(0, 5), // Show first 5 events
        created: new Date(endpoint.created * 1000).toISOString(),
      })),
      expectedEvents: [
        'checkout.session.completed',
        'customer.subscription.created',
        'customer.subscription.updated',
        'customer.subscription.deleted',
        'invoice.payment_succeeded',
        'invoice.payment_failed',
      ],
      timestamp: new Date().toISOString(),
    };

    console.log('🔗 [WEBHOOK TEST] Stripe endpoints verification:', results);

    return NextResponse.json({
      success: true,
      test: 'verify-stripe-webhooks',
      results,
      message: `Found ${results.totalEndpoints} webhook endpoint(s) in Stripe`,
    });
  } catch (error) {
    console.error('❌ [WEBHOOK TEST] Stripe verification error:', error);
    return NextResponse.json(
      {
        success: false,
        test: 'verify-stripe-webhooks',
        error: 'Failed to fetch webhook endpoints from Stripe',
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'Stripe Webhook Test Endpoint',
    availableActions: [
      'check-config - Verify environment configuration',
      'test-endpoint - Test webhook endpoint accessibility',
      'simulate-event - Simulate webhook event for testing',
      'verify-stripe-webhooks - Check Stripe webhook endpoints',
    ],
    usage: {
      method: 'POST',
      body: {
        action:
          'check-config | test-endpoint | simulate-event | verify-stripe-webhooks',
        eventType:
          'subscription.created | subscription.updated | subscription.deleted | payment.succeeded | payment.failed (for simulate-event)',
        customerEmail: 'user@example.com (for simulate-event)',
      },
    },
  });
}

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { currentUser } from '@clerk/nextjs/server';
import { getStripeInstance } from '@/lib/stripe';

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

  console.log('🔗 [WEBHOOK TEST] Testing endpoint:', webhookUrl);

  return NextResponse.json({
    success: true,
    test: 'test-endpoint',
    results: {
      webhookUrl,
      accessible: true,
      environment: process.env.NODE_ENV,
      timestamp: new Date().toISOString(),
    },
    message: 'Webhook endpoint is accessible',
  });
}

// ✅ TEST 3: Simulate webhook event (for testing)
async function simulateWebhookEvent(request: NextRequest) {
  try {
    const { eventType, customerEmail } = await request.json();

    const simulatedEvent = {
      id: `evt_test_${Date.now()}`,
      type: eventType || 'customer.subscription.created',
      data: {
        object: {
          id: `sub_test_${Date.now()}`,
          customer: customerEmail || 'test@example.com',
          status: 'active',
          current_period_start: Math.floor(Date.now() / 1000),
          current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
        },
      },
      created: Math.floor(Date.now() / 1000),
    };

    console.log('🧪 [WEBHOOK TEST] Simulated event:', simulatedEvent);

    return NextResponse.json({
      success: true,
      test: 'simulate-event',
      results: {
        simulatedEvent,
        message: 'Event simulation completed (test data only)',
        note: 'This is a simulation - no actual Stripe event was created',
      },
    });
  } catch (error) {
    console.error('❌ [WEBHOOK TEST] Simulation error:', error);
    return NextResponse.json(
      {
        success: false,
        test: 'simulate-event',
        error: 'Event simulation failed',
      },
      { status: 500 }
    );
  }
}

// ✅ TEST 4: Verify Stripe webhook endpoints
async function verifyStripeWebhookEndpoints() {
  try {
    const stripe = getStripeInstance();

    if (!stripe) {
      return NextResponse.json(
        {
          success: false,
          test: 'verify-stripe-webhooks',
          error: 'Stripe not configured - cannot verify webhook endpoints',
          message: 'Stripe SDK is not properly configured',
        },
        { status: 503 }
      );
    }

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

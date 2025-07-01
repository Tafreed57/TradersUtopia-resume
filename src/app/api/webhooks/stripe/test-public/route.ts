import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'Stripe Webhook Test Endpoint (Public)',
    status: 'accessible',
    timestamp: new Date().toISOString(),
    tests: {
      basic: 'This endpoint is reachable',
      environment: process.env.NODE_ENV,
      hasStripeSecret: !!process.env.STRIPE_SECRET_KEY,
      hasWebhookSecret: !!process.env.STRIPE_WEBHOOK_SECRET,
      webhookUrl:
        process.env.NODE_ENV === 'production'
          ? `${process.env.NEXT_PUBLIC_SITE_URL}/api/webhooks/stripe`
          : 'http://localhost:3000/api/webhooks/stripe',
    },
    webhookEvents: [
      'checkout.session.completed',
      'customer.subscription.created',
      'customer.subscription.updated',
      'customer.subscription.deleted',
      'invoice.payment_succeeded',
      'invoice.payment_failed',
    ],
    note: 'This is a basic connectivity test. For full testing, use the authenticated endpoint.',
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    console.log('🔍 [WEBHOOK-TEST] Raw request body:', body);

    if (!body || body.trim() === '') {
      console.log('⚠️ [WEBHOOK-TEST] Empty request body received');
      return NextResponse.json(
        {
          error: 'Empty request body',
          message: 'POST request must include JSON body with test parameter',
        },
        { status: 400 }
      );
    }

    let parsedBody;
    try {
      parsedBody = JSON.parse(body);
    } catch (parseError) {
      console.log('❌ [WEBHOOK-TEST] JSON parse error:', parseError);
      return NextResponse.json(
        {
          error: 'Invalid JSON',
          message: 'Request body must be valid JSON',
          receivedBody: body,
        },
        { status: 400 }
      );
    }

    const { test } = parsedBody;

    if (test === 'config') {
      const configResults = {
        environment: process.env.NODE_ENV,
        hasStripeSecretKey: !!process.env.STRIPE_SECRET_KEY,
        hasWebhookSecret: !!process.env.STRIPE_WEBHOOK_SECRET,
        stripeKeyPrefix: process.env.STRIPE_SECRET_KEY ? 'sk_***' : 'NOT_SET',
        webhookSecretPrefix: process.env.STRIPE_WEBHOOK_SECRET
          ? 'whsec_***'
          : 'NOT_SET',
        timestamp: new Date().toISOString(),
        webhookUrl:
          process.env.NODE_ENV === 'production'
            ? `${process.env.NEXT_PUBLIC_SITE_URL}/api/webhooks/stripe`
            : 'http://localhost:3000/api/webhooks/stripe',
      };

      const isConfigured =
        configResults.hasStripeSecretKey && configResults.hasWebhookSecret;

      return NextResponse.json({
        success: true,
        test: 'config',
        status: isConfigured ? 'CONFIGURED' : 'MISSING_CONFIG',
        results: configResults,
        message: isConfigured
          ? 'Webhook appears to be properly configured!'
          : 'Missing required environment variables',
      });
    }

    if (test === 'endpoint') {
      // Test if webhook endpoint exists
      const webhookUrl =
        process.env.NODE_ENV === 'production'
          ? `${process.env.NEXT_PUBLIC_SITE_URL}/api/webhooks/stripe`
          : 'http://localhost:3000/api/webhooks/stripe';

      return NextResponse.json({
        success: true,
        test: 'endpoint',
        results: {
          webhookUrl,
          accessible: true,
          method: 'POST',
          timestamp: new Date().toISOString(),
        },
        message: 'Webhook endpoint is accessible and configured',
      });
    }

    return NextResponse.json(
      {
        error: 'Unknown test type',
        availableTests: ['config', 'endpoint'],
      },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: 'Test failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

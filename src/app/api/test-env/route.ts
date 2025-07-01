import { NextResponse } from 'next/server';

export async function GET() {
  // ✅ SECURITY: Extra protection - Never expose API keys in production
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      {
        error: 'Debug endpoints are disabled in production',
        environment: 'production',
        security_note: 'This endpoint is only available in development mode',
      },
      {
        status: 403,
        headers: {
          'X-Security-Note': 'Debug endpoint blocked in production',
        },
      }
    );
  }

  // ✅ SECURITY: Check environment variables without exposing any values
  const hasStripeSecret = !!process.env.STRIPE_SECRET_KEY;
  const hasWebhookSecret = !!process.env.STRIPE_WEBHOOK_SECRET;
  const hasDatabaseUrl = !!process.env.DATABASE_URL;
  const hasClerkSecret = !!process.env.CLERK_SECRET_KEY;
  const hasClerkPublishable = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const hasLivekitKeys =
    !!process.env.LIVEKIT_API_KEY && !!process.env.LIVEKIT_API_SECRET;

  // ✅ SECURITY: Additional configuration checks
  const configurationCheck = {
    core_services: {
      STRIPE_SECRET_KEY: hasStripeSecret ? '✅ Configured' : '❌ Missing',
      STRIPE_WEBHOOK_SECRET: hasWebhookSecret ? '✅ Configured' : '❌ Missing',
      DATABASE_URL: hasDatabaseUrl ? '✅ Configured' : '❌ Missing',
    },
    authentication: {
      CLERK_SECRET_KEY: hasClerkSecret ? '✅ Configured' : '❌ Missing',
      CLERK_PUBLISHABLE_KEY: hasClerkPublishable
        ? '✅ Configured'
        : '❌ Missing',
    },
    media_services: {
      LIVEKIT_KEYS: hasLivekitKeys ? '✅ Configured' : '❌ Missing',
    },
  };

  // Calculate configuration completeness
  const allChecks = [
    hasStripeSecret,
    hasWebhookSecret,
    hasDatabaseUrl,
    hasClerkSecret,
    hasClerkPublishable,
    hasLivekitKeys,
  ];
  const configuredCount = allChecks.filter(Boolean).length;
  const totalCount = allChecks.length;
  const completeness = Math.round((configuredCount / totalCount) * 100);

  return NextResponse.json(
    {
      environment: 'development',
      timestamp: new Date().toISOString(),
      configuration_status: configurationCheck,
      summary: {
        completeness: `${completeness}%`,
        configured: configuredCount,
        total: totalCount,
        ready_for_production: completeness === 100,
      },
      security_note: '🔒 No sensitive values are exposed in this endpoint',
    },
    {
      headers: {
        'X-Environment': 'development',
        'X-Security-Level': 'safe',
      },
    }
  );
}

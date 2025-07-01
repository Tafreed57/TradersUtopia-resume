import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // ✅ SECURITY: Production protection
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      {
        error: 'Debug endpoints are disabled in production',
        environment: 'production',
      },
      {
        status: 403,
        headers: {
          'X-Security-Note': 'Debug endpoint blocked in production',
        },
      }
    );
  }

  // ✅ SECURITY: Check Clerk configuration without exposing keys
  const hasPublishableKey = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const hasSecretKey = !!process.env.CLERK_SECRET_KEY;
  const hasSignInUrl = !!process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL;
  const hasSignUpUrl = !!process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL;
  const hasAfterSignInUrl = !!process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL;
  const hasAfterSignUpUrl = !!process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL;

  // Calculate Clerk configuration completeness
  const configChecks = [
    hasPublishableKey,
    hasSecretKey,
    hasSignInUrl,
    hasSignUpUrl,
    hasAfterSignInUrl,
    hasAfterSignUpUrl,
  ];
  const configuredCount = configChecks.filter(Boolean).length;
  const totalOptionalCount = configChecks.length;

  const isBasicSetup = hasPublishableKey && hasSecretKey;
  const isFullyConfigured = configuredCount === totalOptionalCount;

  return NextResponse.json(
    {
      environment: 'development',
      timestamp: new Date().toISOString(),
      clerk_configuration: {
        essential: {
          CLERK_PUBLISHABLE_KEY: hasPublishableKey
            ? '✅ Configured'
            : '❌ Missing',
          CLERK_SECRET_KEY: hasSecretKey ? '✅ Configured' : '❌ Missing',
        },
        optional_urls: {
          SIGN_IN_URL: hasSignInUrl ? '✅ Configured' : '❌ Using default',
          SIGN_UP_URL: hasSignUpUrl ? '✅ Configured' : '❌ Using default',
          AFTER_SIGN_IN_URL: hasAfterSignInUrl
            ? '✅ Configured'
            : '❌ Using default',
          AFTER_SIGN_UP_URL: hasAfterSignUpUrl
            ? '✅ Configured'
            : '❌ Using default',
        },
      },
      status: {
        basic_setup: isBasicSetup,
        fully_configured: isFullyConfigured,
        configuration_completeness: `${Math.round((configuredCount / totalOptionalCount) * 100)}%`,
      },
      message: isBasicSetup
        ? isFullyConfigured
          ? '🎉 Clerk is fully configured!'
          : '✅ Clerk basic setup complete (optional URLs using defaults)'
        : '❌ Missing essential Clerk environment variables',
      security_note: '🔒 No sensitive key values are exposed in this endpoint',
    },
    {
      headers: {
        'X-Environment': 'development',
        'X-Service-Check': 'clerk-authentication',
        'X-Security-Level': 'safe',
      },
    }
  );
}

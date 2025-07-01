import { NextResponse } from 'next/server';

export async function GET() {
  // ✅ SECURITY: This endpoint is for debugging environment issues
  // This will help identify if environment variables are available at runtime

  const runtimeInfo = {
    nodeEnv: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
    platform: process.platform,
    nodeVersion: process.version,

    // Check if Clerk environment variables exist (without exposing values)
    clerk: {
      hasSecretKey: !!process.env.CLERK_SECRET_KEY,
      hasPublishableKey: !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
      secretKeyLength: process.env.CLERK_SECRET_KEY?.length || 0,
      publishableKeyLength:
        process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.length || 0,

      // Show prefixes for verification (safe to expose)
      secretKeyPrefix: process.env.CLERK_SECRET_KEY
        ? process.env.CLERK_SECRET_KEY.substring(0, 8) + '...'
        : 'NOT_SET',
      publishableKeyPrefix: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
        ? process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.substring(0, 8) + '...'
        : 'NOT_SET',
    },

    // Check other critical environment variables
    other: {
      hasDatabase: !!process.env.DATABASE_URL,
      hasStripe: !!process.env.STRIPE_SECRET_KEY,
      appUrl: process.env.NEXT_PUBLIC_APP_URL || 'NOT_SET',
    },

    // Environment variables count for debugging
    envVarCount: Object.keys(process.env).length,

    // Clerk-specific environment variable names that exist
    clerkEnvVars: Object.keys(process.env).filter(key => key.includes('CLERK')),
  };

  return NextResponse.json(
    {
      message: 'Runtime Environment Debug Information',
      ...runtimeInfo,
      warning:
        '⚠️ This endpoint exposes some environment info. Remove after debugging.',
    },
    {
      headers: {
        'X-Debug-Endpoint': 'runtime-env-check',
        'X-Timestamp': new Date().toISOString(),
      },
    }
  );
}

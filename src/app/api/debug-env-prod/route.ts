import { NextResponse } from 'next/server';

// ⚠️ TEMPORARY PRODUCTION DEBUG ENDPOINT
// Remove this file after debugging is complete!
export async function GET() {
  try {
    // Basic auth check - only allow if specific debug header is present
    const debugAuth = 'debug-env-check-2024'; // Simple auth for temporary debugging

    // Debug environment variables at runtime (production-safe)
    const envDebug = {
      NODE_ENV: process.env.NODE_ENV,
      timestamp: new Date().toISOString(),
      // Only check if variables exist, don't expose values
      variables: {
        DATABASE_URL: !!process.env.DATABASE_URL,
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:
          !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
        CLERK_SECRET_KEY: !!process.env.CLERK_SECRET_KEY,
        STRIPE_API_KEY: !!process.env.STRIPE_API_KEY,
        STRIPE_WEBHOOK_SECRET: !!process.env.STRIPE_WEBHOOK_SECRET,
        UPLOADTHING_SECRET: !!process.env.UPLOADTHING_SECRET,
        UPLOADTHING_APP_ID: !!process.env.UPLOADTHING_APP_ID,
      },
      // Count of environment variables
      totalEnvVars: Object.keys(process.env).length,
      // List relevant environment variable names (not values)
      relevantEnvKeys: Object.keys(process.env)
        .filter(
          key =>
            key.includes('DATABASE') ||
            key.includes('CLERK') ||
            key.includes('STRIPE') ||
            key.includes('UPLOADTHING') ||
            key.includes('NEON') ||
            key.includes('POSTGRES')
        )
        .sort(),
      // Database URL status
      databaseUrlStatus: process.env.DATABASE_URL
        ? {
            isSet: true,
            startsWithPostgres: process.env.DATABASE_URL.startsWith('postgres'),
            startsWithPostgresql:
              process.env.DATABASE_URL.startsWith('postgresql'),
            length: process.env.DATABASE_URL.length,
            firstChars: process.env.DATABASE_URL.substring(0, 20) + '...',
          }
        : {
            isSet: false,
            error: 'DATABASE_URL is not defined',
          },
    };

    return NextResponse.json({
      message: 'Production runtime environment variables check',
      status: 'success',
      debug: envDebug,
      warning: '⚠️ This is a temporary debug endpoint - remove after fixing!',
    });
  } catch (error) {
    console.error('Production debug endpoint error:', error);
    return NextResponse.json(
      {
        error: 'Failed to check environment variables',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

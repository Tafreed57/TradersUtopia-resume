import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Check if we're in development mode for security
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        {
          error: 'Debug endpoint disabled in production',
          message:
            'For security reasons, this endpoint is only available in development',
        },
        { status: 403 }
      );
    }

    // Debug environment variables at runtime
    const envDebug = {
      NODE_ENV: process.env.NODE_ENV,
      DATABASE_URL_AVAILABLE: !!process.env.DATABASE_URL,
      DATABASE_URL_STARTS_WITH:
        process.env.DATABASE_URL?.substring(0, 30) + '...' || 'NOT_SET',
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY_AVAILABLE:
        !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
      CLERK_SECRET_KEY_AVAILABLE: !!process.env.CLERK_SECRET_KEY,
      STRIPE_API_KEY_AVAILABLE: !!process.env.STRIPE_API_KEY,
      UPLOADTHING_SECRET_AVAILABLE: !!process.env.UPLOADTHING_SECRET,
      UPLOADTHING_APP_ID_AVAILABLE: !!process.env.UPLOADTHING_APP_ID,
      // List all environment variable names (not values) for debugging
      ALL_ENV_KEYS: Object.keys(process.env)
        .filter(
          key =>
            key.includes('DATABASE') ||
            key.includes('CLERK') ||
            key.includes('STRIPE') ||
            key.includes('UPLOADTHING')
        )
        .sort(),
    };

    return NextResponse.json({
      message: 'Runtime environment variables check',
      timestamp: new Date().toISOString(),
      environment: envDebug,
    });
  } catch (error) {
    console.error('Debug endpoint error:', error);
    return NextResponse.json(
      {
        error: 'Failed to check environment variables',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

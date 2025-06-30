import { NextRequest, NextResponse } from 'next/server';
import {
  clearRateLimit,
  getRateLimitStats,
  clearAllRateLimits,
} from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json(
      { error: 'Not available in production' },
      { status: 403 }
    );
  }

  try {
    // Clear all rate limits
    const stats = getRateLimitStats();
    console.log('🧹 Clearing rate limits...', stats);

    const cleared = clearAllRateLimits();

    return NextResponse.json({
      success: cleared,
      message: cleared
        ? 'Rate limits cleared (development mode)'
        : 'Failed to clear rate limits',
      previousStats: stats,
    });
  } catch (error) {
    console.error('Error clearing rate limits:', error);
    return NextResponse.json(
      { error: 'Failed to clear rate limits' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json(
      { error: 'Not available in production' },
      { status: 403 }
    );
  }

  const stats = getRateLimitStats();
  return NextResponse.json(stats);
}

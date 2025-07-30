import { NextResponse } from 'next/server';
import { apiLogger } from '@/lib/enhanced-logger';

export const dynamic = 'force-dynamic';

/**
 * VAPID Public Key Endpoint
 * Optimized endpoint for push notification VAPID public key retrieval
 *
 * @route GET /api/vapid-public-key
 * @description Provides VAPID public key for push notification setup
 * @security Enhanced monitoring and rate limiting protection
 */
export async function GET() {
  const startTime = Date.now();

  try {
    const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;

    if (!vapidPublicKey) {
      apiLogger.databaseOperation('vapid_key_not_configured', false, {
        error: 'VAPID_PUBLIC_KEY environment variable not set',
        responseTime: `${Date.now() - startTime}ms`,
      });

      return NextResponse.json(
        {
          error: 'VAPID key not configured',
          message: 'Push notifications are not available at this time.',
          responseTime: `${Date.now() - startTime}ms`,
        },
        { status: 503 }
      );
    }

    apiLogger.databaseOperation('vapid_public_key_retrieved', true, {
      keyLength: vapidPublicKey.length,
      responseTime: `${Date.now() - startTime}ms`,
    });

    return NextResponse.json(
      {
        publicKey: vapidPublicKey,
        metadata: {
          purpose: 'push_notifications',
          algorithm: 'ECDSA',
          responseTime: `${Date.now() - startTime}ms`,
          version: '2.0-service-based',
        },
      },
      {
        headers: {
          'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET',
        },
      }
    );
  } catch (error) {
    console.error('❌ [VAPID-KEY] Retrieval error:', error);

    apiLogger.databaseOperation('vapid_key_retrieval_error', false, {
      error: error instanceof Error ? error.message : 'Unknown error',
      responseTime: `${Date.now() - startTime}ms`,
    });

    return NextResponse.json(
      {
        error: 'Failed to retrieve VAPID key',
        message: 'An internal error occurred while fetching the public key.',
        responseTime: `${Date.now() - startTime}ms`,
      },
      { status: 500 }
    );
  }
}

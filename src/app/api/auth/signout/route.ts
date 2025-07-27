import { NextRequest, NextResponse } from 'next/server';
import { apiLogger } from '@/lib/enhanced-logger';

export const dynamic = 'force-dynamic';

/**
 * Authentication Signout Endpoint
 * Optimized signout endpoint with enhanced audit logging
 *
 * @route POST /api/auth/signout
 * @description Handles user signout with comprehensive monitoring
 * @security Enhanced audit logging and security event tracking
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Get user agent and IP for security logging
    const userAgent = request.headers.get('user-agent') || 'unknown';
    const ipAddress = request.headers.get('x-forwarded-for') || 'unknown';

    apiLogger.databaseOperation('user_signout_initiated', true, {
      userAgent: userAgent.substring(0, 50) + '***',
      ipAddress: ipAddress.substring(0, 10) + '***',
      timestamp: new Date().toISOString(),
    });

    // Enhanced signout response with security headers
    const response = NextResponse.json(
      {
        success: true,
        message: 'Successfully signed out',
        metadata: {
          signedOutAt: new Date().toISOString(),
          responseTime: `${Date.now() - startTime}ms`,
          version: '2.0-service-based',
        },
      },
      {
        status: 200,
        headers: {
          'Clear-Site-Data':
            '"cache", "cookies", "storage", "executionContexts"',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      }
    );

    apiLogger.databaseOperation('user_signout_completed', true, {
      responseTime: `${Date.now() - startTime}ms`,
      securityHeadersApplied: true,
    });

    return response;
  } catch (error) {
    console.error('❌ [AUTH-SIGNOUT] Signout error:', error);

    apiLogger.databaseOperation('user_signout_error', false, {
      error: error instanceof Error ? error.message : 'Unknown error',
      responseTime: `${Date.now() - startTime}ms`,
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Signout failed',
        message: 'An error occurred during signout process.',
        responseTime: `${Date.now() - startTime}ms`,
      },
      { status: 500 }
    );
  }
}

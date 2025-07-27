import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/middleware/auth-middleware';
import { apiLogger } from '@/lib/enhanced-logger';
import { TokenService } from '@/services/token-service';

// Query parameter validation
const mediaTokenQuerySchema = z.object({
  room: z.string().min(1, 'Room name is required'),
  username: z.string().min(1, 'Username is required'),
  canPublish: z.enum(['true', 'false']).optional().default('true'),
  canSubscribe: z.enum(['true', 'false']).optional().default('true'),
});

export const dynamic = 'force-dynamic';

/**
 * Media Token Generation Endpoint
 * Consolidated endpoint for generating LiveKit media access tokens
 * Replaces the functionality of get-participant-token
 *
 * @route GET /api/tokens/media?room=...&username=...&canPublish=...&canSubscribe=...
 * @description Generates LiveKit access tokens for media sessions with proper authentication
 * @security Requires authentication, includes rate limiting and comprehensive audit logging
 */
export const GET = withAuth(
  async (req: NextRequest, { user }) => {
    const startTime = Date.now();

    try {
      // Parse and validate query parameters
      const { searchParams } = new URL(req.url);
      const queryResult = mediaTokenQuerySchema.safeParse({
        room: searchParams.get('room'),
        username: searchParams.get('username'),
        canPublish: searchParams.get('canPublish') || 'true',
        canSubscribe: searchParams.get('canSubscribe') || 'true',
      });

      if (!queryResult.success) {
        apiLogger.databaseOperation('media_token_validation_failed', false, {
          userId: user.userId.substring(0, 8) + '***',
          errors: queryResult.error.issues.map(i => i.message),
        });

        return NextResponse.json(
          {
            error: 'Invalid request parameters',
            details: queryResult.error.issues.map(i => i.message),
          },
          { status: 400 }
        );
      }

      const { room, username, canPublish, canSubscribe } = queryResult.data;

      // Initialize TokenService
      const tokenService = new TokenService();

      // Prepare token request
      const tokenRequest = {
        room,
        username,
        permissions: {
          canPublish: canPublish === 'true',
          canSubscribe: canSubscribe === 'true',
          canUpdateMetadata: false, // Default to false for security
        },
      };

      apiLogger.databaseOperation('media_token_generation_started', true, {
        userId: user.userId.substring(0, 8) + '***',
        room,
        username: username.substring(0, 3) + '***',
        permissions: tokenRequest.permissions,
      });

      // Generate media token using service
      const tokenResponse = await tokenService.generateMediaToken(tokenRequest);

      // Log successful token generation
      apiLogger.databaseOperation('media_token_generated_successfully', true, {
        userId: user.userId.substring(0, 8) + '***',
        room,
        username: username.substring(0, 3) + '***',
        tokenLength: tokenResponse.token.length,
        expiresAt: tokenResponse.expiresAt.toISOString(),
        responseTime: `${Date.now() - startTime}ms`,
      });

      // Return the token with metadata
      return NextResponse.json({
        token: tokenResponse.token,
        expiresAt: tokenResponse.expiresAt.toISOString(),
        room: tokenResponse.room,
        username: tokenResponse.username,
        permissions: tokenResponse.permissions,
        metadata: {
          generatedAt: new Date().toISOString(),
          userId: user.userId,
          responseTime: `${Date.now() - startTime}ms`,
          version: '2.0-service-based',
        },
      });
    } catch (error) {
      console.error('❌ [MEDIA-TOKEN] Token generation error:', error);

      apiLogger.databaseOperation('media_token_generation_error', false, {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: user.userId.substring(0, 8) + '***',
        responseTime: `${Date.now() - startTime}ms`,
      });

      return NextResponse.json(
        {
          error: 'Failed to generate media token',
          message:
            'An internal error occurred while generating the access token.',
          responseTime: `${Date.now() - startTime}ms`,
        },
        { status: 500 }
      );
    }
  },
  {
    action: 'media_token_generation',
    requireAdmin: false,
    requireCSRF: false,
    requireRateLimit: true,
    allowedMethods: ['GET'],
  }
);

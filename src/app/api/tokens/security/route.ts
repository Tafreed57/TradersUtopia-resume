import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/middleware/auth-middleware';
import { apiLogger } from '@/lib/enhanced-logger';
import { TokenService } from '@/services/token-service';

// Query parameter validation
const securityTokenQuerySchema = z.object({
  type: z.enum(['csrf', 'csrf-stats']).optional().default('csrf'),
});

export const dynamic = 'force-dynamic';

/**
 * Security Token Endpoint
 * Consolidated endpoint for generating security tokens (CSRF, etc.)
 * Replaces the functionality of csrf-token route
 *
 * @route GET /api/tokens/security?type=csrf|csrf-stats
 * @description Generates security tokens with proper authentication and audit logging
 * @security Requires authentication, includes rate limiting and comprehensive monitoring
 */
export const GET = withAuth(
  async (req: NextRequest, { user }) => {
    const startTime = Date.now();

    try {
      // Parse and validate query parameters
      const { searchParams } = new URL(req.url);
      const queryResult = securityTokenQuerySchema.safeParse({
        type: searchParams.get('type') || 'csrf',
      });

      if (!queryResult.success) {
        apiLogger.databaseOperation('security_token_validation_failed', false, {
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

      const { type } = queryResult.data;

      // Initialize TokenService
      const tokenService = new TokenService();

      apiLogger.databaseOperation('security_token_generation_started', true, {
        userId: user.userId.substring(0, 8) + '***',
        tokenType: type,
      });

      if (type === 'csrf') {
        // Generate CSRF token
        const tokenResponse = await tokenService.generateCSRFToken(user.userId);

        apiLogger.databaseOperation('csrf_token_generated_successfully', true, {
          userId: user.userId.substring(0, 8) + '***',
          tokenLength: tokenResponse.token.length,
          expiresAt: tokenResponse.expiresAt.toISOString(),
          responseTime: `${Date.now() - startTime}ms`,
        });

        return NextResponse.json(
          {
            token: tokenResponse.token,
            expiresIn: tokenResponse.expiresIn,
            expiresAt: tokenResponse.expiresAt.toISOString(),
            usage: tokenResponse.usage,
            metadata: {
              generatedAt: new Date().toISOString(),
              userId: user.userId,
              tokenType: 'csrf',
              responseTime: `${Date.now() - startTime}ms`,
              version: '2.0-service-based',
            },
          },
          {
            headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              Pragma: 'no-cache',
              Expires: '0',
            },
          }
        );
      } else if (type === 'csrf-stats') {
        // Get CSRF statistics (development only)
        try {
          const statsResponse = await tokenService.getCSRFStats(user.userId);

          apiLogger.databaseOperation(
            'csrf_stats_retrieved_successfully',
            true,
            {
              userId: user.userId.substring(0, 8) + '***',
              environment: statsResponse.environment,
              responseTime: `${Date.now() - startTime}ms`,
            }
          );

          return NextResponse.json(
            {
              ...statsResponse,
              metadata: {
                generatedAt: new Date().toISOString(),
                userId: user.userId,
                responseTime: `${Date.now() - startTime}ms`,
                version: '2.0-service-based',
              },
            },
            {
              headers: {
                'X-Environment': 'development',
                'X-Security-Level': 'high',
              },
            }
          );
        } catch (error) {
          if (error instanceof Error && error.message.includes('production')) {
            return NextResponse.json(
              {
                error: 'CSRF stats disabled in production',
                environment: 'production',
                responseTime: `${Date.now() - startTime}ms`,
              },
              { status: 403 }
            );
          }
          throw error;
        }
      }

      // Fallback for unknown type
      return NextResponse.json(
        {
          error: 'Invalid token type',
          supportedTypes: ['csrf', 'csrf-stats'],
          responseTime: `${Date.now() - startTime}ms`,
        },
        { status: 400 }
      );
    } catch (error) {
      console.error('❌ [SECURITY-TOKEN] Token generation error:', error);

      apiLogger.databaseOperation('security_token_generation_error', false, {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: user.userId.substring(0, 8) + '***',
        responseTime: `${Date.now() - startTime}ms`,
      });

      return NextResponse.json(
        {
          error: 'Failed to generate security token',
          message:
            'An internal error occurred while generating the security token.',
          responseTime: `${Date.now() - startTime}ms`,
        },
        { status: 500 }
      );
    }
  },
  {
    action: 'security_token_generation',
    requireAdmin: false,
    requireCSRF: false,
    requireRateLimit: true,
    allowedMethods: ['GET'],
  }
);

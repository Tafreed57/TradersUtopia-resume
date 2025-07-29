import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/middleware/auth-middleware';
import { apiLogger } from '@/lib/enhanced-logger';
import { ServerService } from '@/services/database/server-service';

// Params validation schema
const paramsSchema = z.object({
  serverId: z.string().min(1, 'Server ID is required'),
});

export const dynamic = 'force-dynamic';

/**
 * Mobile Data Endpoint
 * Consolidated endpoint for mobile app server data optimization
 * Replaces the functionality of servers/[serverId]/mobile-data
 *
 * @route GET /api/servers/[serverId]/mobile
 * @description Provides optimized server data for mobile apps with conditional requests
 * @security Requires authentication, includes rate limiting and comprehensive monitoring
 */
export const GET = withAuth(
  async (req: NextRequest, { user }) => {
    const startTime = Date.now();

    try {
      // Extract serverId from URL
      const url = new URL(req.url);
      const pathSegments = url.pathname.split('/');
      const serverIdIndex =
        pathSegments.findIndex(segment => segment === 'servers') + 1;
      const serverId = pathSegments[serverIdIndex];

      if (!serverId) {
        return NextResponse.json(
          { error: 'Server ID is required' },
          { status: 400 }
        );
      }

      // Validate server ID format
      const validationResult = paramsSchema.safeParse({ serverId });
      if (!validationResult.success) {
        apiLogger.databaseOperation('mobile_data_validation_failed', false, {
          userId: user.id.substring(0, 8) + '***',
          serverId: serverId.substring(0, 8) + '***',
          errors: validationResult.error.issues.map(i => i.message),
        });

        return NextResponse.json(
          {
            error: 'Invalid server ID format',
            details: validationResult.error.issues.map(i => i.message),
          },
          { status: 400 }
        );
      }

      // Get If-Modified-Since header for conditional requests
      const ifModifiedSince = req.headers.get('if-modified-since');

      apiLogger.databaseOperation('mobile_data_request_started', true, {
        userId: user.id.substring(0, 8) + '***',
        serverId: serverId.substring(0, 8) + '***',
        hasIfModifiedSince: !!ifModifiedSince,
      });

      // Initialize ServerService
      const serverService = new ServerService();

      // Get mobile data using service layer
      const result = await serverService.getMobileData(
        serverId,
        user.id,
        ifModifiedSince || undefined
      );

      // Handle not modified response (304)
      if (result.notModified) {
        apiLogger.databaseOperation('mobile_data_not_modified', true, {
          userId: user.id.substring(0, 8) + '***',
          serverId: serverId.substring(0, 8) + '***',
          lastModified: result.lastModified,
          responseTime: `${Date.now() - startTime}ms`,
        });

        return new NextResponse(null, {
          status: 304,
          headers: {
            'Last-Modified': result.lastModified,
          },
        });
      }

      // Return fresh data
      apiLogger.databaseOperation('mobile_data_retrieved_successfully', true, {
        userId: user.id.substring(0, 8) + '***',
        serverId: serverId.substring(0, 8) + '***',
        sectionCount: result.data?.sections?.length || 0,
        channelCount: result.data?.channels?.length || 0,
        memberCount: result.data?.members?.length || 0,
        responseTime: `${Date.now() - startTime}ms`,
      });

      return new NextResponse(
        JSON.stringify({
          ...result.data,
          metadata: {
            optimized: true,
            conditionalRequest: !!ifModifiedSince,
            responseTime: `${Date.now() - startTime}ms`,
            version: '2.0-service-based',
          },
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Last-Modified': result.lastModified,
            'Cache-Control': 'no-cache, must-revalidate',
          },
        }
      );
    } catch (error) {
      console.error('❌ [MOBILE-DATA] Retrieval error:', error);

      apiLogger.databaseOperation('mobile_data_retrieval_error', false, {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: user.id.substring(0, 8) + '***',
        responseTime: `${Date.now() - startTime}ms`,
      });

      // Handle specific error types
      if (error instanceof Error) {
        if (error.message.includes('not a member')) {
          return NextResponse.json(
            {
              error: 'Access denied',
              message: 'You are not a member of this server.',
              responseTime: `${Date.now() - startTime}ms`,
            },
            { status: 403 }
          );
        }

        if (error.message.includes('not found')) {
          return NextResponse.json(
            {
              error: 'Server not found',
              message: 'The requested server does not exist.',
              responseTime: `${Date.now() - startTime}ms`,
            },
            { status: 404 }
          );
        }
      }

      return NextResponse.json(
        {
          error: 'Failed to retrieve mobile data',
          message: 'An internal error occurred while fetching server data.',
          responseTime: `${Date.now() - startTime}ms`,
        },
        { status: 500 }
      );
    }
  },
  {
    action: 'mobile_data_retrieval',
    requireAdmin: false,
    requireCSRF: false,
    requireRateLimit: true,
    allowedMethods: ['GET'],
  }
);

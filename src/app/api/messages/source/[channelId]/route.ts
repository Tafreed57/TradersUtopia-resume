import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/middleware/auth-middleware';
import { apiLogger } from '@/lib/enhanced-logger';
import { MessageService } from '@/services/database/message-service';

export const dynamic = 'force-dynamic';

/**
 * Source Messages Endpoint
 * Consolidated endpoint for trading data source message retrieval
 * Replaces the functionality of source-messages/[channelId]
 *
 * @route GET /api/messages/source/[channelId]
 * @description Retrieves messages from external trading database with proper authentication and service architecture
 * @security Requires authentication, includes rate limiting and comprehensive monitoring
 */
export const GET = withAuth(
  async (req: NextRequest, { user }) => {
    const startTime = Date.now();

    try {
      // Extract channelId from URL
      const url = new URL(req.url);
      const pathSegments = url.pathname.split('/');
      const channelId = pathSegments[pathSegments.length - 1];

      if (!channelId) {
        return NextResponse.json(
          { error: 'Channel ID is required' },
          { status: 400 }
        );
      }

      // Parse query parameters
      const { searchParams } = url;
      const cursor = searchParams.get('cursor');
      const limitParam = searchParams.get('limit');
      const limit = limitParam ? parseInt(limitParam, 10) : 10;

      if (limit > 50) {
        return NextResponse.json(
          { error: 'Limit cannot exceed 50 messages' },
          { status: 400 }
        );
      }

      apiLogger.databaseOperation('source_messages_request_started', true, {
        userId: user.userId.substring(0, 8) + '***',
        channelId: channelId.substring(0, 8) + '***',
        cursor: cursor ? cursor.substring(0, 8) + '***' : null,
        limit,
      });

      // Initialize MessageService
      const messageService = new MessageService();

      // Get source messages using service layer
      const result = await messageService.getSourceMessages(
        channelId,
        user.userId,
        {
          cursor: cursor || undefined,
          limit,
        }
      );

      apiLogger.databaseOperation(
        'source_messages_retrieved_successfully',
        true,
        {
          userId: user.userId.substring(0, 8) + '***',
          channelId: channelId.substring(0, 8) + '***',
          messageCount: result.items.length,
          hasNextCursor: !!result.nextCursor,
          responseTime: `${Date.now() - startTime}ms`,
        }
      );

      return NextResponse.json({
        items: result.items,
        nextCursor: result.nextCursor,
        metadata: {
          channelId,
          messageCount: result.items.length,
          hasMore: !!result.nextCursor,
          source: 'trading_database',
          responseTime: `${Date.now() - startTime}ms`,
          version: '2.0-service-based',
        },
      });
    } catch (error) {
      console.error('❌ [SOURCE-MESSAGES] Retrieval error:', error);

      apiLogger.databaseOperation('source_messages_retrieval_error', false, {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: user.userId.substring(0, 8) + '***',
        responseTime: `${Date.now() - startTime}ms`,
      });

      // Handle specific error types
      if (error instanceof Error) {
        if (error.message.includes('not configured')) {
          return NextResponse.json(
            {
              error: 'Source messages feature not configured',
              message: 'Trading data source is not available at this time.',
              responseTime: `${Date.now() - startTime}ms`,
            },
            { status: 503 }
          );
        }

        if (error.message.includes('not found')) {
          return NextResponse.json(
            {
              error: 'Channel not found',
              message: 'The requested trading channel does not exist.',
              responseTime: `${Date.now() - startTime}ms`,
            },
            { status: 404 }
          );
        }
      }

      return NextResponse.json(
        {
          error: 'Failed to retrieve source messages',
          message: 'An internal error occurred while fetching trading data.',
          responseTime: `${Date.now() - startTime}ms`,
        },
        { status: 500 }
      );
    }
  },
  {
    action: 'source_messages_retrieval',
    requireAdmin: false,
    requireCSRF: false,
    requireRateLimit: true,
    allowedMethods: ['GET'],
  }
);

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/middleware/auth-middleware';
import { apiLogger } from '@/lib/enhanced-logger';
import { NotificationService } from '@/services/database/notification-service';

// Toggle schema validation
const toggleSchema = z.object({
  enabled: z.boolean({
    required_error: 'Enabled status is required',
    invalid_type_error: 'Enabled must be a boolean',
  }),
});

export const dynamic = 'force-dynamic';

/**
 * Channel Notifications Endpoint
 * Consolidated endpoint for channel notification preference management
 * Replaces the functionality of channels/[channelId]/notifications
 *
 * @route GET|PATCH /api/notifications/channels/[channelId]
 * @description Manages channel notification preferences with proper authentication and service architecture
 * @security Requires authentication, includes rate limiting and comprehensive monitoring
 */

/**
 * GET - Get notification preference for a channel
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

      apiLogger.databaseOperation('channel_notification_get_started', true, {
        userId: user.userId.substring(0, 8) + '***',
        channelId: channelId.substring(0, 8) + '***',
      });

      // Initialize NotificationService
      const notificationService = new NotificationService();

      // Get notification preference using service layer
      const preference =
        await notificationService.getChannelNotificationPreference(
          user.userId,
          channelId
        );

      apiLogger.databaseOperation(
        'channel_notification_preference_retrieved',
        true,
        {
          userId: user.userId.substring(0, 8) + '***',
          channelId: channelId.substring(0, 8) + '***',
          enabled: preference.enabled,
          responseTime: `${Date.now() - startTime}ms`,
        }
      );

      return NextResponse.json({
        enabled: preference.enabled,
        channelId: preference.channelId,
        metadata: {
          operation: 'get_preference',
          responseTime: `${Date.now() - startTime}ms`,
          version: '2.0-service-based',
        },
      });
    } catch (error) {
      console.error('❌ [CHANNEL-NOTIFICATIONS] Get preference error:', error);

      apiLogger.databaseOperation('channel_notification_get_error', false, {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: user.userId.substring(0, 8) + '***',
        responseTime: `${Date.now() - startTime}ms`,
      });

      // Handle specific error types
      if (error instanceof Error && error.message.includes('not found')) {
        return NextResponse.json(
          {
            error: 'Channel not found or no access',
            message: 'You do not have access to this channel.',
            responseTime: `${Date.now() - startTime}ms`,
          },
          { status: 404 }
        );
      }

      return NextResponse.json(
        {
          error: 'Failed to get notification preference',
          message:
            'An internal error occurred while fetching notification settings.',
          responseTime: `${Date.now() - startTime}ms`,
        },
        { status: 500 }
      );
    }
  },
  {
    action: 'channel_notification_get',
    requireAdmin: false,
    requireCSRF: false,
    requireRateLimit: true,
    allowedMethods: ['GET'],
  }
);

/**
 * PATCH - Update notification preference for a channel
 */
export const PATCH = withAuth(
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

      // Validate request body
      const body = await req.json();
      const validationResult = toggleSchema.safeParse(body);

      if (!validationResult.success) {
        apiLogger.databaseOperation(
          'channel_notification_patch_validation_failed',
          false,
          {
            userId: user.userId.substring(0, 8) + '***',
            channelId: channelId.substring(0, 8) + '***',
            errors: validationResult.error.issues.map(i => i.message),
          }
        );

        return NextResponse.json(
          {
            error: 'Invalid request data',
            details: validationResult.error.issues.map(i => i.message),
          },
          { status: 400 }
        );
      }

      const { enabled } = validationResult.data;

      apiLogger.databaseOperation('channel_notification_patch_started', true, {
        userId: user.userId.substring(0, 8) + '***',
        channelId: channelId.substring(0, 8) + '***',
        enabled,
      });

      // Initialize NotificationService
      const notificationService = new NotificationService();

      // Update notification preference using service layer
      const result =
        await notificationService.updateChannelNotificationPreference(
          user.userId,
          channelId,
          enabled
        );

      apiLogger.databaseOperation(
        'channel_notification_preference_updated',
        true,
        {
          userId: user.userId.substring(0, 8) + '***',
          channelId: channelId.substring(0, 8) + '***',
          enabled: result.enabled,
          action: enabled ? 'enabled' : 'disabled',
          responseTime: `${Date.now() - startTime}ms`,
        }
      );

      return NextResponse.json({
        enabled: result.enabled,
        channelId: result.channelId,
        message: result.message,
        metadata: {
          operation: 'update_preference',
          action: enabled ? 'enabled' : 'disabled',
          responseTime: `${Date.now() - startTime}ms`,
          version: '2.0-service-based',
        },
      });
    } catch (error) {
      console.error(
        '❌ [CHANNEL-NOTIFICATIONS] Update preference error:',
        error
      );

      apiLogger.databaseOperation('channel_notification_patch_error', false, {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: user.userId.substring(0, 8) + '***',
        responseTime: `${Date.now() - startTime}ms`,
      });

      // Handle specific error types
      if (error instanceof Error && error.message.includes('not found')) {
        return NextResponse.json(
          {
            error: 'Channel not found or no access',
            message: 'You do not have access to this channel.',
            responseTime: `${Date.now() - startTime}ms`,
          },
          { status: 404 }
        );
      }

      return NextResponse.json(
        {
          error: 'Failed to update notification preference',
          message:
            'An internal error occurred while updating notification settings.',
          responseTime: `${Date.now() - startTime}ms`,
        },
        { status: 500 }
      );
    }
  },
  {
    action: 'channel_notification_update',
    requireAdmin: false,
    requireCSRF: true,
    requireRateLimit: true,
    allowedMethods: ['PATCH'],
  }
);

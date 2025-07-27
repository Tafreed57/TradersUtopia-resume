import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/middleware/auth-middleware';
import { apiLogger } from '@/lib/enhanced-logger';
import { subscribeToPushNotifications } from '@/lib/push-notifications';

// Push subscription schema
const subscribeSchema = z.object({
  subscription: z.object({
    endpoint: z.string().url('Invalid endpoint URL'),
    keys: z.object({
      p256dh: z.string().min(1, 'p256dh key is required'),
      auth: z.string().min(1, 'auth key is required'),
    }),
  }),
});

// Action schema for different operations
const actionSchema = z.object({
  action: z
    .enum(['subscribe', 'status', 'reset'])
    .optional()
    .default('subscribe'),
});

export const dynamic = 'force-dynamic';

/**
 * Push Notifications Unified Endpoint
 * Consolidated endpoint for all push notification operations
 * Replaces subscribe, status, and reset routes
 *
 * @route GET|POST /api/notifications/push?action=subscribe|status|reset
 * @description Manages push notification subscriptions and status
 * @security Requires authentication, includes rate limiting and comprehensive monitoring
 */

/**
 * GET - Get push notification status
 */
export const GET = withAuth(
  async (req: NextRequest, { user }) => {
    const startTime = Date.now();

    try {
      const { searchParams } = new URL(req.url);
      const action = searchParams.get('action') || 'status';

      apiLogger.databaseOperation('push_notification_get_started', true, {
        userId: user.userId.substring(0, 8) + '***',
        action,
      });

      if (action === 'status') {
        return NextResponse.json({
          supported: 'serviceWorker' in global,
          enabled: true,
          action: 'status_check',
          metadata: {
            responseTime: `${Date.now() - startTime}ms`,
            version: '2.0-service-based',
          },
        });
      }

      return NextResponse.json(
        {
          error: 'Invalid action for GET request',
          supportedActions: ['status'],
        },
        { status: 400 }
      );
    } catch (error) {
      console.error('❌ [PUSH-NOTIFICATIONS] GET error:', error);

      apiLogger.databaseOperation('push_notification_get_error', false, {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: user.userId.substring(0, 8) + '***',
        responseTime: `${Date.now() - startTime}ms`,
      });

      return NextResponse.json(
        {
          error: 'Failed to get push notification status',
          responseTime: `${Date.now() - startTime}ms`,
        },
        { status: 500 }
      );
    }
  },
  {
    action: 'push_notification_status',
    requireAdmin: false,
    requireCSRF: false,
    requireRateLimit: true,
    allowedMethods: ['GET'],
  }
);

/**
 * POST - Subscribe, reset, or other push notification operations
 */
export const POST = withAuth(
  async (req: NextRequest, { user }) => {
    const startTime = Date.now();

    try {
      const { searchParams } = new URL(req.url);
      const action = searchParams.get('action') || 'subscribe';

      apiLogger.databaseOperation('push_notification_post_started', true, {
        userId: user.userId.substring(0, 8) + '***',
        action,
      });

      if (action === 'subscribe') {
        // Parse and validate subscription data
        const body = await req.json();
        const validationResult = subscribeSchema.safeParse(body);

        if (!validationResult.success) {
          apiLogger.databaseOperation(
            'push_subscription_validation_failed',
            false,
            {
              userId: user.userId.substring(0, 8) + '***',
              errors: validationResult.error.issues.map(i => i.message),
            }
          );

          return NextResponse.json(
            {
              error: 'Invalid subscription format',
              details: validationResult.error.issues.map(i => i.message),
            },
            { status: 400 }
          );
        }

        const { subscription } = validationResult.data;

        // Save subscription using existing push notification library
        const success = await subscribeToPushNotifications(
          user.userId,
          subscription
        );

        if (success) {
          apiLogger.databaseOperation('push_subscription_saved', true, {
            userId: user.userId.substring(0, 8) + '***',
            endpoint: subscription.endpoint.substring(0, 20) + '***',
            responseTime: `${Date.now() - startTime}ms`,
          });

          return NextResponse.json({
            success: true,
            message: 'Push notifications enabled successfully',
            metadata: {
              action: 'subscribe',
              responseTime: `${Date.now() - startTime}ms`,
              version: '2.0-service-based',
            },
          });
        } else {
          return NextResponse.json(
            {
              error: 'Failed to save subscription',
              message: 'Could not enable push notifications',
              responseTime: `${Date.now() - startTime}ms`,
            },
            { status: 500 }
          );
        }
      } else if (action === 'reset') {
        // Reset push notifications (placeholder implementation)
        apiLogger.databaseOperation('push_notification_reset', true, {
          userId: user.userId.substring(0, 8) + '***',
          responseTime: `${Date.now() - startTime}ms`,
        });

        return NextResponse.json({
          success: true,
          message: 'Push notifications reset successfully',
          metadata: {
            action: 'reset',
            responseTime: `${Date.now() - startTime}ms`,
            version: '2.0-service-based',
          },
        });
      } else {
        return NextResponse.json(
          {
            error: 'Invalid action',
            supportedActions: ['subscribe', 'reset'],
          },
          { status: 400 }
        );
      }
    } catch (error) {
      console.error('❌ [PUSH-NOTIFICATIONS] POST error:', error);

      apiLogger.databaseOperation('push_notification_post_error', false, {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: user.userId.substring(0, 8) + '***',
        responseTime: `${Date.now() - startTime}ms`,
      });

      return NextResponse.json(
        {
          error: 'Failed to process push notification request',
          message: 'An internal error occurred while processing the request.',
          responseTime: `${Date.now() - startTime}ms`,
        },
        { status: 500 }
      );
    }
  },
  {
    action: 'push_notification_operations',
    requireAdmin: false,
    requireCSRF: false,
    requireRateLimit: true,
    allowedMethods: ['POST'],
  }
);

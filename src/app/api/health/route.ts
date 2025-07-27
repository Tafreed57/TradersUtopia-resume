import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { apiLogger } from '@/lib/enhanced-logger';
import { rateLimitGeneral, rateLimitAdmin } from '@/lib/rate-limit';
import { getCurrentProfileWithSync } from '@/lib/query';
import { currentUser } from '@clerk/nextjs/server';

// Query parameter validation
const healthQuerySchema = z.object({
  level: z
    .enum(['basic', 'admin', 'system'], {
      required_error: 'Level is required',
      invalid_type_error: 'Level must be basic, admin, or system',
    })
    .optional()
    .default('basic'),
});

export const dynamic = 'force-dynamic';

/**
 * Unified Health Check Endpoint
 * Consolidates health, admin/system-health, and admin/check-status functionality
 *
 * @route GET /api/health?level=basic|admin|system
 * @description Provides health information at different levels based on authentication
 * @security Basic level - no auth, Admin level - requires auth, System level - requires admin
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const queryResult = healthQuerySchema.safeParse({
      level: searchParams.get('level') || 'basic',
    });

    if (!queryResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid query parameters',
          details: queryResult.error.issues.map(i => i.message).join(', '),
        },
        { status: 400 }
      );
    }

    const { level } = queryResult.data;

    // Rate limiting based on level
    if (level === 'system') {
      const rateLimitResult = await rateLimitAdmin()(request);
      if (!rateLimitResult.success) {
        return rateLimitResult.error;
      }
    } else {
      const rateLimitResult = await rateLimitGeneral()(request);
      if (!rateLimitResult.success) {
        return rateLimitResult.error;
      }
    }

    // Build base health response
    const healthResponse: any = {
      status: 'healthy',
      level,
      timestamp: new Date().toISOString(),
      responseTime: `${Date.now() - startTime}ms`,
      version: '3.0-consolidated',
    };

    // Basic health check (no authentication required)
    if (level === 'basic') {
      try {
        // Check database connectivity
        await db.$queryRaw`SELECT 1`;

        // Check environment variables without exposing details
        const requiredEnvVars = [
          'DATABASE_URL',
          'CLERK_SECRET_KEY',
          'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
        ];

        const missingEnvVars = requiredEnvVars.filter(
          envVar => !process.env[envVar]
        );

        if (missingEnvVars.length > 0) {
          return NextResponse.json(
            {
              status: 'error',
              level: 'basic',
              message: 'Application configuration incomplete',
              timestamp: healthResponse.timestamp,
              responseTime: healthResponse.responseTime,
            },
            { status: 500 }
          );
        }

        healthResponse.message = 'Application is running correctly';
        healthResponse.database = 'connected';
        healthResponse.features = {
          authentication: 'enabled',
          rateLimit: 'enabled',
          security: 'enabled',
        };

        apiLogger.databaseOperation('health_check_basic', true, {
          status: 'healthy',
          responseTime: healthResponse.responseTime,
        });

        return NextResponse.json(healthResponse);
      } catch (error) {
        return NextResponse.json(
          {
            status: 'error',
            level: 'basic',
            message: 'Health check failed',
            timestamp: healthResponse.timestamp,
            responseTime: healthResponse.responseTime,
          },
          { status: 500 }
        );
      }
    }

    // Admin and system level checks require authentication
    let profile = null;
    let isAdmin = false;

    if (level === 'admin' || level === 'system') {
      if (level === 'admin') {
        // Lightweight auth for admin status checks
        profile = await getCurrentProfileWithSync();
        if (!profile) {
          return NextResponse.json(
            { error: 'Not authenticated', level },
            { status: 401 }
          );
        }
        isAdmin = profile.isAdmin;
      } else {
        // Full auth for system health
        const user = await currentUser();
        if (!user) {
          return NextResponse.json(
            { error: 'Not authenticated', level },
            { status: 401 }
          );
        }

        profile = await db.user.findFirst({
          where: { userId: user.id, isAdmin: true },
        });

        if (!profile) {
          return NextResponse.json(
            { error: 'Admin access required', level },
            { status: 403 }
          );
        }
        isAdmin = true;
      }
    }

    // Admin level response (admin status check)
    if (level === 'admin') {
      healthResponse.message = 'Admin status retrieved successfully';
      healthResponse.isAdmin = isAdmin;
      healthResponse.profile = {
        id: profile?.id,
        email: profile?.email,
        isAdmin: profile?.isAdmin,
      };

      apiLogger.databaseOperation('health_check_admin', true, {
        status: 'healthy',
        isAdmin,
        userId: profile?.userId?.substring(0, 8) + '***',
      });

      return NextResponse.json(healthResponse);
    }

    // System level response (comprehensive diagnostics)
    if (level === 'system' && isAdmin) {
      // Get basic system statistics
      const [totalUsers, totalAdmins, totalServers, totalChannels] =
        await Promise.all([
          db.user.count(),
          db.user.count({ where: { isAdmin: true } }),
          db.server.count(),
          db.channel.count(),
        ]);

      healthResponse.message = 'System health diagnostics completed';
      healthResponse.systemStats = {
        users: {
          totalUsers,
          totalAdmins,
        },
        content: {
          totalServers,
          totalChannels,
        },
      };

      healthResponse.recommendations = ['✅ Basic system health looks good!'];

      apiLogger.databaseOperation('health_check_system', true, {
        status: 'healthy',
        totalUsers,
        totalAdmins,
        adminId: profile?.userId?.substring(0, 8) + '***',
      });

      return NextResponse.json(healthResponse);
    }

    // Fallback
    return NextResponse.json(
      { error: 'Invalid health check level', level },
      { status: 400 }
    );
  } catch (error) {
    console.error('❌ [HEALTH] Health check error:', error);

    return NextResponse.json(
      {
        status: 'error',
        message: 'Health check failed',
        timestamp: new Date().toISOString(),
        responseTime: `${Date.now() - startTime}ms`,
      },
      { status: 500 }
    );
  }
}

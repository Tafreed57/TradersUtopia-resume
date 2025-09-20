import { NextRequest, NextResponse } from 'next/server';
import { withAuth, authHelpers } from '@/middleware/auth-middleware';
import { apiLogger } from '@/lib/enhanced-logger';
import { ValidationError } from '@/lib/error-handling';
import { runs } from '@trigger.dev/sdk/v3';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

/**
 * Get Notification Job Status
 * Returns the status and details of a Trigger.dev notification job
 */
export const GET = withAuth(
  async (req: NextRequest, { user, isAdmin, params }) => {
    const jobId = params?.jobId as string;

    if (!jobId || typeof jobId !== 'string') {
      throw new ValidationError('Job ID is required');
    }

    try {
      // Retrieve the job run details from Trigger.dev
      const run = await runs.retrieve(jobId);

      // Log successful job status retrieval
      apiLogger.databaseOperation('notification_job_status_retrieved', true, {
        jobId: jobId.substring(0, 8) + '***',
        userId: user.id.substring(0, 8) + '***',
        status: run.status,
        taskIdentifier: run.taskIdentifier,
      });

      // Return comprehensive job status information
      return NextResponse.json({
        id: run.id,
        status: run.status,
        taskIdentifier: run.taskIdentifier,
        createdAt: run.createdAt,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt,
        updatedAt: run.updatedAt,
        output: run.output,
        error: run.error,
        metadata: {
          costInCents: run.costInCents,
          durationMs: run.durationMs,
          baseCostInCents: run.baseCostInCents,
          tags: run.tags,
        },
        // Enhanced information for admins
        ...(isAdmin && {
          adminDetails: {
            // attempts: run.attempts,
            version: run.version,
          },
        }),
      });
    } catch (error: any) {
      // Handle different types of errors
      if (error.statusCode === 404 || error.message?.includes('not found')) {
        apiLogger.databaseOperation('notification_job_not_found', false, {
          jobId: jobId.substring(0, 8) + '***',
          userId: user.id.substring(0, 8) + '***',
        });

        return NextResponse.json(
          {
            error: 'Job not found',
            message: 'The specified notification job could not be found',
          },
          { status: 404 }
        );
      }

      // Log unexpected errors
      apiLogger.databaseOperation('notification_job_status_error', false, {
        jobId: jobId.substring(0, 8) + '***',
        userId: user.id.substring(0, 8) + '***',
        error: error instanceof Error ? error.message : String(error),
        statusCode: error.statusCode || 'unknown',
      });

      return NextResponse.json(
        {
          error: 'Failed to retrieve job status',
          message:
            'An error occurred while fetching the notification job status',
        },
        { status: 500 }
      );
    }
  },
  authHelpers.userOnly('VIEW_NOTIFICATION_STATUS')
);

/**
 * Cancel Notification Job (Admin Only)
 * Allows admins to cancel running notification jobs
 */
export const DELETE = withAuth(
  async (req: NextRequest, { user, isAdmin, params }) => {
    // Only admins can cancel notification jobs
    if (!isAdmin) {
      throw new ValidationError(
        'Only administrators can cancel notification jobs'
      );
    }

    const jobId = params?.jobId as string;

    if (!jobId || typeof jobId !== 'string') {
      throw new ValidationError('Job ID is required');
    }

    try {
      // First, check if the job exists and get its status
      const run = await runs.retrieve(jobId);

      // Check if the job can be cancelled
      const cancellableStatuses = ['PENDING', 'EXECUTING', 'QUEUED'];
      if (!cancellableStatuses.includes(run.status)) {
        apiLogger.databaseOperation(
          'notification_job_cancel_invalid_status',
          false,
          {
            jobId: jobId.substring(0, 8) + '***',
            userId: user.id.substring(0, 8) + '***',
            currentStatus: run.status,
          }
        );

        return NextResponse.json(
          {
            error: 'Job cannot be cancelled',
            message: `Job is in '${run.status}' status and cannot be cancelled`,
            currentStatus: run.status,
          },
          { status: 400 }
        );
      }

      // Cancel the job
      const cancelledRun = await runs.cancel(jobId);

      // Log successful cancellation
      apiLogger.databaseOperation('notification_job_cancelled', true, {
        jobId: jobId.substring(0, 8) + '***',
        userId: user.id.substring(0, 8) + '***',
        previousStatus: run.status,
        newStatus: 'CANCELED',
      });

      return NextResponse.json({
        id: cancelledRun.id,
        status: 'CANCELED',
        message: 'Notification job cancelled successfully',
        cancelledAt: new Date().toISOString(),
      });
    } catch (error: any) {
      // Handle different types of errors
      if (error.statusCode === 404 || error.message?.includes('not found')) {
        return NextResponse.json(
          {
            error: 'Job not found',
            message: 'The specified notification job could not be found',
          },
          { status: 404 }
        );
      }

      // Log unexpected errors
      apiLogger.databaseOperation('notification_job_cancel_error', false, {
        jobId: jobId.substring(0, 8) + '***',
        userId: user.id.substring(0, 8) + '***',
        error: error instanceof Error ? error.message : String(error),
      });

      return NextResponse.json(
        {
          error: 'Failed to cancel job',
          message: 'An error occurred while cancelling the notification job',
        },
        { status: 500 }
      );
    }
  },
  authHelpers.adminOnly('CANCEL_NOTIFICATION_JOB')
);

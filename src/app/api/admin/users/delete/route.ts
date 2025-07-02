import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { clerkClient } from '@clerk/nextjs/server';
import { rateLimitServer, trackSuspiciousActivity } from '@/lib/rate-limit';
import { strictCSRFValidation } from '@/lib/csrf';
import Stripe from 'stripe';

export async function POST(request: NextRequest) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  try {
    // CSRF protection for admin operations
    const csrfValid = await strictCSRFValidation(request);
    if (!csrfValid) {
      trackSuspiciousActivity(request, 'ADMIN_DELETE_CSRF_VALIDATION_FAILED');
      return NextResponse.json(
        {
          error: 'CSRF validation failed',
          message: 'Invalid security token. Please refresh and try again.',
        },
        { status: 403 }
      );
    }

    // Rate limiting for admin operations
    const rateLimitResult = await rateLimitServer()(request);
    if (!rateLimitResult.success) {
      trackSuspiciousActivity(request, 'ADMIN_DELETE_RATE_LIMIT_EXCEEDED');
      return rateLimitResult.error;
    }

    const user = await currentUser();

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Find the admin's profile and check admin status
    const adminProfile = await db.profile.findFirst({
      where: { userId: user.id },
    });

    if (!adminProfile || !adminProfile.isAdmin) {
      trackSuspiciousActivity(request, 'NON_ADMIN_DELETE_ATTEMPT');
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Prevent self-deletion
    if (userId === user.id) {
      return NextResponse.json(
        { error: 'Cannot delete your own account' },
        { status: 400 }
      );
    }

    // Find the user to delete
    const targetProfile = await db.profile.findFirst({
      where: { userId },
    });

    if (!targetProfile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    console.log(
      `🗑️ [ADMIN] Admin ${adminProfile.email} is deleting user ${targetProfile.email} (${userId})`
    );

    // Cancel Stripe subscription if exists
    if (
      targetProfile.stripeSessionId &&
      targetProfile.subscriptionStatus === 'ACTIVE'
    ) {
      try {
        // Try to find and cancel the subscription using the customer ID
        if (targetProfile.stripeCustomerId) {
          const subscriptions = await stripe.subscriptions.list({
            customer: targetProfile.stripeCustomerId,
            status: 'active',
            limit: 10,
          });

          for (const subscription of subscriptions.data) {
            await stripe.subscriptions.cancel(subscription.id);
            console.log(
              `💳 [ADMIN] Cancelled Stripe subscription ${subscription.id}`
            );
          }
        }
      } catch (stripeError) {
        console.warn(
          `Failed to cancel Stripe subscription for user ${userId}:`,
          stripeError
        );
        // Continue with deletion even if Stripe cancellation fails
      }
    }

    // Delete from database (this will cascade delete related records)
    await db.profile.delete({
      where: { userId },
    });

    console.log(`🗄️ [ADMIN] Deleted database records for user ${userId}`);

    // Delete from Clerk
    try {
      const clerk = await clerkClient();
      await clerk.users.deleteUser(userId);
      console.log(`👤 [ADMIN] Deleted Clerk user ${userId}`);
    } catch (clerkError) {
      console.warn(`Failed to delete Clerk user ${userId}:`, clerkError);
      // Log but don't fail the request since database deletion was successful
    }

    console.log(
      `✅ [ADMIN] Successfully deleted user ${targetProfile.email} by admin ${adminProfile.email}`
    );

    return NextResponse.json({
      success: true,
      message: 'User account has been permanently deleted',
      deletedUser: {
        userId: targetProfile.userId,
        email: targetProfile.email,
        name: targetProfile.name,
      },
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    trackSuspiciousActivity(request, 'ADMIN_DELETE_ERROR');

    return NextResponse.json(
      {
        error: 'Failed to delete user',
        message: 'Unable to delete user account. Please try again later.',
      },
      { status: 500 }
    );
  }
}

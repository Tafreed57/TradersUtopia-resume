import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile
    const profile = await db.profile.findFirst({
      where: { userId: user.id },
    });

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Check if user already has stripeSubscriptionId
    if (profile.stripeSubscriptionId) {
      return NextResponse.json({
        success: true,
        message: 'Subscription data is already up to date',
        subscriptionId: profile.stripeSubscriptionId,
        alreadyPopulated: true,
      });
    }

    return NextResponse.json({
      success: true,
      message:
        'No backfill needed - subscription webhooks will handle this automatically',
      note: 'This endpoint has been simplified as the subscription system now properly syncs data via webhooks',
    });
  } catch (error) {
    console.error('❌ [BACKFILL] Error:', error);
    return NextResponse.json(
      {
        error: 'Backfill operation failed',
        message:
          'This endpoint has been deprecated in favor of automatic webhook syncing',
      },
      { status: 500 }
    );
  }
}

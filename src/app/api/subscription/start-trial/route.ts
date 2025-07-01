import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { startTrial, checkUserSubscription } from '@/lib/subscription';

export async function POST() {
  try {
    const { userId } = auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user can start trial
    const subscriptionData = await checkUserSubscription();

    if (!subscriptionData.canStartTrial) {
      return NextResponse.json(
        { error: 'Trial already used or user has active subscription' },
        { status: 400 }
      );
    }

    const trialEnd = await startTrial(userId);

    return NextResponse.json({
      success: true,
      trialEnd,
      message: '14-day free trial started successfully!',
    });
  } catch (error) {
    console.error('Error starting trial:', error);
    return NextResponse.json(
      { error: 'Failed to start trial' },
      { status: 500 }
    );
  }
}

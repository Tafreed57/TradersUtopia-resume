import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Get user's profile
    const profile = await db.profile.findUnique({
      where: { userId },
      select: { pushSubscriptions: true },
    });

    if (!profile) {
      return new NextResponse('Profile not found', { status: 404 });
    }

    // Check if user has any valid push subscriptions
    const pushSubscriptions = profile.pushSubscriptions as any[];
    const hasValidSubscription =
      pushSubscriptions &&
      pushSubscriptions.length > 0 &&
      pushSubscriptions.some(sub => sub && sub.endpoint);

    return NextResponse.json({
      hasValidSubscription: Boolean(hasValidSubscription),
    });
  } catch (error) {
    console.error('Error checking push subscription status:', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}

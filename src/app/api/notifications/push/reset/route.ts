import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';

export async function POST() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Get user's profile
    const profile = await db.profile.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!profile) {
      return new NextResponse('Profile not found', { status: 404 });
    }

    // Clear push subscriptions from database
    await db.profile.update({
      where: { id: profile.id },
      data: { pushSubscriptions: [] },
    });

    return NextResponse.json({
      success: true,
      message: 'Push subscriptions cleared successfully',
    });
  } catch (error) {
    console.error('Error resetting push subscriptions:', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}

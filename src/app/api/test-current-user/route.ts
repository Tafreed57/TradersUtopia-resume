import { NextRequest, NextResponse } from 'next/server';
import { getCurrentProfileForAuth } from '@/lib/query';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 [TEST-USER] Checking current authenticated user...');

    const user = await getCurrentProfileForAuth();
    if (!user) {
      console.log('🔍 [TEST-USER] No authenticated user found');
      return NextResponse.json(
        {
          authenticated: false,
          message: 'No authenticated user found',
        },
        { status: 401 }
      );
    }

    console.log('🔍 [TEST-USER] Found authenticated user:', {
      userId: user.userId,
      email: user.email,
      name: user.name,
      profileId: user.id,
    });

    return NextResponse.json({
      authenticated: true,
      user: {
        userId: user.userId,
        email: user.email,
        name: user.name,
        profileId: user.id,
        isAdmin: user.isAdmin,
        subscriptionStatus: user.subscriptionStatus,
      },
    });
  } catch (error) {
    console.error('🔍 [TEST-USER] Error checking user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

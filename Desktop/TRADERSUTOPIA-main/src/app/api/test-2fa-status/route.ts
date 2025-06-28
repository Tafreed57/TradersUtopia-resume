import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const user = await currentUser();
    console.log('🧪 [TEST-2FA] Testing 2FA status for user:', user?.id || 'none');

    if (!user) {
      return NextResponse.json({
        error: 'Not authenticated',
        authenticated: false,
        userId: null,
        profile: null,
        cookie: null
      });
    }

    // Get profile
    const profile = await db.profile.findUnique({
      where: { userId: user.id },
      select: {
        twoFactorEnabled: true,
        email: true,
        name: true
      }
    });

    // Get cookie
    const cookieStore = cookies();
    const verificationCookie = cookieStore.get('2fa-verified');

    const result = {
      authenticated: true,
      userId: user.id,
      userEmail: user.emailAddresses[0]?.emailAddress,
      profile: profile,
      cookie: {
        exists: !!verificationCookie,
        value: verificationCookie?.value,
        verified: verificationCookie?.value === 'true'
      },
      requires2FA: profile?.twoFactorEnabled || false,
      isVerified: verificationCookie?.value === 'true',
      shouldRedirect: profile?.twoFactorEnabled && verificationCookie?.value !== 'true'
    };

    console.log('🧪 [TEST-2FA] Result:', JSON.stringify(result, null, 2));

    return NextResponse.json(result);

  } catch (error) {
    console.error('❌ [TEST-2FA] Error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 
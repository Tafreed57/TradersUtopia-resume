import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { TOTP } from 'otpauth';
import { createNotification } from '@/lib/notifications';

export async function POST(request: NextRequest) {
  try {
    const user = await currentUser();
    const { code } = await request.json();
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (!code || code.length !== 6) {
      return NextResponse.json({ error: 'Invalid code format' }, { status: 400 });
    }

    // Find the user's profile
    const profile = await db.profile.findFirst({
      where: { userId: user.id }
    });

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    if (!profile.twoFactorEnabled || !profile.twoFactorSecret) {
      return NextResponse.json({ error: '2FA is not enabled' }, { status: 400 });
    }

    // Verify the code before disabling
    const totp = new TOTP({
      issuer: 'TradersUtopia',
      label: `${profile.name} (${profile.email})`,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: profile.twoFactorSecret
    });

    const isValid = totp.validate({ token: code, window: 1 });

    if (!isValid) {
      return NextResponse.json({ error: 'Invalid code' }, { status: 400 });
    }

    // Disable 2FA
    await db.profile.update({
      where: { id: profile.id },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        backupCodes: [],
      }
    });

    // Create security notification
    await createNotification({
      userId: user.id,
      type: 'SECURITY',
      title: '2FA Disabled',
      message: 'Two-factor authentication has been disabled on your account.',
    });

    return NextResponse.json({
      success: true,
      message: '2FA has been successfully disabled.'
    });

  } catch (error) {
    console.error('2FA disable error:', error);
    return NextResponse.json({ 
      error: 'Failed to disable 2FA' 
    }, { status: 500 });
  }
} 
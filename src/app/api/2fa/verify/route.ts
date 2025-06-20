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

    if (!profile.twoFactorSecret) {
      return NextResponse.json({ error: '2FA not set up. Please set up 2FA first.' }, { status: 400 });
    }

    // Verify the code
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

    // Generate backup codes
    const backupCodes = Array.from({ length: 8 }, () => 
      Math.random().toString(36).substring(2, 10).toUpperCase()
    );

    // Enable 2FA
    await db.profile.update({
      where: { id: profile.id },
      data: {
        twoFactorEnabled: true,
        backupCodes,
      }
    });

    // Create security notification
    await createNotification({
      userId: user.id,
      type: 'SECURITY',
      title: '2FA Enabled',
      message: 'Two-factor authentication has been successfully enabled on your account.',
    });

    return NextResponse.json({
      success: true,
      backupCodes,
      message: '2FA has been successfully enabled! Please save these backup codes in a secure place.'
    });

  } catch (error) {
    console.error('2FA verification error:', error);
    return NextResponse.json({ 
      error: 'Failed to verify 2FA' 
    }, { status: 500 });
  }
} 
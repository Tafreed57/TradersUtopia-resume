import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { TOTP } from 'otpauth';
import QRCode from 'qrcode';
import { randomBytes } from 'crypto';

// Simple base32 encoder
function base32Encode(buffer: Buffer): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;

    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += alphabet[(value << (5 - bits)) & 31];
  }

  return output;
}

export async function POST(request: NextRequest) {
  try {
    const user = await currentUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Find the user's profile
    const profile = await db.profile.findFirst({
      where: { userId: user.id }
    });

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Check if 2FA is already enabled
    if (profile.twoFactorEnabled) {
      return NextResponse.json({ error: '2FA is already enabled' }, { status: 400 });
    }

    // Generate a random secret (20 bytes for TOTP)
    const secretBuffer = randomBytes(20);
    const secretBase32 = base32Encode(secretBuffer);

    // Generate a new TOTP instance
    const secret = new TOTP({
      issuer: 'TradersUtopia',
      label: `${profile.name} (${profile.email})`,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: secretBase32
    });

    // Generate QR code
    const qrCodeUrl = await QRCode.toDataURL(secret.toString());

    // Store the secret temporarily (not enabled yet)
    await db.profile.update({
      where: { id: profile.id },
      data: {
        twoFactorSecret: secretBase32,
      }
    });

    return NextResponse.json({
      secret: secretBase32,
      qrCode: qrCodeUrl,
      message: 'Scan this QR code with your authenticator app'
    });

  } catch (error) {
    console.error('2FA setup error:', error);
    return NextResponse.json({ 
      error: 'Failed to setup 2FA' 
    }, { status: 500 });
  }
} 
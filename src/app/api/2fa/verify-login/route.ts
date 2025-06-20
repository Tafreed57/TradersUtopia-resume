import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import * as OTPAuth from "otpauth";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  try {
    const user = await currentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { code } = await request.json();

    if (!code || code.length !== 6) {
      return NextResponse.json({ error: "Invalid code format" }, { status: 400 });
    }

    // Get the user's profile
    const profile = await db.profile.findUnique({
      where: {
        userId: user.id,
      },
    });

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    if (!profile.twoFactorEnabled || !profile.twoFactorSecret) {
      return NextResponse.json({ error: "2FA not enabled for this account" }, { status: 400 });
    }

    // Verify the TOTP code
    const totp = new OTPAuth.TOTP({
      secret: profile.twoFactorSecret,
      digits: 6,
      period: 30,
    });

    const delta = totp.validate({ token: code, window: 1 });

    if (delta === null) {
      // Check if it's a backup code
      if (profile.backupCodes && profile.backupCodes.includes(code)) {
        // Remove the used backup code
        const updatedBackupCodes = profile.backupCodes.filter(backupCode => backupCode !== code);
        
        await db.profile.update({
          where: { id: profile.id },
          data: {
            backupCodes: updatedBackupCodes,
          },
        });

        // Set 2FA verification cookie
        const cookieStore = cookies();
        cookieStore.set('2fa-verified', 'true', {
          httpOnly: false, // Allow JavaScript to read this cookie
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 60 * 60 * 24, // 24 hours
        });

        return NextResponse.json({ 
          success: true, 
          message: "2FA verified with backup code",
          backupCodeUsed: true 
        });
      }

      return NextResponse.json({ error: "Invalid authentication code" }, { status: 400 });
    }

    // Set 2FA verification cookie for the session
    const cookieStore = cookies();
    cookieStore.set('2fa-verified', 'true', {
      httpOnly: false, // Allow JavaScript to read this cookie
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24, // 24 hours
    });

    return NextResponse.json({ 
      success: true, 
      message: "2FA verification successful" 
    });

  } catch (error) {
    console.error("2FA login verification error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
} 
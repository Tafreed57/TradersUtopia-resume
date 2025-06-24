import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const user = await currentUser();

    if (!user) {
      return NextResponse.json({ 
        authenticated: false,
        requires2FA: false,
        verified: false 
      });
    }

    // Check if user has 2FA enabled by directly querying the database
    const profile = await db.profile.findUnique({
      where: {
        userId: user.id,
      },
      select: {
        twoFactorEnabled: true,
      },
    });

    if (!profile) {
      return NextResponse.json({ 
        authenticated: true,
        requires2FA: false,
        verified: true,
        error: 'Profile not found'
      });
    }
    
    if (!profile.twoFactorEnabled) {
      return NextResponse.json({ 
        authenticated: true,
        requires2FA: false,
        verified: true 
      });
    }

    // Check if 2FA verification cookie exists (server-side only)
    const cookieStore = cookies();
    const verificationCookie = cookieStore.get('2fa-verified');
    const isVerified = verificationCookie?.value === 'true';

    return NextResponse.json({ 
      authenticated: true,
      requires2FA: true,
      verified: isVerified 
    });

  } catch (error) {
    console.error("2FA status check error:", error);
    return NextResponse.json({ 
      authenticated: false,
      requires2FA: false,
      verified: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
} 
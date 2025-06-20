import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  try {
    // Clear the 2FA verification cookie
    const cookieStore = cookies();
    cookieStore.delete('2fa-verified');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Sign-out cleanup error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
} 
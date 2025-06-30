import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const user = await currentUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Find the user's profile
    const profile = await db.profile.findFirst({
      where: { userId: user.id },
    });

    if (!profile) {
      return NextResponse.json({
        isAdmin: false,
        message: "Profile not found",
      });
    }

    return NextResponse.json({
      isAdmin: profile.isAdmin,
      profile: {
        id: profile.id,
        email: profile.email,
        isAdmin: profile.isAdmin,
      },
    });
  } catch (error) {
    console.error("Error checking admin status:", error);
    return NextResponse.json(
      {
        isAdmin: false,
        error: "Failed to check admin status",
      },
      { status: 500 },
    );
  }
}

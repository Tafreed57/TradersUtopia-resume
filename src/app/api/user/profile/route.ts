import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const user = await currentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Find the user's profile in our database
    const profile = await db.profile.findUnique({
      where: {
        userId: user.id,
      },
      select: {
        id: true,
        name: true,
        email: true,
        imageUrl: true,
        twoFactorEnabled: true,
        isAdmin: true,
        subscriptionStatus: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    return NextResponse.json(profile);
  } catch (error) {
    console.error("Error fetching profile:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
} 
import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { rateLimitGeneral, trackSuspiciousActivity } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResult = await rateLimitGeneral()(request);
    if (!rateLimitResult.success) {
      return rateLimitResult.error;
    }

    // Authentication check
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Get user profile with notification preferences
    const profile = await db.profile.findFirst({
      where: { userId: user.id },
      select: {
        emailNotifications: true,
        pushNotifications: true,
      },
    });

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      preferences: {
        email: profile.emailNotifications || {
          system: true,
          security: true,
          payment: true,
          messages: true,
          mentions: true,
          serverUpdates: false,
        },
        push: profile.pushNotifications || {
          system: true,
          security: true,
          payment: true,
          messages: true,
          mentions: true,
          serverUpdates: false,
        },
      },
    });
  } catch (error) {
    console.error("❌ [PREFERENCES] Get preferences error:", error);
    return NextResponse.json(
      {
        error: "Failed to load preferences",
        message: "Could not retrieve notification preferences",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResult = await rateLimitGeneral()(request);
    if (!rateLimitResult.success) {
      return rateLimitResult.error;
    }

    // Authentication check
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const { preferences } = body;

    if (!preferences || !preferences.email || !preferences.push) {
      return NextResponse.json(
        {
          error: "Invalid preferences format",
          message: "Both email and push preferences are required",
        },
        { status: 400 },
      );
    }

    // Update user profile with new preferences
    const updatedProfile = await db.profile.update({
      where: { userId: user.id },
      data: {
        emailNotifications: preferences.email,
        pushNotifications: preferences.push,
      },
    });

    console.log(
      `✅ [PREFERENCES] Updated notification preferences for user: ${user.id}`,
    );

    return NextResponse.json({
      success: true,
      message: "Notification preferences updated successfully",
    });
  } catch (error) {
    console.error("❌ [PREFERENCES] Save preferences error:", error);
    trackSuspiciousActivity(request, "NOTIFICATION_PREFERENCES_SAVE_ERROR");

    return NextResponse.json(
      {
        error: "Failed to save preferences",
        message: "Could not save notification preferences",
      },
      { status: 500 },
    );
  }
}

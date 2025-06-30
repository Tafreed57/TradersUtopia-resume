import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import {
  getUnreadNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from "@/lib/notifications";
import {
  rateLimitNotification,
  trackSuspiciousActivity,
} from "@/lib/rate-limit";
import { validateInput, notificationActionSchema } from "@/lib/validation";


// Mark this route as dynamic to prevent static generation
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  try {
    // ✅ SECURITY: Rate limiting for notification access
    const rateLimitResult = await rateLimitNotification()(request);
    if (!rateLimitResult.success) {
      trackSuspiciousActivity(request, "NOTIFICATIONS_GET_RATE_LIMIT_EXCEEDED");
      return rateLimitResult.error;
    }

    // ✅ SECURITY: Authentication check
    const user = await currentUser();
    if (!user) {
      trackSuspiciousActivity(request, "UNAUTHENTICATED_NOTIFICATIONS_ACCESS");
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const notifications = await getUnreadNotifications(user.id);

    return NextResponse.json({
      notifications,
      count: notifications.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ [NOTIFICATIONS] Fetch notifications error:", error);
    trackSuspiciousActivity(request, "NOTIFICATIONS_FETCH_ERROR");

    return NextResponse.json(
      {
        error: "Failed to fetch notifications",
        message: "Could not retrieve notifications at this time",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // ✅ SECURITY: Rate limiting for notification operations
    const rateLimitResult = await rateLimitNotification()(request);
    if (!rateLimitResult.success) {
      trackSuspiciousActivity(request, "NOTIFICATIONS_RATE_LIMIT_EXCEEDED");
      return rateLimitResult.error;
    }

    // ✅ SECURITY: Authentication check
    const user = await currentUser();
    if (!user) {
      trackSuspiciousActivity(request, "UNAUTHENTICATED_NOTIFICATIONS_ACTION");
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // ✅ SECURITY: Input validation
    const validationResult = await validateInput(notificationActionSchema)(
      request,
    );
    if (!validationResult.success) {
      trackSuspiciousActivity(request, "INVALID_NOTIFICATIONS_INPUT");
      return validationResult.error;
    }

    const { action, notificationId } = validationResult.data;

    // ✅ SECURITY: Enhanced operation handling with logging
    if (action === "mark_read" && notificationId) {
      console.log(
        `📖 [NOTIFICATIONS] Marking notification as read: ${notificationId} for user: ${user.id}`,
      );

      const success = await markNotificationAsRead(notificationId);
      if (success) {
        return NextResponse.json({
          success: true,
          message: "Notification marked as read",
          notificationId,
        });
      } else {
        trackSuspiciousActivity(request, "NOTIFICATION_MARK_READ_FAILED");
        return NextResponse.json(
          {
            error: "Failed to mark notification as read",
            message: "Could not update notification status",
          },
          { status: 500 },
        );
      }
    }

    if (action === "mark_all_read") {
      console.log(
        `📖 [NOTIFICATIONS] Marking all notifications as read for user: ${user.id}`,
      );

      const success = await markAllNotificationsAsRead(user.id);
      if (success) {
        return NextResponse.json({
          success: true,
          message: "All notifications marked as read",
          userId: user.id,
        });
      } else {
        trackSuspiciousActivity(request, "NOTIFICATION_MARK_ALL_READ_FAILED");
        return NextResponse.json(
          {
            error: "Failed to mark all notifications as read",
            message: "Could not update notification status",
          },
          { status: 500 },
        );
      }
    }

    if (action === "delete" && notificationId) {
      console.log(
        `🗑️ [NOTIFICATIONS] Delete action requested for notification: ${notificationId}`,
      );
      // Note: Delete functionality would need to be implemented in notifications lib
      return NextResponse.json(
        {
          error: "Delete action not yet implemented",
          message: "Notification deletion is not currently available",
        },
        { status: 501 },
      );
    }

    // Should not reach here due to validation, but extra safety
    trackSuspiciousActivity(request, "INVALID_NOTIFICATION_ACTION");
    return NextResponse.json(
      {
        error: "Invalid action",
        message: "The requested action is not supported",
      },
      { status: 400 },
    );
  } catch (error) {
    console.error("❌ [NOTIFICATIONS] Notification action error:", error);
    trackSuspiciousActivity(request, "NOTIFICATIONS_ACTION_ERROR");

    return NextResponse.json(
      {
        error: "Failed to process notification action",
        message: "An internal error occurred while processing your request",
      },
      { status: 500 },
    );
  }
}

import { toast } from "sonner";
import { db } from "@/lib/db";

// Toast notification types
export type ToastType = "success" | "error" | "info" | "warning";

// Toast notification wrapper
export const showToast = {
  success: (message: string, description?: string) => {
    toast.success(message, { description });
  },
  error: (message: string, description?: string) => {
    toast.error(message, { description });
  },
  info: (message: string, description?: string) => {
    toast.info(message, { description });
  },
  warning: (message: string, description?: string) => {
    toast.warning(message, { description });
  },
  promise: <T>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string;
      error: string;
    }
  ) => {
    return toast.promise(promise, messages);
  }
};

// Database notification functions
export async function createNotification({
  userId,
  type,
  title,
  message,
  actionUrl,
}: {
  userId: string;
  type: "MESSAGE" | "MENTION" | "SERVER_UPDATE" | "FRIEND_REQUEST" | "SYSTEM" | "PAYMENT" | "SECURITY";
  title: string;
  message: string;
  actionUrl?: string;
}) {
  try {
    const notification = await db.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        actionUrl,
      },
    });
    return notification;
  } catch (error) {
    console.error("Failed to create notification:", error);
    return null;
  }
}

export async function getUnreadNotifications(userId: string) {
  try {
    const notifications = await db.notification.findMany({
      where: {
        userId,
        read: false,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 50, // Limit to recent 50 notifications
    });
    return notifications;
  } catch (error) {
    console.error("Failed to fetch notifications:", error);
    return [];
  }
}

export async function markNotificationAsRead(notificationId: string) {
  try {
    await db.notification.update({
      where: { id: notificationId },
      data: { read: true },
    });
    return true;
  } catch (error) {
    console.error("Failed to mark notification as read:", error);
    return false;
  }
}

export async function markAllNotificationsAsRead(userId: string) {
  try {
    await db.notification.updateMany({
      where: {
        userId,
        read: false,
      },
      data: { read: true },
    });
    return true;
  } catch (error) {
    console.error("Failed to mark all notifications as read:", error);
    return false;
  }
} 
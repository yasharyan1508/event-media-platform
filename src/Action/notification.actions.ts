"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/src/Library/dal";
import {
  getNotificationsForCurrentUser,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  NotificationRecord,
} from "@/src/Library/dal/notification.dal";

// Wrapper types
type ActionSuccess<T> = { success: true; data: T };
type ActionError = { success: false; error: string };
type ActionResult<T> = ActionSuccess<T> | ActionError;

// ─── ACTION: GET NOTIFICATIONS (PAGINATED) ──────────────────────────────────
export async function getNotifications(
  cursor?: string,
  limit: number = 20
): Promise<ActionResult<{ items: NotificationRecord[]; nextCursor: string | null }>> {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return { success: false, error: "Unauthorized: No active session." };
    }

    const { data, nextCursor } = await getNotificationsForCurrentUser(cursor, limit);
    return { success: true, data: { items: data, nextCursor: nextCursor ?? null } };
  } catch (error) {
    console.error("[getNotifications] error:", error);
    return {
      success: false,
      error: "Failed to fetch notifications. Please try again.",
    };
  }
}

// ─── ACTION: MARK SINGLE NOTIFICATION READ ──────────────────────────────────
export async function markNotificationRead(
  notificationId: string
): Promise<ActionResult<void>> {
  try {
    if (!notificationId || typeof notificationId !== "string") {
      return { success: false, error: "Invalid notification ID." };
    }

    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return { success: false, error: "Unauthorized: No active session." };
    }

    await markNotificationAsRead(notificationId, currentUser.id);

    // Revalidate paths that render notification state
    revalidatePath("/", "layout");
    return { success: true, data: undefined };
  } catch (error) {
    console.error("[markNotificationRead] error:", error);
    return {
      success: false,
      error: "Failed to mark notification as read.",
    };
  }
}

// ─── ACTION: MARK ALL NOTIFICATIONS READ ───────────────────────────────────
export async function markAllNotificationsRead(): Promise<ActionResult<void>> {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return { success: false, error: "Unauthorized: No active session." };
    }

    await markAllNotificationsAsRead(currentUser.id);

    revalidatePath("/", "layout");
    return { success: true, data: undefined };
  } catch (error) {
    console.error("[markAllNotificationsRead] error:", error);
    return {
      success: false,
      error: "Failed to mark all notifications as read.",
    };
  }
}

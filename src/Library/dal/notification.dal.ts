import { Prisma, NotificationType } from "@prisma/client";
import { getCurrentUser } from "@/src/Library/dal";
import { notificationEmitter } from "@/src/Library/events/notificationEmitter";

// Use global prisma instance if possible, assuming it's exported from dal or db
import { prisma as db } from "@/src/Library/prisma";

export type CreateNotificationInput = {
  userId: string;
  actorId?: string;
  type: NotificationType;
  message: string;
  metadata?: Prisma.InputJsonValue;
};

export type NotificationRecord = {
  id: string;
  userId: string;
  actorId: string | null;
  type: NotificationType;
  message: string;
  isRead: boolean;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
  actor: {
    id: string;
    name: string | null;
    avatarUrl: string | null;
  } | null;
};

export async function createNotification(
  input: CreateNotificationInput,
  tx?: Prisma.TransactionClient
): Promise<void> {
  const client = tx ?? db;
  
  if (input.actorId && input.actorId === input.userId) {
    return;
  }

  const createdNotification = await client.notification.create({
    data: {
      userId: input.userId,
      actorId: input.actorId,
      type: input.type,
      message: input.message,
      metadata: input.metadata,
    },
    include: {
      actor: {
        select: { id: true, name: true, avatarUrl: true }
      }
    }
  });

  notificationEmitter.emit(`notification:${input.userId}`, createdNotification);
}

export async function getNotificationsForCurrentUser(
  cursor?: string,
  limit: number = 20
) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { data: [], nextCursor: null };

  const notifications = await db.notification.findMany({
    where: { userId: currentUser.id },
    take: limit + 1,
    skip: cursor ? 1 : 0,
    cursor: cursor ? { id: cursor } : undefined,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      userId: true,
      actorId: true,
      type: true,
      message: true,
      isRead: true,
      metadata: true,
      createdAt: true,
      actor: {
        select: {
          id: true,
          name: true,
          avatarUrl: true,
        },
      },
    },
  });

  let nextCursor: typeof cursor | null = null;
  if (notifications.length > limit) {
    const nextItem = notifications.pop();
    nextCursor = nextItem!.id;
  }

  return { data: notifications as NotificationRecord[], nextCursor };
}

export async function getUnreadCountForUser(userId: string): Promise<number> {
  return db.notification.count({
    where: { userId, isRead: false },
  });
}

export async function markNotificationAsRead(
  notificationId: string,
  userId: string,
  tx?: Prisma.TransactionClient
): Promise<void> {
  const client = tx ?? db;
  await client.notification.updateMany({
    where: {
      id: notificationId,
      userId,
    },
    data: { isRead: true },
  });
}

export async function markAllNotificationsAsRead(
  userId: string,
  tx?: Prisma.TransactionClient
): Promise<void> {
  const client = tx ?? db;
  await client.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });
}

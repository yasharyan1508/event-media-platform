"use server";

import { getCurrentUser, requirePermission, requireOwnership } from "@/src/Library/dal";
import { Permission } from "@/src/Constants/permissions";
import { prisma } from "@/src/Library/prisma";

type PublishResult = 
  | { success: true; isPublished: boolean }
  | { error: string };

export async function publishEvent(eventId: string): Promise<PublishResult> {
  try {
    const user = await getCurrentUser();
    await requirePermission(Permission.EVENT_PUBLISH);

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { ownerId: true, isPublished: true }
    });

    if (!event) return { error: "Not found" };

    await requireOwnership(event.ownerId);

    const newPublishedState = !event.isPublished;

    await prisma.event.update({
      where: { id: eventId },
      data: { isPublished: newPublishedState },
      select: { id: true }
    });

    try {
      await prisma.auditLog.create({
        data: {
          action: "EVENT_PUBLISHED",
          entityType: "Event",
          entityId: eventId,
          actorId: user.id,
          metadata: JSON.stringify({ isPublished: newPublishedState })
        }
      });
    } catch (e) {
      console.error(e);
    }

    return { success: true, isPublished: newPublishedState };
  } catch (error) {
    console.error("Event publish error:", error);
    if (error instanceof Error && error.message.includes("Forbidden")) {
      return { error: error.message };
    }
    return { error: "Failed to publish event" };
  }
}

"use server";

import { getCurrentUser, requireOwnership } from "@/src/Library/dal";
import { prisma } from "@/src/Library/prisma";

type DeleteResult = 
  | { success: true }
  | { error: string };

export async function deleteEvent(eventId: string): Promise<DeleteResult> {
  try {
    const user = await getCurrentUser();

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { 
        title: true, 
        ownerId: true,
        albums: {
          select: {
            _count: { select: { media: true } }
          }
        }
      }
    });

    if (!event) return { error: "Not found" };

    await requireOwnership(event.ownerId);

    let mediaCount = 0;
    for (const album of event.albums) {
      mediaCount += album._count.media;
    }

    await prisma.event.delete({
      where: { id: eventId },
      select: { id: true }
    });

    try {
      await prisma.auditLog.create({
        data: {
          action: "EVENT_DELETED",
          entityType: "Event",
          entityId: eventId,
          actorId: user.id,
          metadata: JSON.stringify({ title: event.title, mediaCount }),
        }
      });
    } catch (e) {
      console.error(e);
    }

    return { success: true };
  } catch (error) {
    console.error("Event delete error:", error);
    if (error instanceof Error && error.message.includes("Forbidden")) {
      return { error: error.message };
    }
    return { error: "Failed to delete event" };
  }
}

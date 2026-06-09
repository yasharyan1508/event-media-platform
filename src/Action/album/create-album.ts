"use server";

import { getCurrentUser, requirePermission } from "@/src/Library/dal";
import { Permission } from "@/src/Constants/permissions";
import { prisma } from "@/src/Library/prisma";
import { resolveEventAccess, EventAccessLevel } from "@/src/Library/rbac";
import { createAlbumSchema } from "@/src/Schemas/album/album.schema";
import { AuditAction } from "@prisma/client";

export async function createAlbum(input: unknown) {
  try {
    const currentUser = await getCurrentUser();
    await requirePermission(Permission.ALBUM_CREATE);

    const parsed = createAlbumSchema.safeParse(input);
    if (!parsed.success) {
      return { error: "Invalid input" };
    }

    const event = await prisma.event.findUnique({
      where: { id: parsed.data.eventId },
      include: {
        collaborators: {
          where: { userId: currentUser.id }
        }
      }
    });

    if (!event) {
      return { error: "Event not found" };
    }

    const accessLevel = resolveEventAccess(
      currentUser.id,
      currentUser.role,
      event.ownerId,
      event.collaborators[0]
    );

    if (
      accessLevel === EventAccessLevel.NO_ACCESS ||
      accessLevel === EventAccessLevel.COLLABORATOR_VIEW
    ) {
      return { error: "Forbidden: You do not have permission to create albums in this event" };
    }

    const newAlbum = await prisma.album.create({
      data: {
        title: parsed.data.title,
        description: parsed.data.description,
        eventId: parsed.data.eventId,
        creatorId: currentUser.id
      },
      select: { id: true, title: true, eventId: true }
    });

    try {
      await prisma.auditLog.create({
        data: {
          action: AuditAction.EVENT_CREATED,
          actorId: currentUser.id,
          entityType: "Album",
          entityId: newAlbum.id,
          metadata: { title: newAlbum.title, eventId: newAlbum.eventId }
        }
      });
    } catch (auditError) {
      console.error("Failed to create audit log for album creation:", auditError);
    }

    return { success: true as const, albumId: newAlbum.id };

  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Forbidden")) {
      return { error: error.message };
    }
    console.error("Failed to create album:", error);
    return { error: "Failed to create album" };
  }
}

"use server";

import { getCurrentUser, requirePermission } from "@/src/Library/dal";
import { Permission } from "@/src/Constants/permissions";
import { prisma } from "@/src/Library/prisma";
import { Role, AuditAction } from "@prisma/client";

export async function deleteMedia(mediaId: string) {
  try {
    const currentUser = await getCurrentUser();
    await requirePermission(Permission.MEDIA_DELETE);

    if (!mediaId || typeof mediaId !== "string") {
      return { error: "Invalid media ID" };
    }

    const media = await prisma.media.findUnique({
      where: { id: mediaId },
      include: {
        album: {
          include: {
            event: {
              select: { ownerId: true }
            }
          }
        }
      }
    });

    if (!media) {
      return { error: "Media not found" };
    }

    const isUploader = media.uploaderId === currentUser.id;
    const isEventOwner = media.album.event.ownerId === currentUser.id;

    if (!isUploader && !isEventOwner && currentUser.role !== Role.ADMIN) {
      return { error: "Forbidden: You do not have permission to delete this media" };
    }

    const { filename, s3Key, albumId } = media;

    await prisma.media.delete({
      where: { id: mediaId }
    });

    try {
      await prisma.auditLog.create({
        data: {
          action: AuditAction.MEDIA_DELETED,
          actorId: currentUser.id,
          entityType: "Media",
          entityId: mediaId,
          metadata: { filename, s3Key, albumId }
        }
      });
    } catch (auditError) {
      console.error("Failed to create audit log for media deletion:", auditError);
    }

    return { success: true as const };

  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Forbidden")) {
      return { error: error.message };
    }
    console.error("Failed to delete media:", error);
    return { error: "Failed to delete media" };
  }
}

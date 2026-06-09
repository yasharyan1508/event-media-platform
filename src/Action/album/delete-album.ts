"use server";

import { getCurrentUser } from "@/src/Library/dal";
import { prisma } from "@/src/Library/prisma";
import { checkOwnership } from "@/src/Library/rbac";
import { Role, AuditAction } from "@prisma/client";

export async function deleteAlbum(albumId: string) {
  try {
    const currentUser = await getCurrentUser();

    if (!albumId || typeof albumId !== "string") {
      return { error: "Invalid album ID" };
    }

    const album = await prisma.album.findUnique({
      where: { id: albumId },
      include: {
        event: {
          select: { ownerId: true }
        },
        _count: {
          select: { media: true }
        }
      }
    });

    if (!album) {
      return { error: "Album not found" };
    }

    // Verify ownership (creator, event owner, or ADMIN)
    const isAlbumCreator = checkOwnership(currentUser.id, album.creatorId, currentUser.role);
    const isEventOwner = checkOwnership(currentUser.id, album.event.ownerId, currentUser.role);

    if (!isAlbumCreator && !isEventOwner && currentUser.role !== Role.ADMIN) {
      return { error: "Forbidden: You do not have permission to delete this album" };
    }

    const mediaCount = album._count.media;
    const albumTitle = album.title;

    await prisma.album.delete({
      where: { id: albumId }
    });

    try {
      await prisma.auditLog.create({
        data: {
          action: AuditAction.MEDIA_DELETED,
          actorId: currentUser.id,
          entityType: "Album",
          entityId: albumId,
          metadata: { title: albumTitle, mediaCount }
        }
      });
    } catch (auditError) {
      console.error("Failed to create audit log for album deletion:", auditError);
    }

    return { success: true as const };

  } catch (error) {
    console.error("Failed to delete album:", error);
    return { error: "Failed to delete album" };
  }
}

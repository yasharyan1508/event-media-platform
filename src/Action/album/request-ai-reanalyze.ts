"use server";

import { getCurrentUser } from "@/src/Library/dal";
import { prisma } from "@/src/Library/prisma";
import { Permission } from "@/src/Constants/permissions";
import { hasPermission } from "@/src/Library/rbac";
import { enqueueAiJob } from "@/src/Library/dal";
import { AuditAction } from "@prisma/client";

export async function requestAiReanalyze(mediaId: string) {
  try {
    const user = await getCurrentUser();

    if (!hasPermission(user.role, Permission.AI_TAG)) {
      return { error: "Forbidden: You do not have permission to trigger AI reanalysis." };
    }

    const media = await prisma.media.findUnique({
      where: { id: mediaId },
      include: {
        album: {
          include: {
            event: true
          }
        }
      }
    });

    if (!media) {
      return { error: "Media not found." };
    }

    // Media access check: Must be uploader, event owner, album creator, admin, or collaborator with AI_TAG permission
    const isOwner = media.uploaderId === user.id;
    const isEventOwner = media.album.event.ownerId === user.id;
    const isAlbumCreator = media.album.creatorId === user.id;
    const isAdmin = user.role === "ADMIN";

    if (!isOwner && !isEventOwner && !isAlbumCreator && !isAdmin) {
      // Simplistic check: If photographer, they can reanalyze if they have AI_TAG permission and belong to the event
      // Technically, RBAC collab check should happen, but as per prompt:
      // "Visible only to ADMIN, PHOTOGRAPHER" and "Require AI_TAG permission"
      // We'll let PHOTOGRAPHERs reanalyze if they are an active collaborator.
      const collab = await prisma.eventCollaborator.findUnique({
        where: {
          eventId_userId: { eventId: media.album.eventId, userId: user.id }
        }
      });
      if (!collab) {
         return { error: "Forbidden: Not a collaborator for this event." };
      }
    }

    // Create Audit Log
    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: AuditAction.AI_REANALYZED,
        entityType: "Media",
        entityId: mediaId,
        metadata: { timestamp: new Date().toISOString() }
      }
    });

    // Enqueue the job. Old metadata remains visible until worker overwrites it.
    await enqueueAiJob(mediaId);

    return { success: true as const };
  } catch (error) {
    console.error("Failed to request reanalyze:", error);
    return { error: "Internal Server Error" };
  }
}

"use server";

import { getCurrentUser, requirePermission, enqueueAiJob } from "@/src/Library/dal";
import { Permission } from "@/src/Constants/permissions";
import { prisma } from "@/src/Library/prisma";
import { resolveEventAccess, EventAccessLevel } from "@/src/Library/rbac";
import { buildPublicUrl } from "@/src/Library/s3";
import { MediaStatus } from "@prisma/client";

export type UploadMediaInput = {
  albumId: string;
  s3Key: string;
  filename: string;
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
};

export async function uploadMedia(input: UploadMediaInput) {
  try {
    const currentUser = await getCurrentUser();
    await requirePermission(Permission.MEDIA_UPLOAD);

    const album = await prisma.album.findUnique({
      where: { id: input.albumId },
      include: {
        event: {
          include: {
            collaborators: {
              where: { userId: currentUser.id }
            }
          }
        }
      }
    });

    if (!album) {
      return { error: "Album not found" };
    }

    const accessLevel = resolveEventAccess(
      currentUser.id,
      currentUser.role,
      album.event.ownerId,
      album.event.collaborators[0]
    );

    if (
      accessLevel === EventAccessLevel.NO_ACCESS ||
      accessLevel === EventAccessLevel.COLLABORATOR_VIEW
    ) {
      return { error: "Forbidden: You do not have permission to upload media to this album" };
    }

    const url = buildPublicUrl(input.s3Key);

    const media = await prisma.media.create({
      data: {
        filename: input.filename,
        s3Key: input.s3Key,
        url: `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${input.s3Key}`,
        mimeType: input.mimeType,
        size: input.size,
        width: input.width ?? null,
        height: input.height ?? null,
        status: MediaStatus.PROCESSING,
        albumId: input.albumId,
        uploaderId: currentUser.id
      },
      select: { id: true, url: true, s3Key: true, filename: true }
    });

    await enqueueAiJob(media.id);

    return { success: true as const, media };

  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Forbidden")) {
      return { error: error.message };
    }
    console.error("Failed to upload media:", error);
    return { error: "Failed to save media record" };
  }
}

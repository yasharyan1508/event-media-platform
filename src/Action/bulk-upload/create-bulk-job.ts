"use server";

import { getCurrentUser, requirePermission } from "@/src/Library/dal";
import { Permission } from "@/src/Constants/permissions";
import { createBulkJobSchema } from "@/src/Schemas/bulk-upload/bulk-upload.schema";
import { prisma } from "@/src/Library/prisma";
import { resolveEventAccess, EventAccessLevel } from "@/src/Library/rbac";
import { s3Client, sanitizeFilename, S3_BUCKET_NAME } from "@/src/Library/s3";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { AuditAction } from "@prisma/client";

type FileInfo = {
  filename: string;
  contentType: string;
  fileSize: number;
};

type CreateBulkJobResult =
  | {
      success: true;
      jobId: string;
      presignedFiles: Array<{
        originalFilename: string;
        s3Key: string;
        presignedUrl: string;
      }>;
    }
  | { error: string };

export async function createBulkJob(input: {
  albumId: string;
  files: FileInfo[];
}): Promise<CreateBulkJobResult> {
  try {
    const currentUser = await getCurrentUser();
    await requirePermission(Permission.MEDIA_BULK_UPLOAD);

    const parsed = createBulkJobSchema.safeParse(input);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message || "Validation failed" };
    }

    const { albumId, files } = parsed.data;

    const album = await prisma.album.findUnique({
      where: { id: albumId },
      select: {
        id: true,
        eventId: true,
        event: {
          select: { id: true, ownerId: true },
        },
      },
    });

    if (!album) {
      return { error: "Album not found" };
    }

    const collaborationRecord = await prisma.eventCollaborator.findUnique({
      where: {
        eventId_userId: {
          eventId: album.eventId,
          userId: currentUser.id,
        },
      },
      select: { role: true, acceptedAt: true, revokedAt: true },
    });

    const accessLevel = resolveEventAccess(
      currentUser.id,
      currentUser.role,
      album.event.ownerId,
      collaborationRecord as any
    );

    if (
      accessLevel === EventAccessLevel.NO_ACCESS ||
      accessLevel === EventAccessLevel.COLLABORATOR_VIEW
    ) {
      return { error: "Forbidden: insufficient access" };
    }

    const job = await prisma.bulkUploadJob.create({
      data: {
        albumId,
        submittedById: currentUser.id,
        totalFiles: files.length,
        status: "PENDING",
        startedAt: new Date(),
      },
      select: { id: true },
    });

    const timestamp = Date.now();
    const presignedFiles = [];

    for (const file of files) {
      const sanitizedFilename = sanitizeFilename(file.filename);
      const s3Key = `bulk-uploads/${album.eventId}/${albumId}/${job.id}/${timestamp}-${sanitizedFilename}`;

      const command = new PutObjectCommand({
        Bucket: S3_BUCKET_NAME,
        Key: s3Key,
        ContentType: file.contentType,
        ContentLength: file.fileSize,
      });

      const presignedUrl = await getSignedUrl(s3Client, command, {
        expiresIn: 600,
      });

      presignedFiles.push({
        originalFilename: file.filename,
        s3Key,
        presignedUrl,
      });
    }

    try {
      await prisma.auditLog.create({
        data: {
          actorId: currentUser.id,
          action: AuditAction.BULK_UPLOAD_STARTED,
          entityType: "BulkUploadJob",
          entityId: job.id,
          metadata: { albumId, totalFiles: files.length },
        },
      });
    } catch (auditErr) {
      console.error("AuditLog write failed:", auditErr);
    }

    return {
      success: true,
      jobId: job.id,
      presignedFiles,
    };
  } catch (error: unknown) {
    if (error instanceof Error && error.message.startsWith("Forbidden")) {
      return { error: error.message };
    }
    console.error("createBulkJob error", error);
    return { error: "Internal Server Error" };
  }
}

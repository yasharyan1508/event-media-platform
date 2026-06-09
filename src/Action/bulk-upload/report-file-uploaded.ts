"use server";

import { getCurrentUser, enqueueAiJob } from "@/src/Library/dal";
import { reportFileUploadedSchema } from "@/src/Schemas/bulk-upload/bulk-upload.schema";
import { prisma } from "@/src/Library/prisma";
import { buildPublicUrl } from "@/src/Library/s3";
import { Role, NotificationType, AuditAction, MediaStatus, JobStatus } from "@prisma/client";

export async function reportFileUploaded(input: {
  jobId: string;
  s3Key: string;
  filename: string;
  contentType: string;
  fileSize: number;
  width?: number;
  height?: number;
}) {
  try {
    const currentUser = await getCurrentUser();
    const parsed = reportFileUploadedSchema.safeParse(input);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message || "Validation failed" };
    }

    const { jobId, s3Key, filename, contentType, fileSize, width, height } = parsed.data;

    const job = await prisma.bulkUploadJob.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        albumId: true,
        totalFiles: true,
        processedFiles: true,
        failedFiles: true,
        submittedById: true,
        status: true,
        album: {
          select: { id: true, title: true }
        }
      },
    });

    if (!job) {
      return { error: "Job not found" };
    }

    if (job.submittedById !== currentUser.id && currentUser.role !== Role.ADMIN) {
      return { error: "Forbidden" };
    }

    const publicUrl = buildPublicUrl(s3Key);

    const media = await prisma.media.create({
      data: {
        filename,
        s3Key,
        url: `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`,
        mimeType: contentType,
        size: fileSize,
        width: width ?? null,
        height: height ?? null,
        status: MediaStatus.PROCESSING,
        albumId: job.albumId,
        uploaderId: currentUser.id,
      },
      select: { id: true, url: true },
    });

    await enqueueAiJob(media.id);

    const newProcessed = job.processedFiles + 1;
    const totalDone = newProcessed + job.failedFiles;
    const isComplete = totalDone >= job.totalFiles;

    await prisma.bulkUploadJob.update({
      where: { id: jobId },
      data: {
        processedFiles: newProcessed,
        status: isComplete ? JobStatus.COMPLETED : JobStatus.PROCESSING,
        completedAt: isComplete ? new Date() : null,
      },
    });

    if (isComplete) {
      try {
        await prisma.notification.create({
          data: {
            userId: job.submittedById,
            type: NotificationType.BULK_UPLOAD_COMPLETE,
            message: `Album "${job.album.title}" processed: ${newProcessed} files.`,
            metadata: {
              jobId: job.id,
              albumId: job.album.id,
              totalFiles: job.totalFiles,
              processedFiles: newProcessed,
              failedFiles: job.failedFiles,
            },
          },
        });
      } catch (err) {
        console.error("Failed to create notification", err);
      }

      try {
        await prisma.auditLog.create({
          data: {
            actorId: currentUser.id,
            action: AuditAction.BULK_UPLOAD_COMPLETED,
            entityType: "BulkUploadJob",
            entityId: jobId,
            metadata: {
              processedFiles: newProcessed,
              failedFiles: job.failedFiles,
            },
          },
        });
      } catch (auditErr) {
        console.error("AuditLog write failed", auditErr);
      }
    }

    return {
      success: true as const,
      isComplete,
      processedFiles: newProcessed,
      totalFiles: job.totalFiles,
    };
  } catch (error: unknown) {
    console.error("reportFileUploaded error:", error);
    return { error: "Internal Server Error" };
  }
}

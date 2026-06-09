"use server";

import { getCurrentUser } from "@/src/Library/dal";
import { reportFileFailedSchema } from "@/src/Schemas/bulk-upload/bulk-upload.schema";
import { prisma } from "@/src/Library/prisma";
import { Role, NotificationType, AuditAction, JobStatus } from "@prisma/client";

export async function reportFileFailed(input: {
  jobId: string;
  filename: string;
  errorMessage: string;
}) {
  try {
    const currentUser = await getCurrentUser();
    const parsed = reportFileFailedSchema.safeParse(input);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message || "Validation failed" };
    }

    const { jobId, filename, errorMessage } = parsed.data;

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
        errorLog: true,
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

    const newFailed = job.failedFiles + 1;
    const totalDone = job.processedFiles + newFailed;
    const isComplete = totalDone >= job.totalFiles;

    const currentErrorLog = (job.errorLog as Array<{ filename: string; errorMessage: string }> | null) ?? [];
    const newErrorLog = [...currentErrorLog, { filename, errorMessage }];

    await prisma.bulkUploadJob.update({
      where: { id: jobId },
      data: {
        failedFiles: newFailed,
        status: isComplete 
          ? (job.processedFiles > 0 ? JobStatus.COMPLETED : JobStatus.FAILED)
          : JobStatus.PROCESSING,
        completedAt: isComplete ? new Date() : null,
        errorLog: newErrorLog,
      },
    });

    if (isComplete) {
      try {
        await prisma.notification.create({
            data: {
            userId: job.submittedById,
            type: NotificationType.BULK_UPLOAD_COMPLETE,
            message: `Album "${job.album.title}" upload failed after processing ${job.processedFiles} files.`,
            metadata: {
                jobId: job.id,
                albumId: job.album.id,
                totalFiles: job.totalFiles,
                processedFiles: job.processedFiles,
                failedFiles: newFailed
            }
            }
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
              processedFiles: job.processedFiles,
              failedFiles: newFailed,
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
      processedFiles: job.processedFiles,
      failedFiles: newFailed,
      totalFiles: job.totalFiles,
    };
  } catch (error: unknown) {
    console.error("reportFileFailed error:", error);
    return { error: "Internal Server Error" };
  }
}

"use server";

import { getCurrentUser } from "@/src/Library/dal";
import { prisma } from "@/src/Library/prisma";
import { Role } from "@prisma/client";

export async function cancelBulkJob(jobId: string) {
  try {
    const currentUser = await getCurrentUser();

    const job = await prisma.bulkUploadJob.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        status: true,
        submittedById: true,
        errorLog: true,
      },
    });

    if (!job) {
      return { error: "Job not found" };
    }

    if (job.submittedById !== currentUser.id && currentUser.role !== Role.ADMIN) {
      return { error: "Forbidden" };
    }

    if (job.status === "COMPLETED" || job.status === "FAILED") {
      return { error: "Cannot cancel a completed job" };
    }

    const currentErrorLog = (job.errorLog as Array<{ filename: string; errorMessage: string }> | null) ?? [];
    const newErrorLog = [...currentErrorLog, { filename: "ALL", errorMessage: "Cancelled by user" }];

    await prisma.bulkUploadJob.update({
      where: { id: jobId },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        errorLog: newErrorLog,
      },
    });

    return { success: true as const };
  } catch (error: unknown) {
    console.error("cancelBulkJob error:", error);
    return { error: "Internal Server Error" };
  }
}

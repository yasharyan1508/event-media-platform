import { getCurrentUser } from "@/src/Library/dal";
import { prisma } from "@/src/Library/prisma";
import { resolveEventAccess, EventAccessLevel } from "@/src/Library/rbac";
import { Role, JobStatus } from "@prisma/client";

export type BulkJobSummary = {
  id: string;
  status: JobStatus;
  totalFiles: number;
  processedFiles: number;
  failedFiles: number;
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  submittedBy: {
    id: string;
    name: string | null;
    avatarUrl: string | null;
  };
};

export type BulkJobDetail = BulkJobSummary & {
  errorLog: any;
};

export async function getJobsByAlbum(albumId: string): Promise<BulkJobSummary[]> {
  try {
    const currentUser = await getCurrentUser();

    const album = await prisma.album.findUnique({
      where: { id: albumId },
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
      return [];
    }

    const accessLevel = resolveEventAccess(
      currentUser.id,
      currentUser.role,
      album.event.ownerId,
      album.event.collaborators[0]
    );

    if (accessLevel === EventAccessLevel.NO_ACCESS) {
      return [];
    }

    const jobs = await prisma.bulkUploadJob.findMany({
      where: { albumId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        status: true,
        totalFiles: true,
        processedFiles: true,
        failedFiles: true,
        createdAt: true,
        startedAt: true,
        completedAt: true,
        submittedBy: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          }
        }
      }
    });

    return jobs;
  } catch (error) {
    console.error("getJobsByAlbum error:", error);
    return [];
  }
}

export async function getJobById(jobId: string): Promise<BulkJobDetail | null> {
  try {
    const currentUser = await getCurrentUser();

    const job = await prisma.bulkUploadJob.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        status: true,
        totalFiles: true,
        processedFiles: true,
        failedFiles: true,
        createdAt: true,
        startedAt: true,
        completedAt: true,
        errorLog: true,
        submittedById: true,
        submittedBy: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          }
        }
      }
    });

    if (!job) {
      return null;
    }

    if (job.submittedById !== currentUser.id && currentUser.role !== Role.ADMIN) {
      return null;
    }

    const { submittedById, ...rest } = job;
    return rest;
  } catch (error) {
    console.error("getJobById error:", error);
    return null;
  }
}

import { cache } from "react";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Role, JobStatus, MediaStatus, Prisma, FaceIndexStatus } from "@prisma/client";
import { SearchFaceMatch } from "./rekognition";
import { prisma } from "./prisma";
import { hasPermission, isRoleAtLeast } from "./rbac";
import { Permission } from "../Constants/permissions";
import { ROLE_LEVELS } from "../Constants/roles";
import { cleanAiTags } from "./AI/tag-cleaner";

export type AuthUser = {
  id: string;
  name: string | null;
  avatarUrl: string | null;
  role: Role;
};

/**
 * Get the current authenticated user from the database.
 * Cached per request via React.cache() — safe to call multiple times in one render.
 *
 * Redirects to /sign-in if unauthenticated.
 * Redirects to /account-disabled if the user is deactivated.
 */
export const getCurrentUser = cache(async (): Promise<AuthUser> => {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  let user = await prisma.user.findUnique({
    where: { clerkId: userId },
  });

  if (!user) {
    const client = await clerkClient();
    const clerkUser = await client.users.getUser(userId);

    const email = clerkUser.emailAddresses[0]?.emailAddress;
    if (!email) {
      throw new Error("Clerk user has no email address");
    }

    const name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || null;

    try {
      user = await prisma.user.upsert({
        where: { clerkId: userId },
        update: {},
        create: {
          clerkId: userId,
          email,
          name,
          avatarUrl: clerkUser.imageUrl || null,
          role: email === process.env.ADMIN_EMAIL ? Role.ADMIN : Role.MEMBER,
        },
      });
    } catch (error) {
      user = await prisma.user.findUnique({
        where: { clerkId: userId },
      });
      if (!user) {
        throw error;
      }
    }

    await client.users.updateUserMetadata(userId, {
      publicMetadata: { role: user.role },
    });
  }

  if (!user.isActive) {
    redirect("/account-disabled");
  }

  return {
    id: user.id,
    name: user.name,
    avatarUrl: user.avatarUrl,
    role: user.role,
  };
});

/**
 * Require a minimum role level. Throws 403 if insufficient.
 */
export async function requireRole(minimumRole: Role): Promise<AuthUser> {
  const user = await getCurrentUser();

  if (!isRoleAtLeast(user.role, minimumRole)) {
    throw new Error(
      `Forbidden: requires ${minimumRole}, user has ${user.role}`
    );
  }

  return user;
}

/**
 * Require a specific permission. Throws 403 if insufficient.
 */
export async function requirePermission(
  permission: Permission
): Promise<AuthUser> {
  const user = await getCurrentUser();

  if (!hasPermission(user.role, permission)) {
    throw new Error(
      `Forbidden: requires permission ${permission}, user role ${user.role} does not have it`
    );
  }

  return user;
}

/**
 * Require ownership of an entity. ADMIN bypasses.
 */
export async function requireOwnership(
  ownerId: string
): Promise<AuthUser> {
  const user = await getCurrentUser();

  if (user.role !== Role.ADMIN && user.id !== ownerId) {
    throw new Error("Forbidden: you do not own this resource");
  }

  return user;
}

// ─── AI PROCESSING DAL ──────────────────────────────────────────────────────

/**
 * Enqueue a media item for AI processing
 */
export async function enqueueAiJob(mediaId: string): Promise<void> {
  await prisma.aiProcessingJob.upsert({
    where: { mediaId },
    update: {
      status: JobStatus.PENDING,
      attempts: 0,
      errorLog: Prisma.DbNull,
      startedAt: null,
      completedAt: null,
    },
    create: {
      mediaId,
      status: JobStatus.PENDING,
    },
  });
}

/**
 * Fetch the next pending or retryable AI job
 */
export async function getNextPendingAiJob() {
  return await prisma.aiProcessingJob.findFirst({
    where: {
      status: { in: [JobStatus.PENDING, JobStatus.FAILED] },
      attempts: { lt: 3 }, // Max 3 retries
    },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Update the status and details of an AI job
 */
export async function updateAiJobStatus(
  jobId: string,
  status: JobStatus,
  updates?: { attempts?: number; errorLog?: Prisma.InputJsonValue; startedAt?: Date; completedAt?: Date }
) {
  return await prisma.aiProcessingJob.update({
    where: { id: jobId },
    data: {
      status,
      ...updates,
    },
  });
}

/**
 * Save AI extracted metadata to the Media and AiTag models
 */
export async function saveAiMetadata(
  mediaId: string,
  data: {
    status: MediaStatus;
    aiCaption?: string | null;
    aiQualityScore?: number | null;
    tags?: { label: string; confidence: number }[];
  }
) {
  return await prisma.$transaction(async (tx) => {
    // 1. Update Media
    const media = await tx.media.update({
      where: { id: mediaId },
      data: {
        status: data.status,
        aiCaption: data.aiCaption ?? null,
        aiQualityScore: data.aiQualityScore ?? null,
        aiProcessedAt: new Date(),
        aiVersion: "gemini-2.5-flash",
      },
    });

    // 2. Refresh Tags
    if (data.tags) {
      const cleanedTags = cleanAiTags(data.tags);
      await tx.aiTag.deleteMany({
        where: { mediaId },
      });
      
      if (cleanedTags.length > 0) {
        await tx.aiTag.createMany({
          data: cleanedTags.map((t) => ({
            mediaId,
            label: t.label,
            confidence: t.confidence,
            source: "GEMINI",
          })),
        });
      }
    }

    return media;
  });
}

export async function getTrendingTags() {
  const user = await getCurrentUser();
  if (user.role !== 'ADMIN') {
    throw new Error('Forbidden: Admin access required');
  }

  const trending = await prisma.aiTag.groupBy({
    by: ['label'],
    _count: {
      mediaId: true,
    },
    orderBy: {
      _count: {
        mediaId: 'desc'
      }
    },
    take: 50,
  });

  return trending.map((t: any) => ({
    label: t.label,
    count: t._count.mediaId
  }));
}

// ─── FACIAL RECOGNITION DAL ─────────────────────────────────────────────────

export async function createFaceIndex(data: {
  userId: string;
  rekognitionFaceId: string;
  s3KeySample: string;
  confidence: number;
  consentGivenAt: Date;
}) {
  return await prisma.faceIndex.create({
    data: {
      userId: data.userId,
      rekognitionFaceId: data.rekognitionFaceId,
      s3KeySample: data.s3KeySample,
      confidence: data.confidence,
      consentGivenAt: data.consentGivenAt,
      status: FaceIndexStatus.INDEXED,
    },
  });
}

export async function getFaceIndex(faceIndexId: string) {
  return await prisma.faceIndex.findUnique({
    where: { id: faceIndexId },
  });
}

export async function getUserFaceIndexes(userId: string) {
  return await prisma.faceIndex.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}

export async function deleteFaceIndex(faceIndexId: string) {
  return await prisma.$transaction(async (tx) => {
    // 1. Delete all MediaFace matches to revoke access
    await tx.mediaFace.deleteMany({
      where: { faceIndexId },
    });

    // 2. Transition FaceIndex to DELETED status instead of hard deleting
    return await tx.faceIndex.update({
      where: { id: faceIndexId },
      data: { status: FaceIndexStatus.DELETED },
    });
  });
}

export async function saveMediaFaces(mediaId: string, matches: SearchFaceMatch[]) {
  // Clear any existing matches for this media to ensure idempotency
  await prisma.mediaFace.deleteMany({
    where: { mediaId },
  });

  if (matches.length === 0) return;

  // We need to map rekognitionFaceId back to our internal faceIndexId
  const rekognitionIds = matches.map(m => m.faceId);
  const faceIndexes = await prisma.faceIndex.findMany({
    where: { rekognitionFaceId: { in: rekognitionIds } },
    select: { id: true, rekognitionFaceId: true }
  });

  const indexMap = new Map(faceIndexes.map(fi => [fi.rekognitionFaceId, fi.id]));

  // Build the payload
  const mediaFacesToCreate = matches
    .filter(match => indexMap.has(match.faceId))
    .map(match => ({
      mediaId,
      faceIndexId: indexMap.get(match.faceId)!,
      confidence: match.confidence,
      similarity: match.similarity,
      boundingBox: match.boundingBox as Prisma.InputJsonValue,
    }));

  if (mediaFacesToCreate.length > 0) {
    // skipDuplicates handles the @@unique([mediaId, faceIndexId]) constraint gracefully
    await prisma.mediaFace.createMany({
      data: mediaFacesToCreate,
      skipDuplicates: true,
    });
  }
}

export async function getMediaByFaceIndex(faceIndexId: string, eventId?: string) {
  return await prisma.mediaFace.findMany({
    where: {
      faceIndexId,
      ...(eventId ? { media: { album: { eventId } } } : {}),
    },
    include: {
      media: {
        include: {
          album: {
            select: { eventId: true }
          }
        }
      }
    },
    orderBy: { similarity: "desc" },
  });
}

export async function getFacesInMedia(mediaId: string) {
  return await prisma.mediaFace.findMany({
    where: { mediaId },
    include: {
      faceIndex: {
        include: {
          user: { select: { name: true, avatarUrl: true } }
        }
      }
    },
  });
}

export async function markFaceIndexFailed(faceIndexId: string, reason: string) {
  return await prisma.faceIndex.update({
    where: { id: faceIndexId },
    data: {
      status: FaceIndexStatus.FAILED,
      failureReason: reason,
    },
  });
}

"use server";

import { requirePermission } from "@/src/Library/dal";
import { prisma } from "@/src/Library/prisma";
import { indexFaceInCollection } from "@/src/Library/rekognition";
import { AuditAction, FaceIndexStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { Permission } from "@/src/Constants/permissions";

export async function retryFaceIndex(faceIndexId: string) {
  try {
    const user = await requirePermission(Permission.FACE_INDEX_CREATE);

    const faceIndex = await prisma.faceIndex.findUnique({
      where: { id: faceIndexId },
    });

    if (!faceIndex || faceIndex.status !== FaceIndexStatus.FAILED) {
      return { error: "Face index not found or is not in FAILED state." };
    }

    // 1. Transition FAILED -> PENDING
    await prisma.faceIndex.update({
      where: { id: faceIndexId },
      data: {
        status: FaceIndexStatus.PENDING,
        failureReason: null,
      },
    });

    try {
      // 2. Call AWS Rekognition
      const bucket = process.env.AWS_BUCKET_NAME!;
      const rekognitionResult = await indexFaceInCollection(bucket, faceIndex.s3KeySample);

      // 3. Success: Update to INDEXED
      await prisma.faceIndex.update({
        where: { id: faceIndex.id },
        data: {
          rekognitionFaceId: rekognitionResult.faceId,
          confidence: rekognitionResult.confidence,
          status: FaceIndexStatus.INDEXED,
        },
      });

      // 4. Log Audit
      await prisma.auditLog.create({
        data: {
          actorId: user.id,
          action: AuditAction.FACE_INDEXED,
          entityType: "FaceIndex",
          entityId: faceIndex.id,
        },
      });

      revalidatePath("/admin/ai");
      return { success: true };
    } catch (awsError: any) {
      console.error("[retryFaceIndex AWS Error]", awsError);
      // 3. Failure: Revert to FAILED
      await prisma.faceIndex.update({
        where: { id: faceIndex.id },
        data: {
          status: FaceIndexStatus.FAILED,
          failureReason: awsError.message || "Unknown AWS Error",
        },
      });
      return { error: awsError.message || "Failed to index face with AWS." };
    }
  } catch (error: any) {
    console.error("[retryFaceIndex Action] Error:", error);
    return { error: error.message || "Failed to retry face indexing." };
  }
}

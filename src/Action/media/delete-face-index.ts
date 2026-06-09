"use server";

import { getCurrentUser, requirePermission } from "@/src/Library/dal";
import { getFaceIndex, deleteFaceIndex } from "@/src/Library/dal";
import { deleteFaceFromCollection } from "@/src/Library/rekognition";
import { deleteMediaFromS3 } from "@/src/Library/s3";
import { prisma } from "@/src/Library/prisma";
import { checkOwnership } from "@/src/Library/rbac";
import { AuditAction } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { Permission } from "@/src/Constants/permissions";

export async function removeFaceIndex(faceIndexId: string) {
  try {
    const user = await getCurrentUser();
    
    const faceIndex = await getFaceIndex(faceIndexId);
    if (!faceIndex) {
      return { error: "Face index not found." };
    }

    // 0. Ensure explicit permission constraint (fixing checklist item 5)
    await requirePermission(Permission.FACE_INDEX_DELETE);

    const isOwner = checkOwnership(user.id, faceIndex.userId, user.role);
    // If not owner, check if they have global delete rights
    if (!isOwner && user.role !== "ADMIN" && user.role !== "PHOTOGRAPHER") {
      return { error: "Forbidden: You do not have permission to delete this face index." };
    }

    // 1. Delete from AWS Rekognition if it exists
    if (faceIndex.rekognitionFaceId) {
      try {
        await deleteFaceFromCollection(faceIndex.rekognitionFaceId);
      } catch (awsError) {
        console.error("[AWS Delete Error]", awsError);
        // Continue to delete from our DB even if AWS fails, so the user isn't stuck
      }
    }

    // 2. Delete sample image from S3
    try {
      if (faceIndex.s3KeySample) {
        await deleteMediaFromS3(faceIndex.s3KeySample);
      }
    } catch (s3Error) {
      console.error("[S3 Delete Error]", s3Error);
    }

    // 3. Delete from DB (Status transitioned to DELETED)
    await deleteFaceIndex(faceIndexId);

    // 4. Log Audit
    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: AuditAction.FACE_DELETED,
        entityType: "FaceIndex",
        entityId: faceIndex.id,
      },
    });

    revalidatePath("/admin/ai");
    return { success: true };
  } catch (error: any) {
    console.error("[removeFaceIndex Action] Error:", error);
    return { error: error.message || "Failed to delete face index." };
  }
}

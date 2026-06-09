"use server";

import { z } from "zod";
import { requirePermission } from "@/src/Library/dal";
import { prisma } from "@/src/Library/prisma";
import { indexFaceInCollection } from "@/src/Library/rekognition";
import { AuditAction, FaceIndexStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { Permission } from "@/src/Constants/permissions";

const IndexFaceSchema = z.object({
  s3Key: z.string().min(1, "S3 Key is required"),
  consentGiven: z.boolean().refine((val) => val === true, {
    message: "Consent must be explicitly given",
  }),
});

export async function indexFace(formData: FormData) {
  try {
    const user = await requirePermission(Permission.FACE_INDEX_CREATE);

    const validatedFields = IndexFaceSchema.safeParse({
      s3Key: formData.get("s3Key"),
      consentGiven: formData.get("consentGiven") === "true",
    });

    if (!validatedFields.success) {
      return { error: "Invalid form data. Explicit consent is required." };
    }

    const { s3Key } = validatedFields.data;

    // 1. Create FaceIndex in PENDING state
    const faceIndex = await prisma.faceIndex.create({
      data: {
        userId: user.id,
        s3KeySample: s3Key,
        confidence: 0, // Will be updated
        consentGivenAt: new Date(),
        status: FaceIndexStatus.PENDING,
      },
    });

    try {
      // 2. Call AWS Rekognition
      const bucket = process.env.AWS_BUCKET_NAME!;
      const rekognitionResult = await indexFaceInCollection(bucket, s3Key);

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

    } catch (awsError: any) {
      console.error("[indexFace AWS Error]", awsError);
      // 3. Failure: Update to FAILED
      await prisma.faceIndex.update({
        where: { id: faceIndex.id },
        data: {
          status: FaceIndexStatus.FAILED,
          failureReason: awsError.message || "Unknown AWS Error",
        },
      });
      return { error: awsError.message || "Failed to index face with AWS." };
    }

    revalidatePath("/admin/ai");
    return { success: true, data: faceIndex };
  } catch (error: any) {
    console.error("[indexFace Action] Error:", error);
    return { error: error.message || "Failed to initialize face indexing." };
  }
}

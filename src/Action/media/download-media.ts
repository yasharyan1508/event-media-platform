"use server";

import { getCurrentUser, requirePermission } from "../../Library/dal";
import { prisma } from "../../Library/prisma";
import { Permission } from "../../Constants/permissions";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3Client = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export async function downloadMedia(mediaId: string): Promise<{ success: true; downloadUrl: string } | { error: string }> {
  try {
    await getCurrentUser();
    await requirePermission(Permission.MEDIA_DOWNLOAD_ORIGINAL);

    const media = await prisma.media.findUnique({
      where: { id: mediaId },
    });

    if (!media) {
      return { error: "Media not found" };
    }

    const command = new GetObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET_NAME!,
      Key: media.s3Key,
    });

    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

    return { success: true, downloadUrl: presignedUrl };
  } catch (error) {
    console.error("Error generating download link:", error);
    return { error: "Failed to generate download link" };
  }
}

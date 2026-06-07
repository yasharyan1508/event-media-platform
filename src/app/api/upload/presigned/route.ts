import { NextResponse } from "next/server";
import { getCurrentUser } from "@/src/Library/dal";
import { s3Client, S3_BUCKET_NAME, sanitizeFilename, buildPublicUrl } from "@/src/Library/s3";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { z } from "zod";

const uploadSchema = z.object({
  filename: z.string().min(1),
  contentType: z.string().refine((val) => val.startsWith("image/") || val === "video/mp4", {
    message: "Invalid content type. Only images and video/mp4 are allowed.",
  }),
  fileSize: z.number().max(209715200, "File size must not exceed 200MB"),
});

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();

    const body = await req.json();
    const parsed = uploadSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Validation failed" }, { status: 400 });
    }

    const { filename, contentType, fileSize } = parsed.data;
    const sanitizedFilename = sanitizeFilename(filename);
    const s3Key = `uploads/${user.id}/${Date.now()}-${sanitizedFilename}`;

    const command = new PutObjectCommand({
      Bucket: S3_BUCKET_NAME,
      Key: s3Key,
      ContentType: contentType,
      ContentLength: fileSize,
    });

    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });
    const publicUrl = buildPublicUrl(s3Key);

    return NextResponse.json({ presignedUrl, s3Key, publicUrl });
  } catch (error) {
    console.error("Presigned URL generation error:", error);
    
    // Handle unauthenticated redirects correctly from getCurrentUser
    if (error instanceof Error && (error.message.includes("NEXT_REDIRECT") || error.message.includes("Forbidden"))) {
      return NextResponse.json({ error: "Auth error. Please sign in." }, { status: 401 });
    }
    
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

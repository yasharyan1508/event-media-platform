import { S3Client } from "@aws-sdk/client-s3";

export const S3_BUCKET_NAME = process.env.AWS_BUCKET_NAME!;

const globalForS3 = globalThis as unknown as {
  s3Client: S3Client | undefined;
};

function createS3Client(): S3Client {
  return new S3Client({
    region: process.env.AWS_REGION!,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });
}

export const s3Client = globalForS3.s3Client ?? createS3Client();

if (process.env.NODE_ENV !== "production") {
  globalForS3.s3Client = s3Client;
}

export function buildPublicUrl(s3Key: string): string {
  return `https://${S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;
}

export function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9.\-_]/g, "_");
}

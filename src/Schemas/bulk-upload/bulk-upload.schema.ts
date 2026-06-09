import { z } from "zod";

export const createBulkJobSchema = z.object({
  albumId: z.string().min(1, "Album ID required"),
  files: z.array(
    z.object({
      filename: z.string().min(1),
      contentType: z.string().min(1),
      fileSize: z.number()
        .min(1, "File cannot be empty")
        .max(209715200, "File exceeds 200MB limit"),
    })
  ).min(1, "At least one file required")
   .max(100, "Maximum 100 files per bulk upload"),
});

export const reportFileUploadedSchema = z.object({
  jobId: z.string().min(1),
  s3Key: z.string().min(1),
  filename: z.string().min(1),
  contentType: z.string().min(1),
  fileSize: z.number().min(1),
  width: z.number().optional(),
  height: z.number().optional(),
});

export const reportFileFailedSchema = z.object({
  jobId: z.string().min(1),
  filename: z.string().min(1),
  errorMessage: z.string().min(1),
});

export type CreateBulkJobInput = z.infer<typeof createBulkJobSchema>;
export type ReportFileUploadedInput = z.infer<typeof reportFileUploadedSchema>;
export type ReportFileFailedInput = z.infer<typeof reportFileFailedSchema>;

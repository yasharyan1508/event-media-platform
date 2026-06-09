import { z } from "zod";

export const commentSchema = z.object({
  body: z.string().min(1, "Comment cannot be empty"),
  mediaId: z.string().min(1, "Media ID is required"),
  parentId: z.string().optional(),
});

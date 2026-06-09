import { z } from "zod";

export const createAlbumSchema = z.object({
  title: z.string().min(1, "Title required").max(100),
  description: z.string().max(500).optional().transform(v => v === "" ? undefined : v),
  eventId: z.string().min(1, "Event ID required"),
});

export const updateAlbumSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().transform(v => v === "" ? undefined : v),
});

export type CreateAlbumInput = z.infer<typeof createAlbumSchema>;
export type UpdateAlbumInput = z.infer<typeof updateAlbumSchema>;

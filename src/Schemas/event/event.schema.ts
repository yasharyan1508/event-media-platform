import { z } from "zod";

export const createEventSchema = z.object({
  title: z.string().min(3).max(100),
  description: z.string().max(500).optional(),
  coverImageUrl: z.string().url().or(z.literal("")).optional(),
  coverImageS3Key: z.string().optional(),
  location: z.string().max(400).optional(),
  startDateTime: z.any().optional(),
  endDateTime: z.any().optional(),
  categoryId: z.string().optional(),
  price: z.string().optional(),
  isFree: z.boolean().optional(),
  url: z.string().url().or(z.literal("")).optional(),
});

export type CreateEventInput = z.infer<typeof createEventSchema>;

export const updateEventSchema = createEventSchema.partial().extend({
  id: z.string(),
});

export type UpdateEventInput = z.infer<typeof updateEventSchema>;

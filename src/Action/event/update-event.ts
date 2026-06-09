"use server";

import { getCurrentUser, requireOwnership } from "@/src/Library/dal";
import { updateEventSchema } from "@/src/Schemas/event/event.schema";
import { prisma } from "@/src/Library/prisma";
import { buildPublicUrl } from "@/src/Library/s3";

type UpdateResult = 
  | { success: true }
  | { error: string };

export async function updateEvent(input: unknown): Promise<UpdateResult> {
  try {
    const user = await getCurrentUser();
    
    const parsed = updateEventSchema.safeParse(input);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message || "Invalid input" };
    }

    const { id: eventId, title, description, coverImageS3Key, coverImageUrl } = parsed.data;

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { ownerId: true }
    });

    if (!event) return { error: "Not found" };

    await requireOwnership(event.ownerId);

    let finalCoverUrl = coverImageUrl;
    if (coverImageS3Key) {
      finalCoverUrl = buildPublicUrl(coverImageS3Key);
    }

    await prisma.event.update({
      where: { id: eventId },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(finalCoverUrl !== undefined && { coverImageUrl: finalCoverUrl }),
      },
      select: { id: true }
    });



    return { success: true };
  } catch (error) {
    console.error("Event update error:", error);
    if (error instanceof Error && error.message.includes("Forbidden")) {
      return { error: error.message };
    }
    return { error: "Failed to update event" };
  }
}

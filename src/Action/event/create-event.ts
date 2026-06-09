"use server";

import { getCurrentUser, requirePermission } from "@/src/Library/dal";
import { Permission } from "@/src/Constants/permissions";
import { createEventSchema } from "@/src/Schemas/event/event.schema";
import { prisma } from "@/src/Library/prisma";
import { buildPublicUrl } from "@/src/Library/s3";
import { revalidatePath } from "next/cache";

export async function createEvent(input: unknown): Promise<{ success: true; eventId: string } | { error: string }> {
  try {
    const user = await getCurrentUser();
    await requirePermission(Permission.EVENT_CREATE);

    const parsed = createEventSchema.safeParse(input);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message || "Invalid input" };
    }

    const { 
      title, 
      description, 
      coverImageS3Key, 
      location, 
      startDateTime, 
      endDateTime, 
      categoryId, 
      price, 
      isFree, 
      url 
    } = parsed.data;

    let finalCoverUrl = parsed.data.coverImageUrl || null;

    if (coverImageS3Key) {
      finalCoverUrl = buildPublicUrl(coverImageS3Key);
    }

    const sanitizedCategoryId = categoryId === "" || categoryId === null ? undefined : categoryId;

    const newEvent = await prisma.event.create({
      data: {
        title,
        description,
        coverImageUrl: finalCoverUrl,
        location,
        startDateTime,
        endDateTime,
        price,
        isFree,
        url,
        owner: { connect: { id: user.id } },
        ...(sanitizedCategoryId ? { category: { connect: { id: sanitizedCategoryId } } } : {}),
        organizer: { connect: { id: user.id } },
        isPublished: false,
        ...(coverImageS3Key ? {
          albums: {
            create: {
              title: "Cover Images",
              creatorId: user.id,
              media: {
                create: {
                  s3Key: coverImageS3Key,
                  url: finalCoverUrl as string,
                  filename: coverImageS3Key.split('/').pop() || coverImageS3Key,
                  mimeType: "image/jpeg",
                  size: 0,
                  status: "READY",
                  uploaderId: user.id,
                }
              }
            }
          }
        } : {})
      },
      select: { id: true }
    });

    try {
      await prisma.auditLog.create({
        data: {
          action: "EVENT_CREATED",
          entityType: "Event",
          entityId: newEvent.id,
          actorId: user.id,
        }
      });
    } catch (auditError) {
      console.error("Failed to write audit log:", auditError);
    }

    revalidatePath("/events");
    return { success: true, eventId: newEvent.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Prisma Error";
    console.error("Action Error:", message);
    if (error instanceof Error && error.message.includes("Forbidden")) {
      return { error: error.message };
    }
    return { error: message };
  }
}

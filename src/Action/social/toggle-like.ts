"use server";

import { getCurrentUser } from "../../Library/dal";
import { prisma } from "../../Library/prisma";

export async function toggleLike(mediaId: string): Promise<{ success: true; isLiked: boolean } | { error: string }> {
  try {
    const user = await getCurrentUser();
    
    // Check if like exists
    const existingLike = await prisma.like.findUnique({
      where: {
        mediaId_userId: {
          mediaId,
          userId: user.id,
        },
      },
    });

    if (existingLike) {
      await prisma.like.delete({
        where: { id: existingLike.id },
      });
      return { success: true, isLiked: false };
    } else {
      await prisma.$transaction(async (tx) => {
        await tx.like.create({
          data: {
            mediaId,
            userId: user.id,
          },
        });

        const media = await tx.media.findUnique({
          where: { id: mediaId },
          select: { uploaderId: true }
        });

        if (media && media.uploaderId !== user.id) {
          const { createNotification } = await import("../../Library/dal/notification.dal");
          await createNotification({
            userId: media.uploaderId,
            actorId: user.id,
            type: "LIKE",
            message: `${user.name ?? "Someone"} liked your photo.`
          }, tx);
        }
      });
      return { success: true, isLiked: true };
    }
  } catch (error) {
    console.error("Error toggling like:", error);
    return { error: "Failed to toggle like" };
  }
}

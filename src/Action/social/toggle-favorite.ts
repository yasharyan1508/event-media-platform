"use server";

import { getCurrentUser } from "../../Library/dal";
import { prisma } from "../../Library/prisma";

export async function toggleFavorite(mediaId: string): Promise<{ success: true; isFavorited: boolean } | { error: string }> {
  try {
    const user = await getCurrentUser();
    
    // Check if favorite exists
    const existingFavorite = await prisma.favorite.findUnique({
      where: {
        mediaId_userId: {
          mediaId,
          userId: user.id,
        },
      },
    });

    if (existingFavorite) {
      await prisma.favorite.delete({
        where: { id: existingFavorite.id },
      });
      return { success: true, isFavorited: false };
    } else {
      await prisma.favorite.create({
        data: {
          mediaId,
          userId: user.id,
        },
      });
      return { success: true, isFavorited: true };
    }
  } catch (error) {
    console.error("Error toggling favorite:", error);
    return { error: "Failed to toggle favorite" };
  }
}

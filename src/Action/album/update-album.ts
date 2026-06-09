"use server";

import { getCurrentUser } from "@/src/Library/dal";
import { prisma } from "@/src/Library/prisma";
import { checkOwnership } from "@/src/Library/rbac";
import { updateAlbumSchema } from "@/src/Schemas/album/album.schema";
import { Role } from "@prisma/client";

export async function updateAlbum(input: unknown) {
  try {
    const currentUser = await getCurrentUser();

    const parsed = updateAlbumSchema.safeParse(input);
    if (!parsed.success) {
      return { error: "Invalid input" };
    }

    const album = await prisma.album.findUnique({
      where: { id: parsed.data.id },
      include: {
        event: {
          select: { ownerId: true }
        }
      }
    });

    if (!album) {
      return { error: "Album not found" };
    }

    // Verify user is album creator OR event owner OR ADMIN
    const isAlbumCreator = checkOwnership(currentUser.id, album.creatorId, currentUser.role);
    const isEventOwner = checkOwnership(currentUser.id, album.event.ownerId, currentUser.role);

    if (!isAlbumCreator && !isEventOwner && currentUser.role !== Role.ADMIN) {
      return { error: "Forbidden: You do not have permission to update this album" };
    }

    await prisma.album.update({
      where: { id: album.id },
      data: {
        ...(parsed.data.title !== undefined && { title: parsed.data.title }),
        ...(parsed.data.description !== undefined && { description: parsed.data.description })
      }
    });

    return { success: true as const };

  } catch (error) {
    console.error("Failed to update album:", error);
    return { error: "Failed to update album" };
  }
}

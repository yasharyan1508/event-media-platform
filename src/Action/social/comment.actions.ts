"use server";

import { getCurrentUser } from "../../Library/dal";
import { prisma } from "../../Library/prisma";
import { Role } from "@prisma/client";
import { commentSchema } from "../../Schemas/social/social.schema";

export async function addComment(mediaId: string, body: string, parentId?: string): Promise<{ success: true; comment: any } | { error: string }> {
  try {
    const user = await getCurrentUser();

    // validation
    const parsed = commentSchema.safeParse({ mediaId, body, parentId });
    if (!parsed.success) {
      return { error: "Invalid input" };
    }

    const comment = await prisma.$transaction(async (tx) => {
      const newComment = await tx.comment.create({
        data: {
          content: parsed.data.body,
          mediaId: parsed.data.mediaId,
          userId: user.id,
        },
        include: {
          user: {
            select: { name: true, avatarUrl: true },
          },
        },
      });

      const media = await tx.media.findUnique({
        where: { id: parsed.data.mediaId },
        select: { uploaderId: true }
      });

      if (media && media.uploaderId !== user.id) {
        const { createNotification } = await import("../../Library/dal/notification.dal");
        await createNotification({
          userId: media.uploaderId,
          actorId: user.id,
          type: "COMMENT",
          message: `${user.name ?? "Someone"} commented on your photo.`
        }, tx);
      }

      return newComment;
    });

    return { success: true, comment };
  } catch (error) {
    console.error("Error adding comment:", error);
    return { error: "Failed to add comment" };
  }
}

export async function deleteComment(commentId: string): Promise<{ success: true } | { error: string }> {
  try {
    const user = await getCurrentUser();

    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
    });

    if (!comment) return { error: "Comment not found" };

    if (comment.userId !== user.id && user.role !== Role.ADMIN) {
      return { error: "Forbidden: Not authorized to delete this comment" };
    }

    await prisma.comment.delete({
      where: { id: commentId },
    });

    return { success: true };
  } catch (error) {
    console.error("Error deleting comment:", error);
    return { error: "Failed to delete comment" };
  }
}

export async function getCommentsByMedia(mediaId: string): Promise<{ success: true; comments: any[] } | { error: string }> {
  try {
    const comments = await prisma.comment.findMany({
      where: { mediaId },
      include: {
        user: {
          select: { name: true, avatarUrl: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return { success: true, comments };
  } catch (error) {
    console.error("Error fetching comments:", error);
    return { error: "Failed to fetch comments" };
  }
}

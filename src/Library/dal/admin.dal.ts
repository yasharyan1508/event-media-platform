import { prisma } from "../prisma";
import { Role } from "@prisma/client";

export async function getSystemStats() {
  const [totalUsers, totalMedia, totalAlbums, totalEvents] = await Promise.all([
    prisma.user.count(),
    prisma.media.count(),
    prisma.album.count(),
    prisma.event.count(),
  ]);

  return { totalUsers, totalMedia, totalAlbums, totalEvents };
}

export async function getAuditLogs(cursor?: string, limit: number = 50) {
  const logs = await prisma.auditLog.findMany({
    take: limit + 1,
    skip: cursor ? 1 : 0,
    cursor: cursor ? { id: cursor } : undefined,
    include: {
      actor: {
        select: { id: true, name: true, avatarUrl: true, email: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  let nextCursor: string | null = null;
  if (logs.length > limit) {
    const nextItem = logs.pop();
    nextCursor = nextItem!.id;
  }

  return { data: logs, nextCursor };
}

export async function getAllUsers(cursor?: string, limit: number = 50) {
  const users = await prisma.user.findMany({
    take: limit + 1,
    skip: cursor ? 1 : 0,
    cursor: cursor ? { id: cursor } : undefined,
    orderBy: { createdAt: "desc" },
  });

  let nextCursor: string | null = null;
  if (users.length > limit) {
    const nextItem = users.pop();
    nextCursor = nextItem!.id;
  }

  return { data: users, nextCursor };
}

export async function updateUserRoleDal(userId: string, newRole: Role) {
  return await prisma.user.update({
    where: { id: userId },
    data: { role: newRole },
  });
}

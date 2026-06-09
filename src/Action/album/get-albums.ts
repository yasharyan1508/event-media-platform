import { getCurrentUser } from "@/src/Library/dal";
import { prisma } from "@/src/Library/prisma";
import { resolveEventAccess, EventAccessLevel } from "@/src/Library/rbac";

export type AlbumWithStats = {
  id: string;
  title: string;
  description: string | null;
  createdAt: Date;
  eventId: string;
  _count: { media: number };
  media: { url: string }[];
};

export async function getAlbumsByEvent(eventId: string): Promise<AlbumWithStats[] | null> {
  const currentUser = await getCurrentUser();

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      collaborators: {
        where: { userId: currentUser.id }
      }
    }
  });

  if (!event) return null;

  const accessLevel = resolveEventAccess(
    currentUser.id,
    currentUser.role,
    event.ownerId,
    event.collaborators[0]
  );

  if (accessLevel === EventAccessLevel.NO_ACCESS) {
    return null; // Or throw? The prompt says Return AlbumWithStats[] | null
  }

  const albums = await prisma.album.findMany({
    where: { eventId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      title: true,
      description: true,
      createdAt: true,
      eventId: true,
      _count: {
        select: { media: true }
      },
      media: {
        take: 1,
        select: { url: true }
      }
    }
  });

  return albums;
}

export type MediaDetail = {
  id: string;
  url: string;
  filename: string;
  mimeType: string;
  size: number;
  status: string;
  s3Key: string;
  aiCaption: string | null;
  aiQualityScore: number | null;
  aiTags: { label: string; confidence: number }[];
  createdAt: Date;
  uploaderId: string;
  _count: {
    likes: number;
    comments: number;
    favorites: number;
  };
};

export type AlbumDetail = {
  id: string;
  title: string;
  description: string | null;
  eventId: string;
  createdAt: Date;
  event: {
    ownerId: string;
    collaborators: any[]; // using any for simplicity, or we can type it
  };
  media: MediaDetail[];
};

export async function getAlbumById(albumId: string): Promise<AlbumDetail | null> {
  const currentUser = await getCurrentUser();

  const album = await prisma.album.findUnique({
    where: { id: albumId },
    select: {
      id: true,
      title: true,
      description: true,
      eventId: true,
      createdAt: true,
      event: {
        select: {
          ownerId: true,
          collaborators: {
            where: { userId: currentUser.id }
          }
        }
      },
      media: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          url: true,
          filename: true,
          mimeType: true,
          size: true,
          status: true,
          s3Key: true,
          aiCaption: true,
          aiQualityScore: true,
          aiTags: {
            select: { label: true, confidence: true }
          },
          createdAt: true,
          uploaderId: true,
          _count: {
            select: { likes: true, comments: true, favorites: true }
          }
        }
      }
    }
  });

  if (!album) return null;

  const accessLevel = resolveEventAccess(
    currentUser.id,
    currentUser.role,
    album.event.ownerId,
    album.event.collaborators[0]
  );

  if (accessLevel === EventAccessLevel.NO_ACCESS) {
    return null;
  }

  return {
    id: album.id,
    title: album.title,
    description: album.description,
    eventId: album.eventId,
    createdAt: album.createdAt,
    event: album.event,
    media: album.media
  };
}

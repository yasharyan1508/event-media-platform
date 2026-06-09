import { getCurrentUser } from "@/src/Library/dal";
import { prisma } from "@/src/Library/prisma";
import { resolveEventAccess, EventAccessLevel } from "@/src/Library/rbac";

export type EventWithStats = {
  id: string;
  title: string;
  description: string | null;
  coverImageUrl: string | null;
  isPublished: boolean;
  location: string | null;
  startDateTime: Date;
  createdAt: Date;
  _count: {
    albums: number;
    collaborators: number;
  };
};

export type EventDetail = {
  id: string;
  title: string;
  description: string | null;
  coverImageUrl: string | null;
  isPublished: boolean;
  ownerId: string;
  aiSummary: string | null;
  aiSummaryGeneratedAt: Date | null;
  aiSummaryModel: string | null;
  createdAt: Date;
  owner: {
    id: string;
    name: string | null;
    avatarUrl: string | null;
  };
  albums: {
    id: string;
    title: string;
    _count: {
      media: number;
    };
  }[];
  collaborators: {
    id: string;
    userId: string;
    role: string;
    acceptedAt: Date | null;
    user: {
      id: string;
      name: string | null;
      avatarUrl: string | null;
    };
  }[];
};

export async function getMyEvents(): Promise<{ success: true; data: EventWithStats[] } | { error: string }> {
  try {
    const user = await getCurrentUser();

    const events = await prisma.event.findMany({
      where: { ownerId: user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        description: true,
        coverImageUrl: true,
        isPublished: true,
        location: true,
        startDateTime: true,
        createdAt: true,
        _count: {
          select: {
            albums: true,
            collaborators: true,
          }
        }
      }
    });

    return { success: true, data: events };
  } catch (error) {
    if (error instanceof Error && error.message.includes("Forbidden")) {
      return { error: error.message };
    }
    return { error: "Failed to fetch events" };
  }
}

export async function getEventById(eventId: string): Promise<EventDetail | null> {
  const user = await getCurrentUser();

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      title: true,
      description: true,
      coverImageUrl: true,
      isPublished: true,
      ownerId: true,
      aiSummary: true,
      aiSummaryGeneratedAt: true,
      aiSummaryModel: true,
      createdAt: true,
      owner: {
        select: {
          id: true,
          name: true,
          avatarUrl: true,
        }
      },
      albums: {
        select: {
          id: true,
          title: true,
          _count: {
            select: { media: true }
          }
        }
      },
      collaborators: {
        select: {
          id: true,
          userId: true,
          role: true,
          acceptedAt: true,
          user: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
            }
          }
        }
      }
    }
  });

  if (!event) return null;

  const collabRecord = event.collaborators.find((c: any) => c.userId === user.id);
  const access = resolveEventAccess(user.id, user.role, event.ownerId, collabRecord as any);

  if (access === EventAccessLevel.NO_ACCESS) {
    throw new Error("Forbidden: NO_ACCESS to this event");
  }

  return event as EventDetail;
}

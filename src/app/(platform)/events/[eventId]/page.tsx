import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { getCurrentUser } from "@/src/Library/dal";
import { prisma } from "@/src/Library/prisma";
import { getEventById } from "@/src/Action/event/get-events";
import { publishEvent } from "@/src/Action/event/publish-event";
import { getAlbumsByEvent } from "@/src/Action/album/get-albums";
import { AlbumCard } from "@/src/Components/albums/AlbumCard";
import { GenerateSummaryButton } from "@/src/Components/events/GenerateSummaryButton";
import { EventFaceGallery } from "@/src/Components/faces/EventFaceGallery";
import { Sparkles, Trophy } from "lucide-react";

export default async function EventPage({ params }: { params: Promise<{ eventId: string }> | { eventId: string } }) {
  const resolvedParams = await Promise.resolve(params);
  const eventId = resolvedParams.eventId;

  const currentUser = await getCurrentUser();
  const event = await getEventById(eventId);
  const albums = await getAlbumsByEvent(eventId) || [];

  if (!event) {
    notFound();
  }

  const isAdmin = currentUser?.role === "ADMIN";
  const isOwner = currentUser?.id === event.owner?.id;
  const canEdit = isOwner || isAdmin;

  // Extract Highlights directly from DB
  const highlights = await prisma.media.findMany({
    where: {
      album: { eventId },
      aiQualityScore: { not: null }
    },
    orderBy: { aiQualityScore: "desc" },
    take: 4,
    select: {
      id: true,
      url: true,
      aiCaption: true,
      aiQualityScore: true
    }
  });

  // Extract Faces detected in this event
  const eventFaces = await prisma.faceIndex.findMany({
    where: {
      matchedFaces: {
        some: {
          media: { album: { eventId } }
        }
      }
    },
    include: { user: { select: { name: true, avatarUrl: true } } }
  });

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="flex flex-col md:flex-row gap-8">
        {/* Cover Image */}
        <div className="w-full md:w-1/3 relative aspect-video md:aspect-square overflow-hidden rounded-xl bg-gray-100 flex-shrink-0">
          {event.coverImageUrl ? (
            <Image
              src={event.coverImageUrl}
              alt={event.title}
              fill
              className="object-cover"
              priority
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-gray-400">
              No Image
            </div>
          )}
        </div>

        {/* Details */}
        <div className="w-full md:w-2/3 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h1 className="text-4xl font-bold text-gray-900">{event.title}</h1>
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium w-fit ${event.isPublished ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
                }`}
            >
              {event.isPublished ? "Published" : "Draft"}
            </span>
          </div>

          <p className="text-gray-600 whitespace-pre-wrap leading-relaxed mt-2">{event.description}</p>

          <div className="flex items-center gap-3 mt-4">
            <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 relative">
              {event.owner?.avatarUrl && (
                <img src={event.owner.avatarUrl} alt={event.owner.name || "Owner"} className="w-full h-full object-cover" />
              )}
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-gray-500 uppercase tracking-wider">Hosted by</span>
              <span className="text-sm font-bold text-gray-800">{event.owner?.name}</span>
            </div>
          </div>

          {canEdit && (
            <div className="flex flex-wrap gap-4 mt-6 border-t pt-6">
              <Link
                href={`/events/${eventId}/edit`}
                className="px-5 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition"
              >
                Edit Event
              </Link>

              <form action={async () => {
                "use server";
                await publishEvent(eventId);
              }}>
                <button
                  type="submit"
                  className={`px-5 py-2.5 rounded-lg font-medium transition ${event.isPublished
                      ? "bg-amber-100 text-amber-800 hover:bg-amber-200"
                      : "bg-green-100 text-green-800 hover:bg-green-200"
                    }`}
                >
                  {event.isPublished ? "Unpublish" : "Publish"}
                </button>
              </form>

              <button className="px-5 py-2.5 bg-red-100 text-red-800 font-medium rounded-lg hover:bg-red-200 transition">
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Albums */}
      <div className="mt-16">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Albums</h2>
          {canEdit && (
            <Link
              href={`/events/${eventId}/albums/new`}
              className="px-4 py-2 bg-black text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition"
            >
              Add Album
            </Link>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {albums.map((album) => (
            <AlbumCard
              key={album.id}
              id={album.id}
              title={album.title}
              description={album.description}
              mediaCount={album._count.media}
              coverUrl={album.media[0]?.url}
              createdAt={album.createdAt}
              eventId={album.eventId}
            />
          ))}
          {albums.length === 0 && (
            <div className="col-span-full py-12 text-center border-2 border-dashed border-gray-200 rounded-xl">
              <p className="text-gray-500">No albums created yet.</p>
            </div>
          )}
        </div>
      </div>

      {/* AI Summary Section */}
      {event.aiSummary && (
        <div className="mt-16 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 p-8 rounded-2xl shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <Sparkles className="h-6 w-6 text-blue-600" />
            <h2 className="text-2xl font-bold text-gray-900">AI Event Summary</h2>
          </div>
          <p className="text-gray-700 leading-relaxed text-lg">{event.aiSummary}</p>
          {event.aiSummaryGeneratedAt && (
            <p className="text-xs text-gray-500 mt-4">
              Generated by {event.aiSummaryModel} on {new Date(event.aiSummaryGeneratedAt).toLocaleString()}
            </p>
          )}
        </div>
      )}
      {!event.aiSummary && canEdit && (
        <div className="mt-16 bg-gray-50 border border-gray-200 p-8 rounded-2xl flex flex-col items-center justify-center text-center shadow-sm">
          <Sparkles className="h-8 w-8 text-gray-400 mb-3" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Generate AI Summary</h2>
          <p className="text-gray-500 mb-6 max-w-md">
            Once you have uploaded photos and they have been processed by AI, you can generate a narrative summary of the entire event.
          </p>
          <GenerateSummaryButton eventId={eventId} />
        </div>
      )}

      {/* Face Recognition Gallery */}
      <EventFaceGallery eventId={eventId} faceIndexes={eventFaces} />

      {/* Event Highlights */}
      {highlights.length > 0 && (
        <div className="mt-16 border-t pt-12">
          <div className="flex items-center gap-3 mb-6">
            <Trophy className="h-6 w-6 text-amber-500" />
            <h2 className="text-2xl font-bold text-gray-900">Highlights</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {highlights.map(m => (
              <div key={m.id} className="relative aspect-square rounded-xl overflow-hidden ring-1 ring-black/5 group">
                <Image src={m.url} alt={m.aiCaption || "Highlight"} fill className="object-cover transition duration-500 group-hover:scale-110" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition duration-300 flex flex-col justify-end p-3">
                  <p className="text-white text-xs font-medium line-clamp-2">{m.aiCaption}</p>
                  <div className="flex items-center gap-1 mt-2 text-amber-400 text-xs font-bold">
                    <Trophy className="h-3 w-3" />
                    {m.aiQualityScore} Score
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Collaborators */}
      <div className="mt-16 border-t pt-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Collaborators</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {event.collaborators?.map((collab: any) => (
            <div key={collab.id} className="flex items-center gap-3 border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md transition">
              <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-200 relative flex-shrink-0">
                {collab.user?.avatarUrl && (
                  <img src={collab.user.avatarUrl} alt={collab.user.name || "Collaborator"} className="w-full h-full object-cover" />
                )}
              </div>
              <div className="overflow-hidden">
                <p className="font-bold text-sm text-gray-900 truncate">{collab.user?.name}</p>
                <p className="text-xs font-medium text-gray-500 capitalize mt-0.5">{collab.role?.toLowerCase()}</p>
              </div>
            </div>
          ))}
          {(!event.collaborators || event.collaborators.length === 0) && (
            <p className="text-gray-500 col-span-full">No collaborators added yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}

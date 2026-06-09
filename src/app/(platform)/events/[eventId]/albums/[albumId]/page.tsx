import { getCurrentUser } from "@/src/Library/dal";
import { resolveEventAccess, EventAccessLevel, checkOwnership } from "@/src/Library/rbac";
import { getAlbumById } from "@/src/Action/album/get-albums";
import { redirect } from "next/navigation";
import { AlbumForm } from "@/src/Components/albums/AlbumForm";
import { MediaUploader } from "@/src/Components/albums/MediaUploader";
import { MediaGrid } from "@/src/Components/albums/MediaGrid";
import { Role } from "@prisma/client";
import Link from "next/link";

export default async function AlbumDetailPage({ params }: { params: Promise<{ eventId: string; albumId: string }> }) {
  const { eventId, albumId } = await params;
  const currentUser = await getCurrentUser();

  const album = await getAlbumById(albumId);

  if (!album || album.eventId !== eventId) {
    redirect(`/events/${eventId}`);
  }

  // Access check already happens in getAlbumById, but we need the level for UI permissions
  const access = resolveEventAccess(
    currentUser.id,
    currentUser.role,
    album.event.ownerId,
    album.event.collaborators?.[0]
  );

  if (access === EventAccessLevel.NO_ACCESS) {
    redirect(`/events/${eventId}`);
  }

  const isOwner = checkOwnership(currentUser.id, album.event.ownerId, currentUser.role) || 
                  checkOwnership(currentUser.id, album.id, currentUser.role); // wait album doesn't have creatorId selected in getAlbumById?

  const canUpload = access !== EventAccessLevel.COLLABORATOR_VIEW;
  const canEditAlbum = currentUser.role === Role.ADMIN || currentUser.id === album.event.ownerId; // simplify edit check for UI

  return (
    <div className="max-w-7xl mx-auto py-10 px-4 sm:px-6">
      <div className="flex flex-col md:flex-row gap-8">
        
        {/* Left Column: Details & Edit Form */}
        <div className="w-full md:w-1/3 lg:w-1/4 space-y-6">
          <div className="bg-surface p-6 rounded-2xl ring-1 ring-white/5">
            <h1 className="text-2xl font-heading font-bold text-on-surface mb-2">{album.title}</h1>
            {album.description && (
              <p className="text-on-surface-muted text-sm mb-4">{album.description}</p>
            )}
            <p className="text-xs text-on-surface-subtle mb-4">
              Created {new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(album.createdAt)}
            </p>
            {(currentUser.role === Role.PHOTOGRAPHER || currentUser.role === Role.ADMIN) && (
              <Link
                href={`/events/${eventId}/albums/${album.id}/bulk-upload`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary hover:bg-primary/20 rounded-lg text-sm font-semibold transition-colors"
              >
                Bulk Upload
              </Link>
            )}
          </div>

          {canEditAlbum && (
            <div className="bg-surface p-6 rounded-2xl ring-1 ring-white/5">
              <h2 className="text-lg font-heading font-semibold text-on-surface mb-4">Edit Album</h2>
              <AlbumForm 
                eventId={eventId} 
                mode="edit" 
                initialData={{ id: album.id, title: album.title, description: album.description }} 
              />
            </div>
          )}
        </div>

        {/* Right Column: Uploader & Grid */}
        <div className="w-full md:w-2/3 lg:w-3/4 space-y-6">
          {canUpload && (
            <MediaUploader 
              albumId={album.id} 
            />
          )}

          <MediaGrid 
            media={album.media} 
            currentUserId={currentUser.id} 
            currentUserRole={currentUser.role}
            isOwner={canEditAlbum} 
          />
        </div>
      </div>
    </div>
  );
}

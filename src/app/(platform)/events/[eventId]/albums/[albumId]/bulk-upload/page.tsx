import { getCurrentUser, requirePermission } from "@/src/Library/dal";
import { Permission } from "@/src/Constants/permissions";
import { getAlbumById } from "@/src/Action/album/get-albums";
import { resolveEventAccess, EventAccessLevel } from "@/src/Library/rbac";
import { notFound, redirect } from "next/navigation";
import { BulkUploaderWrapper } from "@/src/Components/albums/BulkUploaderWrapper";
import { getJobsByAlbum } from "@/src/Action/bulk-upload/get-bulk-jobs";
import { BulkJobProgress } from "@/src/Components/albums/BulkJobProgress";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

export default async function BulkUploadPage({
  params,
}: {
  params: Promise<{ eventId: string; albumId: string }>;
}) {
  const { eventId, albumId } = await params;

  const currentUser = await getCurrentUser();

  try {
    await requirePermission(Permission.MEDIA_BULK_UPLOAD);
  } catch {
    redirect(`/events/${eventId}/albums/${albumId}`);
  }

  const album = await getAlbumById(albumId);

  if (!album) {
    notFound();
  }

  const accessLevel = resolveEventAccess(
    currentUser.id,
    currentUser.role,
    album.event.ownerId,
    album.event.collaborators[0]
  );

  if (
    accessLevel === EventAccessLevel.NO_ACCESS ||
    accessLevel === EventAccessLevel.COLLABORATOR_VIEW
  ) {
    redirect(`/events/${eventId}/albums/${albumId}`);
  }

  const recentJobs = await getJobsByAlbum(albumId);

  return (
    <div className="max-w-4xl mx-auto space-y-8 p-6">
      <div>
        <div className="flex items-center gap-2 text-sm text-on-surface-variant mb-4">
          <Link href="/events" className="hover:text-primary transition-colors">
            Events
          </Link>
          <ChevronRight className="w-4 h-4" />
          <Link href={`/events/${eventId}`} className="hover:text-primary transition-colors truncate max-w-[150px]">
            Event
          </Link>
          <ChevronRight className="w-4 h-4" />
          <Link href={`/events/${eventId}/albums/${albumId}`} className="hover:text-primary transition-colors truncate max-w-[150px]">
            {album.title}
          </Link>
          <ChevronRight className="w-4 h-4" />
          <span className="text-on-surface font-medium">Bulk Upload</span>
        </div>

        <h1 className="text-3xl font-bold text-on-surface mb-2">
          Bulk Upload to {album.title}
        </h1>
        <p className="text-on-surface-variant">
          Upload up to 100 files at once. Maximum 200MB per file. Supported: images and MP4 video.
        </p>
      </div>

      <BulkUploaderWrapper albumId={albumId} eventId={eventId} />

      {recentJobs.length > 0 && (
        <div className="space-y-4 pt-8 border-t border-surface-container">
          <h2 className="text-xl font-bold text-on-surface">Recent Upload Jobs</h2>
          <div className="space-y-3">
            {recentJobs.slice(0, 5).map((job) => (
              <BulkJobProgress
                key={job.id}
                jobId={job.id}
                totalFiles={job.totalFiles}
                processedFiles={job.processedFiles}
                failedFiles={job.failedFiles}
                status={job.status}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

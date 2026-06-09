import { getCurrentUser } from "@/src/Library/dal";
import { resolveEventAccess, EventAccessLevel } from "@/src/Library/rbac";
import { prisma } from "@/src/Library/prisma";
import { redirect } from "next/navigation";
import { AlbumForm } from "@/src/Components/albums/AlbumForm";

export default async function NewAlbumPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const currentUser = await getCurrentUser();

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      collaborators: { where: { userId: currentUser.id } }
    }
  });

  if (!event) redirect("/dashboard");

  const access = resolveEventAccess(
    currentUser.id,
    currentUser.role,
    event.ownerId,
    event.collaborators[0]
  );

  if (access === EventAccessLevel.NO_ACCESS || access === EventAccessLevel.COLLABORATOR_VIEW) {
    redirect(`/events/${eventId}`);
  }

  return (
    <div className="max-w-2xl mx-auto py-10 px-4 sm:px-6">
      <h1 className="text-3xl font-heading font-bold mb-8 text-on-surface">Create New Album</h1>
      <div className="bg-surface p-6 sm:p-8 rounded-2xl ring-1 ring-white/5 shadow-xl">
        <AlbumForm eventId={eventId} mode="create" />
      </div>
    </div>
  );
}

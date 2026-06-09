import { Suspense } from "react";
import Link from "next/link";
import { getMyEvents } from "@/src/Action/event/get-events";
import EventCard from "@/src/Components/events/EventCard";

function ErrorState({ message }: { message: string }) {
  return (
    <div className="p-6 bg-red-50 text-red-600 border border-red-200 rounded-xl">
      <h2 className="font-bold text-lg mb-2">Error</h2>
      <p>{message}</p>
    </div>
  );
}

async function EventsGrid() {
  const result = await getMyEvents();

  if ("error" in result) {
    return <ErrorState message={result.error} />;
  }

  if (!result.data || result.data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 border-2 border-dashed rounded-xl bg-gray-50 dark:bg-gray-900 dark:border-gray-800 text-center">
        <h3 className="text-xl font-bold mb-2">No events found</h3>
        <p className="text-gray-500 mb-6 max-w-md">
          Get started by creating your first event to share media and memories.
        </p>
        <Link 
          href="/events/create" 
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
        >
          Create your first event
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {result.data.map((event) => (
        <EventCard 
          key={event.id} 
          event={{
            id: event.id,
            title: event.title,
            location: event.location,
            startDate: event.startDateTime,
            coverImageUrl: event.coverImageUrl,
            isPublished: event.isPublished,
            _count: event._count
          }} 
        />
      ))}
    </div>
  );
}

export default function EventsPage() {
  return (
    <main className="max-w-7xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <h1 className="text-3xl font-bold tracking-tight">My Events</h1>
        <Link 
          href="/events/create"
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors shadow-sm"
        >
          Create Event
        </Link>
      </div>

      <Suspense fallback={<div className="py-20 text-center text-gray-500 font-medium text-lg">Loading events...</div>}>
        <EventsGrid />
      </Suspense>
    </main>
  );
}

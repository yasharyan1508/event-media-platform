import { EventForm } from "@/src/Components/events/EventForm";
import { getCurrentUser } from "@/src/Library/dal";

export default async function CreateEventPage() {
  const user = await getCurrentUser();

  return (
    <main className="max-w-3xl mx-auto py-10 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Create New Event</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Fill out the details below to create a new event. You can add albums and media after the event is created.
        </p>
      </div>
      
      <EventForm type="Create" userId={user.id} />
    </main>
  );
}

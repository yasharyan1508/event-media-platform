import { requirePermission } from "@/src/Library/dal";
import { Permission } from "@/src/Constants/permissions";

export default async function CreateEventPage() {
  const user = await requirePermission(Permission.EVENT_CREATE);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          Create New Event
        </h1>
        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <p className="text-gray-600">
            Event creation form coming in Module 3.
          </p>
          <p className="text-sm text-gray-400 mt-2">
            Authenticated as: {user.email} ({user.role})
          </p>
        </div>
      </div>
    </div>
  );
}

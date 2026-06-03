import { requireRole } from "@/SRC/Library/dal";
import { Role } from "@prisma/client";

export default async function AdminPage() {
  const user = await requireRole(Role.ADMIN);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          Admin Dashboard
        </h1>
        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <p className="text-gray-600">
            Admin panel with user management coming in Module 3.
          </p>
          <p className="text-sm text-gray-400 mt-2">
            Authenticated as: {user.email} (ADMIN)
          </p>
        </div>
      </div>
    </div>
  );
}

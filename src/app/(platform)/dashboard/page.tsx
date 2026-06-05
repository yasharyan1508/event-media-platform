import { getCurrentUser } from "@/src/Library/dal";
import { UserButton } from "@clerk/nextjs";
import { ROLE_LABELS } from "@/src/Constants/roles";

export default async function DashboardPage() {
  const user = await getCurrentUser();

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-600 mt-1">
              Welcome back, {user.name || user.email}
            </p>
          </div>
          <UserButton />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="rounded-lg border bg-white p-6 shadow-sm">
            <h3 className="text-sm font-medium text-gray-500">Role</h3>
            <p className="mt-1 text-lg font-semibold text-gray-900">
              {ROLE_LABELS[user.role]}
            </p>
          </div>
          <div className="rounded-lg border bg-white p-6 shadow-sm">
            <h3 className="text-sm font-medium text-gray-500">Email</h3>
            <p className="mt-1 text-lg font-semibold text-gray-900 truncate">
              {user.email}
            </p>
          </div>
          <div className="rounded-lg border bg-white p-6 shadow-sm">
            <h3 className="text-sm font-medium text-gray-500">Status</h3>
            <p className="mt-1 text-lg font-semibold text-green-600">
              Active
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

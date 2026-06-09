export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/src/Library/dal";
import { Toaster } from "@/src/Components/UI/sonner";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (user.role !== "ADMIN") {
    redirect("/");
  }

  return (
    <div className="flex min-h-screen">
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-slate-900 text-slate-100 flex-shrink-0">
        <div className="p-6">
          <h2 className="text-2xl font-bold tracking-tight">Admin Panel</h2>
        </div>
        <nav className="flex flex-col gap-2 px-4">
          <Link
            href="/admin/dashboard"
            className="px-4 py-2 rounded-md hover:bg-slate-800 transition-colors"
          >
            Dashboard
          </Link>
          <Link
            href="/admin/users"
            className="px-4 py-2 rounded-md hover:bg-slate-800 transition-colors"
          >
            Users
          </Link>
          <Link
            href="/admin/logs"
            className="px-4 py-2 rounded-md hover:bg-slate-800 transition-colors"
          >
            Audit Logs
          </Link>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 bg-slate-50 p-8">
        {children}
      </main>
      <Toaster />
    </div>
  );
}

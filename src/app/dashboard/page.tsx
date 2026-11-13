import { requireRole } from "@/lib/auth";

// Day 3/4: role-specific dashboards replace this placeholder.
export default async function DashboardPage() {
  const user = await requireRole();
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <p className="text-slate-600">Signed in as {user.email} ({user.role}).</p>
    </div>
  );
}

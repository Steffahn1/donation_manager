import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { StaffOverview } from "@/components/dashboard/StaffOverview";

export const metadata = { title: "Dashboard · Donation Manager" };

/** One URL for everyone; what you see depends on your role. */
export default async function DashboardPage() {
  const user = await requireRole();

  if (user.role === "SUPER_ADMIN" || user.role === "CAMPAIGN_MANAGER") {
    return <StaffOverview user={user} />;
  }

  // Day 4: donation history, impact and the anonymity toggle.
  return (
    <div className="card mx-auto max-w-lg space-y-3">
      <h1 className="text-2xl font-bold">Your donations</h1>
      <p className="text-slate-600">Your donation history will appear here soon.</p>
      <Link href="/campaigns" className="btn">See campaigns</Link>
    </div>
  );
}

import { requireRole } from "@/lib/auth";
import { StaffOverview } from "@/components/dashboard/StaffOverview";
import { DonorDashboard } from "@/components/dashboard/DonorDashboard";

export const metadata = { title: "Dashboard · Donation Manager" };

/** One URL for everyone; what you see depends on your role. */
export default async function DashboardPage() {
  const user = await requireRole();

  if (user.role === "SUPER_ADMIN" || user.role === "CAMPAIGN_MANAGER") {
    return <StaffOverview user={user} />;
  }

  return <DonorDashboard user={user} />;
}

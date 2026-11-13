import { requireRole } from "@/lib/auth";
import { listManagers } from "@/lib/queries/admin";
import { todayIso } from "@/lib/campaigns";
import { CampaignForm } from "@/components/forms/CampaignForm";

export default async function NewCampaignPage() {
  await requireRole("SUPER_ADMIN");
  const managers = await listManagers();
  const today = todayIso();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">New campaign</h1>
      {managers.length === 0 ? (
        <p className="error">Create a campaign manager first — every campaign needs one.</p>
      ) : (
        <CampaignForm
          campaignId={null}
          managers={managers}
          initial={{
            name: "", description: "", target: "", startDate: today, endDate: today, status: "DRAFT",
            imagePath: "", impactAmount: "", impactLabel: "", managerId: "",
          }}
        />
      )}
    </div>
  );
}

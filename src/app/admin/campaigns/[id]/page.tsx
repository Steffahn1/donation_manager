import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getCampaignFormValues, listManagers } from "@/lib/queries/admin";
import { CampaignForm } from "@/components/forms/CampaignForm";

export default async function EditCampaignPage({ params }: PageProps<"/admin/campaigns/[id]">) {
  await requireRole("SUPER_ADMIN");
  const { id } = await params;
  const [initial, managers] = await Promise.all([getCampaignFormValues(id), listManagers()]);
  if (!initial) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Edit campaign</h1>
      <CampaignForm campaignId={id} initial={initial} managers={managers} />
    </div>
  );
}

import { CampaignGrid } from "@/components/CampaignGrid";

export const metadata = { title: "Campaigns · Donation Manager" };

export default function CampaignsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Campaigns</h1>
      <CampaignGrid />
    </div>
  );
}

import { getPublicCampaigns } from "@/lib/queries/campaigns";
import { CampaignCard } from "./CampaignCard";

export async function CampaignGrid() {
  const campaigns = await getPublicCampaigns();
  if (campaigns.length === 0) return <p className="text-muted">No campaigns yet.</p>;

  return (
    <div className="campaign-grid">
      {campaigns.map((c) => (
        <CampaignCard key={c.id} campaign={c} />
      ))}
    </div>
  );
}

import Link from "next/link";
import { getPublicCampaigns } from "@/lib/queries/campaigns";
import { isAcceptingDonations } from "@/lib/campaigns";
import { formatZar } from "@/lib/money";
import { ProgressBar } from "./ProgressBar";
import { CampaignImage } from "./CampaignImage";

export async function CampaignGrid() {
  const campaigns = await getPublicCampaigns();
  if (campaigns.length === 0) return <p className="text-slate-600">No campaigns yet.</p>;

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {campaigns.map((c) => {
        const open = isAcceptingDonations(c);
        return (
          <Link key={c.id} href={`/campaigns/${c.slug}`} className="card flex flex-col gap-3 p-0 transition hover:shadow-md">
            <CampaignImage src={c.imagePath} alt={c.name} className="h-40 w-full rounded-t-xl" />
            <div className="flex flex-1 flex-col gap-3 px-5 pb-5">
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-semibold">{c.name}</h2>
                {!open && <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">Closed</span>}
              </div>
              <p className="line-clamp-2 text-sm text-slate-600">{c.description}</p>
              <div className="mt-auto">
                <ProgressBar raisedCents={c.raisedCents} targetCents={c.targetCents} />
                <p className="mt-1 text-xs text-slate-500">
                  {formatZar(c.impactAmountCents)} = 1 {c.impactLabel}
                </p>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

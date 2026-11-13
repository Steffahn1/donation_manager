import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicCampaignBySlug } from "@/lib/queries/campaigns";
import { isAcceptingDonations, notAcceptingReason } from "@/lib/campaigns";
import { formatZar } from "@/lib/money";
import { ProgressBar } from "@/components/ProgressBar";
import { CampaignImage } from "@/components/CampaignImage";

const dateFmt = new Intl.DateTimeFormat("en-ZA", { dateStyle: "medium", timeZone: "UTC" });

export default async function CampaignPage({ params }: PageProps<"/campaigns/[slug]">) {
  const { slug } = await params;
  const campaign = await getPublicCampaignBySlug(slug);
  if (!campaign) notFound();

  const open = isAcceptingDonations(campaign);

  return (
    <article className="grid gap-8 lg:grid-cols-[2fr_1fr]">
      <div className="space-y-4">
        <CampaignImage src={campaign.imagePath} alt={campaign.name} className="h-64 w-full rounded-xl" />
        <h1 className="text-3xl font-bold">{campaign.name}</h1>
        <p className="whitespace-pre-line text-slate-700">{campaign.description}</p>
      </div>
      <aside className="card h-fit space-y-4">
        <ProgressBar raisedCents={campaign.raisedCents} targetCents={campaign.targetCents} />
        <p className="text-sm text-slate-600">
          {campaign.donationCount} donations · runs {dateFmt.format(campaign.startDate)} – {dateFmt.format(campaign.endDate)}
        </p>
        <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">
          Every {formatZar(campaign.impactAmountCents)} = 1 {campaign.impactLabel}
        </p>
        {open ? (
          <Link href={`/donate/${campaign.slug}`} className="btn w-full">
            Donate
          </Link>
        ) : (
          <p className="rounded-lg bg-slate-100 p-3 text-sm text-slate-700">{notAcceptingReason(campaign)}</p>
        )}
      </aside>
    </article>
  );
}

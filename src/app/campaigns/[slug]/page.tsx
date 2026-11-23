import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicCampaignPageBySlug } from "@/lib/queries/campaigns";
import { campaignAvailability, notAcceptingReason } from "@/lib/campaigns";
import { formatZar } from "@/lib/money";
import { ProgressBar } from "@/components/ProgressBar";
import { CampaignImage } from "@/components/CampaignImage";
import { CampaignStory } from "@/components/CampaignStory";

const dateFmt = new Intl.DateTimeFormat("en-ZA", { dateStyle: "medium", timeZone: "UTC" });

export default async function CampaignPage({ params }: PageProps<"/campaigns/[slug]">) {
  const { slug } = await params;
  const campaign = await getPublicCampaignPageBySlug(slug);
  if (!campaign) notFound();

  const availability = campaignAvailability(campaign);
  const open = availability === "open";

  return (
    <article className="grid gap-8 lg:grid-cols-[2fr_1fr]">
      <div className="min-w-0 space-y-5">
        <div>
          <div className="campaign-card-media">
            <CampaignImage src={campaign.imagePath} alt={campaign.name} className="h-72 w-full" />
            {availability === "closed" && <span className="badge badge-closed absolute top-3 left-3">Closed</span>}
            {availability === "upcoming" && (
              <span className="badge badge-info absolute top-3 left-3">Starts {dateFmt.format(campaign.startDate)}</span>
            )}
          </div>
          <div className="hatch-stripe" aria-hidden="true" />
        </div>
        <h1 className="page-title">{campaign.name}</h1>
        <p className="text-lg leading-relaxed whitespace-pre-line">{campaign.description}</p>
        <CampaignStory story={campaign.story} campaignName={campaign.name} />
      </div>
      <aside className="card h-fit space-y-4 lg:sticky lg:top-6" aria-label="Donate to this campaign">
        <ProgressBar
          raisedCents={campaign.raisedCents}
          targetCents={campaign.targetCents}
          label={`${campaign.name}: raised towards target`}
        />
        <p className="text-muted text-sm">
          {campaign.donationCount} paid donations · runs {dateFmt.format(campaign.startDate)} –{" "}
          {dateFmt.format(campaign.endDate)}
        </p>
        <p className="impact-chip">
          Every {formatZar(campaign.impactAmountCents)} = 1 {campaign.impactLabel}
        </p>
        {open ? (
          <Link href={`/donate/${campaign.slug}`} className="btn w-full">
            Donate
          </Link>
        ) : (
          <p className="bg-cream border-navy border-l-4 p-3 text-sm">{notAcceptingReason(campaign)}</p>
        )}
      </aside>
    </article>
  );
}

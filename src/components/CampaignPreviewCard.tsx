import Link from "next/link";
import { formatZar } from "@/lib/money";
import { CampaignImage } from "./CampaignImage";
import { ProgressBar } from "./ProgressBar";
import type { CampaignCardData } from "./CampaignCard";

const dayFmt = new Intl.DateTimeFormat("en-ZA", { day: "numeric", month: "long", timeZone: "Africa/Johannesburg" });

/**
 * A campaign preview for the landing page. Same look and order as CampaignCard (image, title, text,
 * impact chip, progress, meta line), but with NO donate button: its only action leads to the
 * campaign's own page, so donating always starts from the campaign part of the site. Only open
 * campaigns are previewed (see pickFeatured), so there's no status badge either.
 */
export function CampaignPreviewCard({ campaign: c }: { campaign: CampaignCardData }) {
  return (
    <article className="campaign-card">
      <div className="campaign-card-media">
        <CampaignImage src={c.imagePath} alt={c.name} />
      </div>
      <div className="hatch-stripe" aria-hidden="true" />

      <div className="flex flex-1 flex-col gap-3.5 px-5 pt-5 pb-6">
        <h3 className="heading text-navy text-[1.75rem] leading-[1.05]">{c.name}</h3>
        <p className="line-clamp-3 leading-relaxed">{c.description}</p>
        <p className="impact-chip">
          {formatZar(c.impactAmountCents)} = 1 {c.impactLabel}
        </p>

        <div className="mt-auto">
          <ProgressBar raisedCents={c.raisedCents} targetCents={c.targetCents} label={`${c.name}: raised towards target`} />
          <p className="text-muted mt-1.5 text-sm">Open until {dayFmt.format(c.endDate)}</p>
        </div>

        <Link href={`/campaigns/${c.slug}`} className="arrow-link self-start" aria-label={`Learn more about ${c.name}`}>
          Learn more <span className="arrow" aria-hidden="true">↗</span>
        </Link>
      </div>
    </article>
  );
}

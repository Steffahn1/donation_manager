import Link from "next/link";
import { isAcceptingDonations } from "@/lib/campaigns";
import { formatZar } from "@/lib/money";
import { CampaignImage } from "./CampaignImage";
import { ProgressBar } from "./ProgressBar";

export type CampaignCardData = {
  id: string;
  slug: string;
  name: string;
  description: string;
  imagePath: string | null;
  status: "DRAFT" | "ACTIVE" | "CLOSED";
  startDate: Date;
  endDate: Date;
  targetCents: number;
  raisedCents: number;
  impactAmountCents: number;
  impactLabel: string;
};

const endFmt = new Intl.DateTimeFormat("en-ZA", { day: "numeric", month: "long", timeZone: "Africa/Johannesburg" });

/** A public campaign card (design system: image → title → text → impact chip → amount → progress → actions). */
export function CampaignCard({ campaign: c }: { campaign: CampaignCardData }) {
  const accepting = isAcceptingDonations(c);
  return (
    <article className="campaign-card">
      <div className="campaign-card-media">
        <CampaignImage src={c.imagePath} alt={c.name} />
        {!accepting && <span className="badge badge-closed absolute top-3 left-3">Closed</span>}
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
          <p className="text-muted mt-1.5 text-sm">
            {accepting ? `Open until ${endFmt.format(c.endDate)}` : "No longer accepting donations"}
          </p>
        </div>

        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          {accepting && (
            <Link href={`/donate/${c.slug}`} className="btn-sm" aria-label={`Donate to ${c.name}`}>
              Donate
            </Link>
          )}
          <Link href={`/campaigns/${c.slug}`} className="arrow-link" aria-label={`Learn more about ${c.name}`}>
            Learn more <span className="arrow" aria-hidden="true">↗</span>
          </Link>
        </div>
      </div>
    </article>
  );
}

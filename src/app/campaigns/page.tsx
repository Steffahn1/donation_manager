import { Suspense } from "react";
import Link from "next/link";
import { getPublicCampaigns } from "@/lib/queries/campaigns";
import { isAcceptingDonations } from "@/lib/campaigns";
import { formatZar } from "@/lib/money";
import { CampaignCard } from "@/components/CampaignCard";
import "./campaigns.css";

/*
 * The design system's showcase page. Shared pieces (buttons, cards, progress bars) come from
 * globals.css; the hero, the wave colours and the stats band are page-only (campaigns.css, prefixed cx-).
 * Data: public campaigns (ACTIVE and CLOSED, never DRAFT), totals from SUCCEEDED donations only,
 * and no donor details.
 */

export const metadata = { title: "Campaigns · Donation Manager" };

/** Whole rands for the big headline number (the exact amounts are on each card). */
function wholeRand(cents: number): string {
  return formatZar(Math.floor(cents / 100) * 100).replace(/[.,]00$/, "");
}

export default function CampaignsPage() {
  return (
    <div data-full-bleed className="full-bleed">
      <section className="cx-hero on-dark">
        <div className="band-inner">
          <p className="cx-kicker heading">
            Every rand counts
            <svg className="cx-swoosh" viewBox="0 0 200 12" preserveAspectRatio="none" aria-hidden="true">
              <path d="M2 8 C 50 2, 120 2, 198 6 L 196 11 C 120 7, 60 8, 4 12 Z" fill="currentColor" />
            </svg>
          </p>
          <h1 className="cx-headline font-display">Give where it matters</h1>
          <p className="cx-lead">
            Pick a campaign, give once by card, and see exactly what your gift makes possible. Give as a guest, or
            create an account to follow every campaign you support.
          </p>
          <div className="cx-actions">
            <a href="#campaigns" className="btn">
              See campaigns
            </a>
            <Link href="/signup" className="btn-on-dark px-8 text-[1.2rem]">
              Track your giving
            </Link>
          </div>
        </div>
      </section>

      <svg className="wave-divider cx-waveIntoStats" viewBox="0 0 1440 48" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 22 C 240 4, 520 40, 780 24 S 1220 2, 1440 18 L 1440 48 L 0 48 Z" fill="currentColor" />
      </svg>

      {/* The totals and the list read the database, so they stream in behind a placeholder. */}
      <Suspense fallback={<div className="cx-loading">Loading campaigns…</div>}>
        <CampaignsContent />
      </Suspense>
    </div>
  );
}

async function CampaignsContent() {
  const campaigns = await getPublicCampaigns();
  const open = campaigns.filter((c) => isAcceptingDonations(c));
  const raisedCents = campaigns.reduce((sum, c) => sum + c.raisedCents, 0);
  const gifts = campaigns.reduce((sum, c) => sum + c.donationCount, 0);

  return (
    <>
      <section className="cx-stats" aria-label="Totals across all campaigns">
        <div className="band-inner cx-statGrid">
          <div>
            <p className="cx-statValue font-display">{wholeRand(raisedCents)}</p>
            <p className="cx-statLabel heading">raised across all campaigns</p>
          </div>
          <div>
            <p className="cx-statValue font-display">{gifts}</p>
            <p className="cx-statLabel heading">donations made</p>
          </div>
          <div>
            <p className="cx-statValue font-display">{open.length}</p>
            <p className="cx-statLabel heading">{open.length === 1 ? "campaign" : "campaigns"} open for donations</p>
          </div>
        </div>
      </section>

      <svg className="wave-divider cx-waveOutOfStats" viewBox="0 0 1440 48" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 0 L 1440 0 L 1440 26 C 1200 46, 900 10, 640 28 S 200 44, 0 24 Z" fill="currentColor" />
      </svg>

      <section id="campaigns" className="cx-listSection dotted-bg">
        <div className="band-inner">
          <h2 className="band-title heading">
            Our <span className="light">campaigns</span>
          </h2>
          <p className="band-lead">
            Each campaign has a clear goal. Amounts shown are gross, before payment-provider fees, and only completed
            payments are counted.
          </p>

          {campaigns.length === 0 ? (
            <p className="mt-8 text-center">No campaigns yet.</p>
          ) : (
            <div className="campaign-grid mt-12">
              {campaigns.map((c) => (
                <CampaignCard key={c.id} campaign={c} />
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}

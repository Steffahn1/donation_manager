import { Suspense } from "react";
import Link from "next/link";
import { Alfa_Slab_One, Barlow_Condensed, Lora } from "next/font/google";
import { getPublicCampaigns } from "@/lib/queries/campaigns";
import { isAcceptingDonations } from "@/lib/campaigns";
import { formatZar } from "@/lib/money";
import { CampaignImage } from "@/components/CampaignImage";
import "./campaigns.css";

/*
 * Trial redesign of /campaigns only. The fonts and styles are loaded here, not in the root layout,
 * so every other page keeps its current look. The data is the same as before: public campaigns
 * (ACTIVE and CLOSED, never DRAFT) with totals from SUCCEEDED donations only, and no donor details.
 */
const slab = Alfa_Slab_One({ weight: "400", subsets: ["latin"], variable: "--font-slab" });
const condensed = Barlow_Condensed({ weight: ["400", "700"], subsets: ["latin"], variable: "--font-condensed" });
const lora = Lora({ subsets: ["latin"], variable: "--font-lora" });

export const metadata = { title: "Campaigns · Donation Manager" };

const endFmt = new Intl.DateTimeFormat("en-ZA", { day: "numeric", month: "long", timeZone: "Africa/Johannesburg" });

/** Whole rands for the big headline number (the exact amounts are on each card). */
function wholeRand(cents: number): string {
  return formatZar(Math.floor(cents / 100) * 100).replace(/[.,]00$/, "");
}

export default function CampaignsPage() {
  return (
    <div data-full-bleed className={`cx-page ${slab.variable} ${condensed.variable} ${lora.variable}`}>
      <section className="cx-hero">
        <div className="cx-inner">
          <p className="cx-kicker cx-condensed">
            Every rand counts
            <svg className="cx-swoosh" viewBox="0 0 200 12" preserveAspectRatio="none" aria-hidden="true">
              <path d="M2 8 C 50 2, 120 2, 198 6 L 196 11 C 120 7, 60 8, 4 12 Z" fill="currentColor" />
            </svg>
          </p>
          <h1 className="cx-headline cx-slab">Give where it matters</h1>
          <p className="cx-lead">
            Pick a campaign, give once by card, and see exactly what your gift makes possible. Give as a guest, or
            create an account to follow every campaign you support.
          </p>
          <div className="cx-actions">
            <a href="#campaigns" className="cx-btn cx-condensed">
              See campaigns
            </a>
            <Link href="/signup" className="cx-btnOutline cx-condensed">
              Track your giving
            </Link>
          </div>
        </div>
      </section>

      <svg className="cx-wave cx-waveIntoStats" viewBox="0 0 1440 48" preserveAspectRatio="none" aria-hidden="true">
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
        <div className="cx-inner cx-statGrid">
          <div>
            <p className="cx-statValue cx-slab">{wholeRand(raisedCents)}</p>
            <p className="cx-statLabel cx-condensed">raised across all campaigns</p>
          </div>
          <div>
            <p className="cx-statValue cx-slab">{gifts}</p>
            <p className="cx-statLabel cx-condensed">donations made</p>
          </div>
          <div>
            <p className="cx-statValue cx-slab">{open.length}</p>
            <p className="cx-statLabel cx-condensed">
              {open.length === 1 ? "campaign" : "campaigns"} open for donations
            </p>
          </div>
        </div>
      </section>

      <svg className="cx-wave cx-waveOutOfStats" viewBox="0 0 1440 48" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 0 L 1440 0 L 1440 26 C 1200 46, 900 10, 640 28 S 200 44, 0 24 Z" fill="currentColor" />
      </svg>

      <section id="campaigns" className="cx-listSection">
        <div className="cx-inner">
          <h2 className="cx-sectionTitle cx-condensed">
            Our <span className="cx-light">campaigns</span>
          </h2>
          <p className="cx-sectionLead">
            Each campaign has a clear goal. Amounts shown are gross, before payment-provider fees, and only completed
            payments are counted.
          </p>

          {campaigns.length === 0 ? (
            <p className="cx-empty">No campaigns yet.</p>
          ) : (
            <div className="cx-grid">
              {campaigns.map((c) => {
                const accepting = isAcceptingDonations(c);
                const pct = c.targetCents > 0 ? Math.round((c.raisedCents / c.targetCents) * 100) : 0;
                const width = Math.min(pct, 100);
                return (
                  <article key={c.id} className="cx-card">
                    <div className="cx-media">
                      <CampaignImage src={c.imagePath} alt={c.name} />
                      {!accepting && <span className="cx-badge cx-condensed">Closed</span>}
                    </div>
                    <div className="cx-stripe" aria-hidden="true" />

                    <div className="cx-body">
                      <h3 className="cx-cardTitle cx-condensed">{c.name}</h3>
                      <p className="cx-cardText">{c.description}</p>
                      <p className="cx-impact cx-condensed">
                        {formatZar(c.impactAmountCents)} = 1 {c.impactLabel}
                      </p>

                      <div className="cx-progress">
                        <div className="cx-raised">
                          <span className="cx-raisedValue cx-slab">{formatZar(c.raisedCents)}</span>
                          <span className="cx-raisedOf cx-condensed">
                            of {formatZar(c.targetCents)} · {pct}%
                          </span>
                        </div>
                        <div
                          className="cx-track"
                          role="progressbar"
                          aria-valuenow={width}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={`${c.name}: raised towards target`}
                        >
                          <div className="cx-fill" style={{ width: `${width}%` }} />
                        </div>
                        <p className="cx-meta">
                          {accepting ? `Open until ${endFmt.format(c.endDate)}` : "No longer accepting donations"}
                        </p>
                      </div>

                      <div className="cx-cardActions">
                        {accepting && (
                          <Link href={`/donate/${c.slug}`} className="cx-btn cx-condensed">
                            Donate
                          </Link>
                        )}
                        <Link href={`/campaigns/${c.slug}`} className="cx-link cx-condensed">
                          Learn more <span className="cx-arrow" aria-hidden="true">↗</span>
                        </Link>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </>
  );
}

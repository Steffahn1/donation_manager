import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { getFeaturedCampaigns } from "@/lib/queries/campaigns";
import { CampaignPreviewCard } from "@/components/CampaignPreviewCard";
import "./landing.css";

/*
 * The landing page: why give here, how it works, and a preview of up to three open campaigns.
 * It has NO donate buttons: the previews link to each campaign's own page, and donating starts on
 * /campaigns or a campaign page. No totals here either (those live on /campaigns), and no donor details.
 * "Track your giving" goes to /signup, which sends a visitor who is already logged in on to /dashboard.
 * Page-only styles: landing.css (prefixed lp-).
 */

const STEPS = [
  {
    title: "Pick a campaign",
    text: "Every campaign has one clear goal, like food parcels for winter or shoes for school. Read its story first.",
  },
  {
    title: "Give once by card",
    text: "Choose an amount, check it on the confirm step, and pay on Stripe's secure payment page.",
  },
  {
    title: "See your gift land",
    text: "You get a receipt with a private link. Create an account to follow every campaign you support.",
  },
];

const POINTS = [
  {
    title: "Your card stays with Stripe",
    text: "Card details are typed on Stripe's page. We never see or store them.",
  },
  {
    title: "Give anonymously",
    text: "Tick one box and charity staff see “Anonymous” instead of your name and email.",
  },
  {
    title: "Honest totals",
    text: "Only completed payments count towards a campaign. Declined or abandoned payments never do.",
  },
];

export default function Home() {
  return (
    <div data-full-bleed className="full-bleed">
      <section className="lp-hero dotted-bg">
        <div className="band-inner lp-heroGrid">
          <div>
            <p className="lp-kicker heading">Giving made simple</p>
            <h1 className="lp-headline font-display">Small gifts. Real change.</h1>
            <div className="hatch-stripe lp-headlineStripe" aria-hidden="true" />
            <p className="lp-heroLead">
              Choose a cause you care about, give once by card, and see exactly what your gift makes possible. No
              account needed.
            </p>
            <div className="lp-actions">
              <Link href="/campaigns" className="btn">
                See campaigns
              </Link>
              <Link href="/signup" className="btn-secondary">
                Track your giving
              </Link>
            </div>
          </div>
          <div className="lp-art" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element -- decorative static SVG */}
            <img className="lp-artImage" src="/campaigns/winter-food-parcels.svg" alt="" />
            {/* eslint-disable-next-line @next/next/no-img-element -- decorative static SVG */}
            <img className="lp-artImage" src="/campaigns/school-shoes.svg" alt="" />
          </div>
        </div>
      </section>

      <section className="lp-band bg-white" aria-labelledby="how-it-works">
        <div className="band-inner">
          <h2 id="how-it-works" className="heading band-title">
            How <span className="light">it works</span>
          </h2>
          <ol className="lp-steps">
            {STEPS.map((step, i) => (
              <li key={step.title}>
                <p className="lp-stepNumber stat-number" aria-hidden="true">
                  {String(i + 1).padStart(2, "0")}
                </p>
                <h3 className="lp-itemTitle heading">{step.title}</h3>
                <p className="lp-itemText">{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="lp-band lp-featured" aria-labelledby="featured">
        <div className="band-inner">
          <h2 id="featured" className="heading band-title">
            Featured <span className="light">campaigns</span>
          </h2>
          <p className="band-lead">Open for donations now, starting with the ones closing soonest.</p>
          {/* The previews read the database, so they stream in behind a placeholder. */}
          <Suspense fallback={<p className="lp-loading">Loading campaigns…</p>}>
            <FeaturedCampaigns />
          </Suspense>
          <p className="lp-more">
            <Link href="/campaigns" className="arrow-link">
              See all campaigns <span className="arrow" aria-hidden="true">↗</span>
            </Link>
          </p>
        </div>
      </section>

      <svg className="wave-divider lp-waveIntoTrust" viewBox="0 0 1440 48" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 22 C 240 4, 520 40, 780 24 S 1220 2, 1440 18 L 1440 48 L 0 48 Z" fill="currentColor" />
      </svg>
      <section className="lp-trust on-dark" aria-labelledby="why-give">
        <div className="band-inner">
          <h2 id="why-give" className="heading band-title">
            Why <span className="light">give here</span>
          </h2>
          <ul className="lp-points">
            {POINTS.map((point) => (
              <li key={point.title}>
                <h3 className="lp-itemTitle heading">{point.title}</h3>
                <p className="lp-itemText">{point.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>
      <svg className="wave-divider lp-waveOutOfTrust" viewBox="0 0 1440 48" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 0 L 1440 0 L 1440 26 C 1200 46, 900 10, 640 28 S 200 44, 0 24 Z" fill="currentColor" />
      </svg>

      <section className="lp-band lp-cta" aria-labelledby="ready">
        <div className="band-inner">
          <h2 id="ready" className="heading band-title">
            Ready <span className="light">to help?</span>
          </h2>
          <p className="band-lead">Every campaign page explains what your gift pays for, so you know where it goes.</p>
          <div className="lp-actions">
            <Link href="/campaigns" className="btn">
              See campaigns
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

async function FeaturedCampaigns() {
  // "Open now" depends on today's date, so this part is rendered per request (not at build time).
  await connection();
  const campaigns = await getFeaturedCampaigns(new Date());
  if (campaigns.length === 0) {
    return <p className="lp-empty">No campaigns are open for donations right now. Please check back soon.</p>;
  }
  return (
    <div className="campaign-grid mt-12">
      {campaigns.map((c) => (
        <CampaignPreviewCard key={c.id} campaign={c} />
      ))}
    </div>
  );
}

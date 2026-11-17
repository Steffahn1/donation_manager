import Link from "next/link";
import { CampaignGrid } from "@/components/CampaignGrid";

export default function Home() {
  return (
    <div className="space-y-10">
      <section className="max-w-2xl space-y-4">
        <h1 className="page-title">
          Give to a campaign. <span className="light">See the difference.</span>
        </h1>
        <p className="text-lg leading-relaxed">
          Every donation goes to a specific campaign. You can give as a guest and get a receipt link, or create an
          account to follow every campaign you support.
        </p>
        <Link href="/campaigns" className="arrow-link">
          All campaigns and totals <span className="arrow" aria-hidden="true">↗</span>
        </Link>
      </section>
      <section className="space-y-6" aria-labelledby="home-campaigns">
        <h2 id="home-campaigns" className="section-title">
          Our <span className="light">campaigns</span>
        </h2>
        <CampaignGrid />
      </section>
    </div>
  );
}

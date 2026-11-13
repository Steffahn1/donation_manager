import { CampaignGrid } from "@/components/CampaignGrid";

export default function Home() {
  return (
    <div className="space-y-8">
      <section className="max-w-2xl">
        <h1 className="text-3xl font-bold tracking-tight">Give to a campaign. See the difference.</h1>
        <p className="mt-3 text-slate-600">
          Every donation goes to a specific campaign. You can give as a guest and get a receipt link, or create an
          account to follow every campaign you support.
        </p>
      </section>
      <CampaignGrid />
    </div>
  );
}

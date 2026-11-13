import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { isAcceptingDonations, notAcceptingReason } from "@/lib/campaigns";
import { getPublicCampaignBySlug } from "@/lib/queries/campaigns";
import { ProgressBar } from "@/components/ProgressBar";
import { DonateForm } from "@/components/forms/DonateForm";

export const metadata = { title: "Donate · Donation Manager" };

export default async function DonatePage({ params, searchParams }: PageProps<"/donate/[slug]">) {
  const { slug } = await params;
  const { retry } = await searchParams;
  const [campaign, user] = await Promise.all([getPublicCampaignBySlug(slug), getCurrentUser()]);
  if (!campaign) notFound();

  const open = isAcceptingDonations(campaign);
  const account = user?.role === "DONOR" ? { name: user.name, email: user.email } : null;

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="space-y-2">
        <Link href={`/campaigns/${campaign.slug}`} className="text-sm text-emerald-700 underline">
          ← {campaign.name}
        </Link>
        <h1 className="text-2xl font-bold">Donate to {campaign.name}</h1>
        <ProgressBar raisedCents={campaign.raisedCents} targetCents={campaign.targetCents} />
      </div>
      <div className="card">
        {open ? (
          <DonateForm
            slug={campaign.slug}
            campaignName={campaign.name}
            impactAmountCents={campaign.impactAmountCents}
            impactLabel={campaign.impactLabel}
            account={account}
            restoreSaved={retry === "1"}
          />
        ) : (
          <p className="text-slate-700">{notAcceptingReason(campaign)}</p>
        )}
      </div>
    </div>
  );
}

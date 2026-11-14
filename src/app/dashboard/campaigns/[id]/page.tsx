import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { dateIso } from "@/lib/campaigns";
import { computeMetrics } from "@/lib/metrics";
import { formatZar, impactUnits } from "@/lib/money";
import { failedCounts, getStaffCampaign, metricDonations, staffDonations } from "@/lib/queries/staff";
import { ProgressBar } from "@/components/ProgressBar";
import { StatCard } from "@/components/dashboard/StatCard";
import { DonationTable } from "@/components/dashboard/DonationTable";

export const metadata = { title: "Campaign dashboard · Donation Manager" };

export default async function StaffCampaignPage({ params }: PageProps<"/dashboard/campaigns/[id]">) {
  const user = await requireRole("SUPER_ADMIN", "CAMPAIGN_MANAGER");
  const { id } = await params;

  // Scoped: another manager's campaign is "not found", so its existence isn't revealed either.
  const campaign = await getStaffCampaign(user, id);
  if (!campaign) notFound();

  const [rows, failed, donors, failures] = await Promise.all([
    metricDonations(user, [campaign.id]),
    failedCounts(user, [campaign.id]),
    staffDonations(user, campaign.id, "SUCCEEDED"),
    staffDonations(user, campaign.id, "FAILED"),
  ]);
  const m = computeMetrics(rows, new Date());
  const weekChange = m.thisWeek.raisedCents - m.lastWeek.raisedCents;
  const units = impactUnits(m.raisedCents, campaign.impactAmountCents);

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Link href="/dashboard" className="text-sm text-emerald-700 underline">← Dashboard</Link>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h1 className="text-2xl font-bold">{campaign.name}</h1>
          <div className="flex gap-3 text-sm">
            <Link href={`/campaigns/${campaign.slug}`} className="text-emerald-700 underline">Public page</Link>
            {user.role === "SUPER_ADMIN" && (
              <Link href={`/admin/campaigns/${campaign.id}`} className="text-emerald-700 underline">Edit</Link>
            )}
          </div>
        </div>
        <p className="text-sm text-slate-600">
          {campaign.status} · {dateIso(campaign.startDate)} → {dateIso(campaign.endDate)} · managed by {campaign.manager.name}
        </p>
      </div>

      <section className="card space-y-2">
        <ProgressBar raisedCents={m.raisedCents} targetCents={campaign.targetCents} />
        <p className="text-xs text-slate-500">
          Gross, before payment-provider fees.
          {units > 0 && ` That's ${units} × ${campaign.impactLabel}.`}
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Key numbers">
        <StatCard label="Donations" value={m.donationCount} hint={`${failed(campaign.id)} failed attempts (not counted)`} />
        <StatCard
          label="Unique donors"
          value={m.uniqueDonors}
          hint={`${m.repeatDonors} gave more than once · each anonymous gift counts as one donor`}
        />
        <StatCard
          label="This week"
          value={formatZar(m.thisWeek.raisedCents)}
          hint={`${m.thisWeek.donationCount} donations · ${weekChange >= 0 ? "+" : "−"}${formatZar(Math.abs(weekChange))} vs last week`}
        />
        <StatCard
          label="Donors this week"
          value={`${m.thisWeek.newDonors} new · ${m.thisWeek.returningDonors} returning`}
          hint="Returning = gave to this campaign before this week (anonymous gifts always count as new)"
        />
      </section>

      <section className="card space-y-0 p-0">
        <h2 className="px-5 pt-4 text-lg font-semibold">Donors</h2>
        <p className="px-5 pb-2 text-xs text-slate-500">Anonymous donors are shown as &ldquo;Anonymous&rdquo;.</p>
        <DonationTable rows={donors.rows} total={donors.total} kind="donors" />
      </section>

      <section className="card space-y-0 p-0">
        <h2 className="px-5 pt-4 text-lg font-semibold">Failed payment attempts</h2>
        <p className="px-5 pb-2 text-xs text-slate-500">Declined card payments. They are never counted in any total.</p>
        <DonationTable rows={failures.rows} total={failures.total} kind="failed" />
      </section>
    </div>
  );
}

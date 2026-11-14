import Link from "next/link";
import type { CurrentUser } from "@/lib/auth";
import { computeMetrics, groupByCampaign } from "@/lib/metrics";
import { failedCounts, listStaffCampaigns, metricDonations } from "@/lib/queries/staff";
import { listManagers } from "@/lib/queries/admin";
import { formatZar } from "@/lib/money";
import { StatCard } from "./StatCard";

const STATUS_STYLE = {
  ACTIVE: "bg-emerald-100 text-emerald-800",
  DRAFT: "bg-slate-100 text-slate-700",
  CLOSED: "bg-amber-100 text-amber-800",
} as const;

/** Dashboard for staff: a campaign manager's own campaigns, or every campaign for the super admin. */
export async function StaffOverview({ user }: { user: CurrentUser }) {
  const isAdmin = user.role === "SUPER_ADMIN";
  const campaigns = await listStaffCampaigns(user);
  const ids = campaigns.map((c) => c.id);
  const [rows, failed, managers] = await Promise.all([
    metricDonations(user, ids),
    failedCounts(user, ids),
    isAdmin ? listManagers() : Promise.resolve([]),
  ]);

  const now = new Date();
  const overall = computeMetrics(rows, now);
  const byCampaign = groupByCampaign(rows);
  const failedTotal = ids.reduce((sum, id) => sum + failed(id), 0);
  const weekChange = overall.thisWeek.raisedCents - overall.lastWeek.raisedCents;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">{isAdmin ? "All campaigns" : "Your campaigns"}</h1>
        <p className="text-sm text-slate-600">
          Amounts are gross, before payment-provider fees. Only successful payments are counted.
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Totals">
        <StatCard label="Raised (gross)" value={formatZar(overall.raisedCents)} hint={`${overall.donationCount} donations`} />
        <StatCard
          label="Unique donors"
          value={overall.uniqueDonors}
          hint={`${overall.repeatDonors} gave to the same campaign more than once · each anonymous gift counts as one donor`}
        />
        <StatCard
          label="This week"
          value={formatZar(overall.thisWeek.raisedCents)}
          hint={`${weekChange >= 0 ? "+" : "−"}${formatZar(Math.abs(weekChange))} vs last week (${formatZar(overall.lastWeek.raisedCents)})`}
        />
        <StatCard label="Failed attempts" value={failedTotal} hint="Declined payments, not counted in totals" />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Campaigns</h2>
        {campaigns.length === 0 ? (
          <p className="card text-sm text-slate-600">
            {isAdmin ? "No campaigns yet." : "No campaigns are assigned to you yet. Ask the super admin."}
          </p>
        ) : (
          <div className="card overflow-x-auto p-0">
            <table className="table">
              <thead>
                <tr>
                  <th>Campaign</th>
                  <th>Status</th>
                  {isAdmin && <th>Manager</th>}
                  <th className="text-right">Raised / target</th>
                  <th className="text-right">Donations</th>
                  <th className="text-right">Donors</th>
                  <th className="text-right">This week: new / returning</th>
                  <th className="text-right">Failed</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => {
                  const m = computeMetrics(byCampaign.get(c.id) ?? [], now);
                  const pct = c.targetCents > 0 ? Math.round((m.raisedCents / c.targetCents) * 100) : 0;
                  return (
                    <tr key={c.id}>
                      <td>
                        <Link href={`/dashboard/campaigns/${c.id}`} className="font-medium text-emerald-700 underline">
                          {c.name}
                        </Link>
                      </td>
                      <td>
                        <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[c.status]}`}>{c.status}</span>
                      </td>
                      {isAdmin && <td>{c.manager.name}</td>}
                      <td className="whitespace-nowrap text-right">
                        {formatZar(m.raisedCents)} / {formatZar(c.targetCents)} <span className="text-slate-500">({pct}%)</span>
                      </td>
                      <td className="text-right">{m.donationCount}</td>
                      <td className="text-right">{m.uniqueDonors}</td>
                      <td className="text-right">
                        {m.thisWeek.newDonors} / {m.thisWeek.returningDonors}
                      </td>
                      <td className="text-right">{failed(c.id)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {isAdmin && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Campaign managers</h2>
            <Link href="/admin/managers" className="text-sm text-emerald-700 underline">Manage</Link>
          </div>
          <div className="card overflow-x-auto p-0">
            <table className="table">
              <thead><tr><th>Name</th><th>Email</th><th className="text-right">Campaigns</th></tr></thead>
              <tbody>
                {managers.map((m) => (
                  <tr key={m.id}>
                    <td className="font-medium">{m.name}</td>
                    <td>{m.email}</td>
                    <td className="text-right">{m._count.managedCampaigns}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

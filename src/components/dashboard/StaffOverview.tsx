import Link from "next/link";
import type { CurrentUser } from "@/lib/auth";
import { computeMetrics, groupByCampaign, longTermSeries, weeklySeries } from "@/lib/metrics";
import { failedCounts, listStaffCampaigns, metricDonations } from "@/lib/queries/staff";
import { listManagers } from "@/lib/queries/admin";
import { formatZar } from "@/lib/money";
import { StatCard } from "./StatCard";
import { ExportForm } from "./ExportForm";
import { LongTermChart } from "@/components/charts/LongTermChart";
import { WeeklyChart } from "@/components/charts/WeeklyChart";

const STATUS_STYLE = {
  ACTIVE: "badge-success",
  DRAFT: "badge-neutral",
  CLOSED: "badge-closed",
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
        <h1 className="page-title">{isAdmin ? "All campaigns" : "Your campaigns"}</h1>
        <p className="text-muted text-sm">
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

      {rows.length > 0 && (
        <section className="grid gap-6 lg:grid-cols-2" aria-label="Pacing">
          <div className="card space-y-2">
            <h2 className="section-title">All {isAdmin ? "" : "your "}campaigns since the start</h2>
            <LongTermChart data={longTermSeries(rows, null, now)} />
          </div>
          <div className="card space-y-2">
            <h2 className="section-title">Week by week</h2>
            <WeeklyChart data={weeklySeries(rows, now)} />
          </div>
        </section>
      )}

      <section className="card space-y-3">
        <h2 className="section-title">Export donations</h2>
        <ExportForm action="/api/export/donations.csv" />
      </section>

      <section className="space-y-3">
        <h2 className="section-title">Campaigns</h2>
        {campaigns.length === 0 ? (
          <p className="card text-muted text-sm">
            {isAdmin ? "No campaigns yet." : "No campaigns are assigned to you yet. Ask the super admin."}
          </p>
        ) : (
          <div className="card overflow-x-auto p-0">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Campaign</th>
                  <th scope="col">Status</th>
                  {isAdmin && <th scope="col">Manager</th>}
                  <th scope="col" className="text-right">Raised / target</th>
                  <th scope="col" className="text-right">Donations</th>
                  <th scope="col" className="text-right">Donors</th>
                  <th scope="col" className="text-right">This week: new / returning</th>
                  <th scope="col" className="text-right">Failed</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => {
                  const m = computeMetrics(byCampaign.get(c.id) ?? [], now);
                  const pct = c.targetCents > 0 ? Math.round((m.raisedCents / c.targetCents) * 100) : 0;
                  return (
                    <tr key={c.id}>
                      <td>
                        <Link href={`/dashboard/campaigns/${c.id}`} className="link font-semibold">
                          {c.name}
                        </Link>
                      </td>
                      <td>
                        <span className={`badge ${STATUS_STYLE[c.status]}`}>{c.status}</span>
                      </td>
                      {isAdmin && <td>{c.manager.name}</td>}
                      <td className="num">
                        {formatZar(m.raisedCents)} / {formatZar(c.targetCents)} <span className="text-muted">({pct}%)</span>
                      </td>
                      <td className="num">{m.donationCount}</td>
                      <td className="num">{m.uniqueDonors}</td>
                      <td className="num">
                        {m.thisWeek.newDonors} / {m.thisWeek.returningDonors}
                      </td>
                      <td className="num">{failed(c.id)}</td>
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
            <h2 className="section-title">Campaign managers</h2>
            <Link href="/admin/managers" className="link text-sm">Manage</Link>
          </div>
          <div className="card overflow-x-auto p-0">
            <table className="table">
              <thead><tr><th scope="col">Name</th><th scope="col">Email</th><th scope="col" className="text-right">Campaigns</th></tr></thead>
              <tbody>
                {managers.map((m) => (
                  <tr key={m.id}>
                    <td className="font-medium">{m.name}</td>
                    <td>{m.email}</td>
                    <td className="num">{m._count.managedCampaigns}</td>
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

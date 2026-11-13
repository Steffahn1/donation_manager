import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { listAllCampaigns } from "@/lib/queries/admin";
import { raisedByCampaign } from "@/lib/queries/campaigns";
import { formatZar } from "@/lib/money";
import { dateIso } from "@/lib/campaigns";

export const metadata = { title: "Manage campaigns · Donation Manager" };

export default async function AdminCampaignsPage() {
  await requireRole("SUPER_ADMIN");
  const campaigns = await listAllCampaigns();
  const totals = await raisedByCampaign(campaigns.map((c) => c.id));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Manage campaigns</h1>
        <Link href="/admin/campaigns/new" className="btn">New campaign</Link>
      </div>
      <div className="card overflow-x-auto p-0">
        <table className="table">
          <thead>
            <tr>
              <th>Campaign</th><th>Status</th><th>Manager</th><th>Dates</th><th>Raised / target</th><th />
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => (
              <tr key={c.id}>
                <td className="font-medium">{c.name}</td>
                <td>{c.status}</td>
                <td>{c.manager.name}</td>
                <td className="whitespace-nowrap">{dateIso(c.startDate)} → {dateIso(c.endDate)}</td>
                <td className="whitespace-nowrap">{formatZar(totals(c.id).raisedCents)} / {formatZar(c.targetCents)}</td>
                <td><Link href={`/admin/campaigns/${c.id}`} className="text-emerald-700 underline">Edit</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

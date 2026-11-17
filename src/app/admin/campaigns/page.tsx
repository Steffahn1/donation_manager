import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { listAllCampaigns } from "@/lib/queries/admin";
import { raisedByCampaign } from "@/lib/queries/campaigns";
import { formatZar } from "@/lib/money";
import { dateIso } from "@/lib/campaigns";

export const metadata = { title: "Manage campaigns · Donation Manager" };

const STATUS_BADGE = { ACTIVE: "badge-success", DRAFT: "badge-neutral", CLOSED: "badge-closed" } as const;

export default async function AdminCampaignsPage() {
  await requireRole("SUPER_ADMIN");
  const campaigns = await listAllCampaigns();
  const totals = await raisedByCampaign(campaigns.map((c) => c.id));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title">Manage campaigns</h1>
        <Link href="/admin/campaigns/new" className="btn">New campaign</Link>
      </div>
      <div className="card relative overflow-x-auto p-0">
        <table className="table">
          <caption className="sr-only">All campaigns</caption>
          <thead>
            <tr>
              <th scope="col">Campaign</th><th scope="col">Status</th><th scope="col">Manager</th><th scope="col">Dates</th><th scope="col" className="text-right">Raised / target</th><th scope="col"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => (
              <tr key={c.id}>
                <td className="font-medium">{c.name}</td>
                <td><span className={`badge ${STATUS_BADGE[c.status]}`}>{c.status}</span></td>
                <td>{c.manager.name}</td>
                <td className="whitespace-nowrap">{dateIso(c.startDate)} → {dateIso(c.endDate)}</td>
                <td className="num">{formatZar(totals(c.id).raisedCents)} / {formatZar(c.targetCents)}</td>
                <td><Link href={`/admin/campaigns/${c.id}`} className="link" aria-label={`Edit ${c.name}`}>Edit</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

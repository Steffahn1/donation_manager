import { requireRole } from "@/lib/auth";
import { listManagers } from "@/lib/queries/admin";
import { ManagerForm } from "@/components/forms/ManagerForm";

export const metadata = { title: "Campaign managers · Donation Manager" };

export default async function ManagersPage() {
  await requireRole("SUPER_ADMIN");
  const managers = await listManagers();

  return (
    <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
      <div className="min-w-0 space-y-4">
        <h1 className="page-title">Campaign managers</h1>
        <div className="card relative overflow-x-auto p-0">
          <table className="table">
            <caption className="sr-only">Campaign managers</caption>
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
      </div>
      <ManagerForm />
    </div>
  );
}

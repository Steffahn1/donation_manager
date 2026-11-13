import { requireRole } from "@/lib/auth";
import { listManagers } from "@/lib/queries/admin";
import { ManagerForm } from "@/components/forms/ManagerForm";

export const metadata = { title: "Campaign managers · Donation Manager" };

export default async function ManagersPage() {
  await requireRole("SUPER_ADMIN");
  const managers = await listManagers();

  return (
    <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Campaign managers</h1>
        <div className="card overflow-x-auto p-0">
          <table className="table">
            <thead><tr><th>Name</th><th>Email</th><th>Campaigns</th></tr></thead>
            <tbody>
              {managers.map((m) => (
                <tr key={m.id}>
                  <td className="font-medium">{m.name}</td>
                  <td>{m.email}</td>
                  <td>{m._count.managedCampaigns}</td>
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

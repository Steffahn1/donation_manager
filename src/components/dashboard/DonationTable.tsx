import type { StaffDonation } from "@/lib/privacy";
import { formatZar } from "@/lib/money";

const dateTime = new Intl.DateTimeFormat("en-ZA", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Africa/Johannesburg",
});

/**
 * Donations as staff may see them. Takes StaffDonation only (already masked on the server by
 * toStaffDonation), so this component cannot show an anonymous donor's identity.
 */
export function DonationTable({
  rows,
  total,
  kind,
}: {
  rows: StaffDonation[];
  total: number;
  kind: "donors" | "failed";
}) {
  if (rows.length === 0) {
    return (
      <p className="px-5 py-4 text-sm text-slate-600">
        {kind === "donors" ? "No donations yet." : "No failed payment attempts."}
      </p>
    );
  }
  return (
    <>
      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>{kind === "donors" ? "Paid" : "Attempted"}</th>
              <th>Donor</th>
              <th>Email</th>
              <th className="text-right">Amount</th>
              {kind === "failed" && <th>Reason</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id}>
                <td className="whitespace-nowrap">{dateTime.format(kind === "donors" ? (d.paidAt ?? d.createdAt) : d.createdAt)}</td>
                <td className={d.isAnonymous ? "italic text-slate-500" : "font-medium"}>{d.donorName}</td>
                <td className="text-slate-600">{d.donorEmail ?? "—"}</td>
                <td className="whitespace-nowrap text-right">{formatZar(d.amountCents)}</td>
                {kind === "failed" && <td className="text-slate-600">{d.failureReason ?? "Declined"}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {total > rows.length && (
        <p className="px-5 py-3 text-xs text-slate-500">
          Showing the latest {rows.length} of {total}. The full list will be in the CSV export.
        </p>
      )}
    </>
  );
}

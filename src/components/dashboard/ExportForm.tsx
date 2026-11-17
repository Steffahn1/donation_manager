import { defaultRangeInputs } from "@/lib/csv";

/**
 * Plain HTML form (no JavaScript needed): submitting downloads the CSV. Exports contain paid donations
 * only, between the two dates (Johannesburg days, both included).
 */
export function ExportForm({
  action,
  campaignId,
  label = "Download CSV",
}: {
  action: "/api/export/donations.csv" | "/api/export/my-donations.csv";
  campaignId?: string;
  label?: string;
}) {
  const { from, to } = defaultRangeInputs(new Date());
  return (
    <form action={action} method="GET" className="flex flex-wrap items-end gap-3">
      {campaignId && <input type="hidden" name="campaign" value={campaignId} />}
      <div>
        <label className="label" htmlFor={`from-${campaignId ?? "all"}`}>From</label>
        <input className="input" type="date" id={`from-${campaignId ?? "all"}`} name="from" defaultValue={from} required />
      </div>
      <div>
        <label className="label" htmlFor={`to-${campaignId ?? "all"}`}>To</label>
        <input className="input" type="date" id={`to-${campaignId ?? "all"}`} name="to" defaultValue={to} required />
      </div>
      <button className="btn-secondary">{label}</button>
      <p className="help w-full">Paid donations only. Dates are Johannesburg days, both included.</p>
    </form>
  );
}

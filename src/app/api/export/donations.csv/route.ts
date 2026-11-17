import { getUserWithRole } from "@/lib/auth";
import { parseDateRange, toCsv } from "@/lib/csv";
import { STAFF_HEADER, campaignParam, csvFilename, staffRows } from "@/lib/exports";
import { staffExportDonations } from "@/lib/queries/staff";

/**
 * Staff CSV of PAID donations: GET /api/export/donations.csv?from=YYYY-MM-DD&to=YYYY-MM-DD[&campaign=id]
 * Super admin: all campaigns. Campaign manager: only their own (another manager's campaign gives an
 * empty file, so its existence isn't revealed). Anonymous donors are masked by toStaffDonation.
 */
export async function GET(request: Request) {
  const auth = await getUserWithRole("SUPER_ADMIN", "CAMPAIGN_MANAGER");
  if (!auth.ok) return new Response(auth.status === 401 ? "Please log in." : "Not allowed.", { status: auth.status });

  const url = new URL(request.url);
  const range = parseDateRange(url.searchParams.get("from"), url.searchParams.get("to"), new Date());
  if ("error" in range) return new Response(range.error, { status: 400 });
  const campaignId = campaignParam(url.searchParams.get("campaign"));
  if (campaignId === null) return new Response("Unknown campaign.", { status: 400 });

  const rows = await staffExportDonations(auth.user, range, campaignId);

  return new Response(toCsv(STAFF_HEADER, staffRows(rows)), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${csvFilename("donations", range)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

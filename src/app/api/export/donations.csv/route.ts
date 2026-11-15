import { db } from "@/lib/db";
import { getUserWithRole } from "@/lib/auth";
import { parseDateRange, toCsv } from "@/lib/csv";
import { STAFF_HEADER, campaignParam, csvFilename, staffExportWhere, staffRows } from "@/lib/exports";
import { staffDonationSelect, toStaffDonation } from "@/lib/privacy";

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

  const rows = await db.donation.findMany({
    where: staffExportWhere(auth.user, range, campaignId),
    select: staffDonationSelect,
    orderBy: [{ paidAt: "asc" }, { id: "asc" }],
  });

  return new Response(toCsv(STAFF_HEADER, staffRows(rows.map(toStaffDonation))), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${csvFilename("donations", range)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

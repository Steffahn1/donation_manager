import { getUserWithRole } from "@/lib/auth";
import { parseDateRange, toCsv } from "@/lib/csv";
import { DONOR_HEADER, csvFilename, donorRows } from "@/lib/exports";
import { donorExportDonations } from "@/lib/queries/donor";

/** A donor's own PAID donations: GET /api/export/my-donations.csv?from=YYYY-MM-DD&to=YYYY-MM-DD */
export async function GET(request: Request) {
  const auth = await getUserWithRole("DONOR");
  if (!auth.ok) return new Response(auth.status === 401 ? "Please log in." : "Not allowed.", { status: auth.status });
  if (!auth.user.emailVerified) return new Response("Please confirm your email address first.", { status: 403 });

  const url = new URL(request.url);
  const range = parseDateRange(url.searchParams.get("from"), url.searchParams.get("to"), new Date());
  if ("error" in range) return new Response(range.error, { status: 400 });

  const rows = await donorExportDonations(auth.user, range);

  return new Response(toCsv(DONOR_HEADER, donorRows(rows)), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${csvFilename("my-donations", range)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

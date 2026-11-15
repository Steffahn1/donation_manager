import { db } from "@/lib/db";
import { getUserWithRole } from "@/lib/auth";
import { parseDateRange, toCsv } from "@/lib/csv";
import { DONOR_HEADER, csvFilename, donorExportWhere, donorRows } from "@/lib/exports";

/** A donor's own PAID donations: GET /api/export/my-donations.csv?from=YYYY-MM-DD&to=YYYY-MM-DD */
export async function GET(request: Request) {
  const auth = await getUserWithRole("DONOR");
  if (!auth.ok) return new Response(auth.status === 401 ? "Please log in." : "Not allowed.", { status: auth.status });
  if (!auth.user.emailVerified) return new Response("Please confirm your email address first.", { status: 403 });

  const url = new URL(request.url);
  const range = parseDateRange(url.searchParams.get("from"), url.searchParams.get("to"), new Date());
  if ("error" in range) return new Response(range.error, { status: 400 });

  // Only through Donor.userId, which is set when the email is confirmed (see verification-rules.ts).
  const donor = await db.donor.findUnique({ where: { userId: auth.user.id }, select: { id: true } });
  const rows = donor
    ? await db.donation.findMany({
        where: donorExportWhere(donor.id, range),
        select: { paidAt: true, createdAt: true, amountCents: true, isAnonymous: true, donorName: true, campaign: { select: { name: true } } },
        orderBy: [{ paidAt: "asc" }, { id: "asc" }],
      })
    : [];

  return new Response(toCsv(DONOR_HEADER, donorRows(rows)), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${csvFilename("my-donations", range)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

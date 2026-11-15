import type { CurrentUser } from "./auth";
import { campaignScopeFor } from "./campaigns";
import { centsToRand, sastDateTime, type DateRange } from "./csv";
import type { StaffDonation } from "./privacy";

/**
 * What goes into the CSV exports (pure; tested in exports.test.ts). Exports contain PAID donations
 * only. Staff rows are StaffDonation values, i.e. already masked by toStaffDonation, so an anonymous
 * donor appears as "Anonymous" with no email. The rows contain no donor counts; any counts shown to
 * staff must come from computeMetrics (anonymous gifts are counted separately there).
 */

/** Prisma filter for a staff export: paid, in range, and only campaigns this user may see. */
export function staffExportWhere(user: CurrentUser, range: DateRange, campaignId?: string) {
  return {
    status: "SUCCEEDED" as const,
    paidAt: { gte: range.start, lt: range.end },
    campaign: campaignScopeFor(user),
    ...(campaignId ? { campaignId } : {}),
  };
}

/** Prisma filter for a donor's own export: paid, in range, their own donor record only. */
export function donorExportWhere(donorId: string, range: DateRange) {
  return { status: "SUCCEEDED" as const, paidAt: { gte: range.start, lt: range.end }, donorId };
}

export const STAFF_HEADER = ["Paid at (Johannesburg)", "Campaign", "Amount (ZAR)", "Donor", "Email", "Anonymous", "Reference"];

export function staffRows(donations: StaffDonation[]): (string | number)[][] {
  return donations.map((d) => [
    sastDateTime(d.paidAt ?? d.createdAt),
    d.campaignName,
    centsToRand(d.amountCents),
    d.donorName,
    d.donorEmail ?? "",
    d.isAnonymous ? "yes" : "no",
    d.id,
  ]);
}

export const DONOR_HEADER = ["Paid at (Johannesburg)", "Campaign", "Amount (ZAR)", "Shown to the charity as"];

export type DonorExportRow = {
  paidAt: Date | null;
  createdAt: Date;
  amountCents: number;
  isAnonymous: boolean;
  donorName: string;
  campaign: { name: string };
};

export function donorRows(donations: DonorExportRow[]): (string | number)[][] {
  return donations.map((d) => [
    sastDateTime(d.paidAt ?? d.createdAt),
    d.campaign.name,
    centsToRand(d.amountCents),
    d.isAnonymous ? "Anonymous" : d.donorName,
  ]);
}

/** Campaign ids from the URL: cuid-like or nothing (anything else matches no campaign). */
export function campaignParam(value: string | null): string | undefined | null {
  if (value === null || value === "") return undefined;
  return /^[a-z0-9]{1,64}$/.test(value) ? value : null;
}

export function csvFilename(kind: "donations" | "my-donations", range: DateRange): string {
  return `${kind}_${range.from}_to_${range.to}.csv`;
}

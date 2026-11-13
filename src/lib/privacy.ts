import type { DonationStatus } from "@/generated/prisma/client";

/**
 * Donor-identity masking for staff (super admin AND campaign managers).
 *
 * Every staff-facing page and CSV export must pass donation rows through
 * `toStaffDonation` on the server. The real name/email of an anonymous donor
 * therefore never leaves the server for a staff user: it is not in the HTML,
 * not in the RSC payload and not in the CSV.
 */

export const ANONYMOUS_LABEL = "Anonymous";

/** Raw row shape that staff queries select (see staffDonationSelect). */
export type StaffDonationRow = {
  id: string;
  amountCents: number;
  status: DonationStatus;
  isAnonymous: boolean;
  failureReason: string | null;
  createdAt: Date;
  paidAt: Date | null;
  /** Name typed for this gift (see schema), shown to staff instead of the shared Donor.name. */
  donorName: string;
  campaign: { id: string; name: string };
  donor: { id: string; email: string };
};

/** What staff are allowed to see. Note: no email or name for anonymous gifts. */
export type StaffDonation = {
  id: string;
  amountCents: number;
  status: DonationStatus;
  isAnonymous: boolean;
  failureReason: string | null;
  createdAt: Date;
  paidAt: Date | null;
  campaignId: string;
  campaignName: string;
  donorName: string;
  donorEmail: string | null;
};

export const staffDonationSelect = {
  id: true,
  amountCents: true,
  status: true,
  isAnonymous: true,
  failureReason: true,
  createdAt: true,
  paidAt: true,
  donorName: true,
  campaign: { select: { id: true, name: true } },
  donor: { select: { id: true, email: true } },
} as const;

export function toStaffDonation(row: StaffDonationRow): StaffDonation {
  return {
    id: row.id,
    amountCents: row.amountCents,
    status: row.status,
    isAnonymous: row.isAnonymous,
    failureReason: row.failureReason,
    createdAt: row.createdAt,
    paidAt: row.paidAt,
    campaignId: row.campaign.id,
    campaignName: row.campaign.name,
    donorName: row.isAnonymous ? ANONYMOUS_LABEL : row.donorName,
    donorEmail: row.isAnonymous ? null : row.donor.email,
  };
}

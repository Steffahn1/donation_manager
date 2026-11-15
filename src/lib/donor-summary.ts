import type { DonationStatus } from "@/generated/prisma/client";
import { impactUnits } from "./money";

/**
 * A donor's own view of their gifts (pure, tested in donor-summary.test.ts). Donors see their gifts
 * under their real identity: the staff-side rule that anonymous gifts count as separate donors does
 * not apply here.
 */

export type DonorDonationRow = {
  id: string;
  amountCents: number;
  status: DonationStatus;
  isAnonymous: boolean;
  donorName: string;
  createdAt: Date;
  paidAt: Date | null;
  /** Whether a Stripe payment page was ever opened. PENDING without one never reached Stripe. */
  hasCheckout: boolean;
  campaign: { id: string; name: string; slug: string; targetCents: number; impactAmountCents: number; impactLabel: string };
};

/** Rows the donor should see: everything except attempts that never reached Stripe. */
export function visibleDonations(rows: DonorDonationRow[]): DonorDonationRow[] {
  return rows.filter((r) => !(r.status === "PENDING" && !r.hasCheckout));
}

export type CampaignGiving = {
  campaignId: string;
  name: string;
  slug: string;
  targetCents: number;
  givenCents: number;
  impactUnits: number;
  impactLabel: string;
};

export type DonorSummary = { totalGivenCents: number; paidGifts: number; campaigns: CampaignGiving[] };

/** Totals and impact from SUCCEEDED gifts only, per campaign (impact units are per campaign). */
export function summarizeGiving(rows: DonorDonationRow[]): DonorSummary {
  const byCampaign = new Map<string, CampaignGiving>();
  let total = 0;
  let paid = 0;
  for (const r of rows) {
    if (r.status !== "SUCCEEDED") continue;
    total += r.amountCents;
    paid++;
    const c = byCampaign.get(r.campaign.id) ?? {
      campaignId: r.campaign.id,
      name: r.campaign.name,
      slug: r.campaign.slug,
      targetCents: r.campaign.targetCents,
      givenCents: 0,
      impactUnits: 0,
      impactLabel: r.campaign.impactLabel,
    };
    c.givenCents += r.amountCents;
    byCampaign.set(r.campaign.id, c);
  }
  const campaigns = [...byCampaign.values()].map((c) => {
    const impactAmount = rows.find((r) => r.campaign.id === c.campaignId)!.campaign.impactAmountCents;
    // Units from the campaign total, not per gift: R300 + R200 for "R500 = 1 family" is 1 family.
    return { ...c, impactUnits: impactUnits(c.givenCents, impactAmount) };
  });
  campaigns.sort((a, b) => b.givenCents - a.givenCents || a.name.localeCompare(b.name));
  return { totalGivenCents: total, paidGifts: paid, campaigns };
}

export function donorStatusLabel(r: Pick<DonorDonationRow, "status">): string {
  switch (r.status) {
    case "SUCCEEDED":
      return "Paid";
    case "PENDING":
      return "Processing";
    case "FAILED":
      return "Declined (not charged)";
    case "EXPIRED":
      return "Not completed (not charged)";
  }
}

/**
 * The only change a donor can make to a gift: reveal their name on one of THEIR OWN PAID gifts that is
 * still anonymous. One-way by construction: the filter requires isAnonymous=true and the update only
 * ever sets false, so a named gift can never become anonymous again. Used by reveal.ts.
 */
export function revealWhere(donationId: string, userId: string) {
  return { id: donationId, status: "SUCCEEDED", isAnonymous: true, donor: { userId } } as const;
}
export const REVEAL_DATA = { isAnonymous: false } as const;

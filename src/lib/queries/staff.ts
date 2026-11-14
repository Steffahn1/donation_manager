import "server-only";
import { db } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth";
import { campaignScopeFor } from "@/lib/campaigns";
import { staffDonationSelect, toStaffDonation, type StaffDonation } from "@/lib/privacy";
import type { MetricDonation } from "@/lib/metrics";

/**
 * Queries for staff dashboards. Every query is scoped with campaignScopeFor(user): a campaign
 * manager can only ever read their own campaigns, whatever id is passed in. Donation rows go
 * through toStaffDonation, so anonymous donors leave the server only as "Anonymous".
 */

/** Campaigns this staff user may see, with their manager's name. */
export function listStaffCampaigns(user: CurrentUser) {
  return db.campaign.findMany({
    where: campaignScopeFor(user),
    include: { manager: { select: { name: true } } },
    orderBy: [{ status: "asc" }, { endDate: "asc" }],
  });
}

/** One campaign, or null if it doesn't exist OR this user may not see it (same answer for both). */
export function getStaffCampaign(user: CurrentUser, campaignId: string) {
  return db.campaign.findFirst({
    where: { id: campaignId, ...campaignScopeFor(user) },
    include: { manager: { select: { name: true } } },
  });
}

/**
 * Successful donations for metrics. Callers pass campaign ids they already got from a scoped
 * query above; the campaign filter is applied again here so this can't be misused.
 */
export function metricDonations(user: CurrentUser, campaignIds: string[]): Promise<MetricDonation[]> {
  return db.donation.findMany({
    where: { campaignId: { in: campaignIds }, campaign: campaignScopeFor(user), status: "SUCCEEDED" },
    select: { id: true, donorId: true, isAnonymous: true, campaignId: true, amountCents: true, status: true, paidAt: true },
  });
}

/** Number of FAILED (declined) attempts per campaign. */
export async function failedCounts(user: CurrentUser, campaignIds: string[]) {
  const rows = await db.donation.groupBy({
    by: ["campaignId"],
    where: { campaignId: { in: campaignIds }, campaign: campaignScopeFor(user), status: "FAILED" },
    _count: { _all: true },
  });
  const map = new Map(rows.map((r) => [r.campaignId, r._count._all]));
  return (id: string) => map.get(id) ?? 0;
}

export const DONATION_LIST_LIMIT = 50;

/**
 * The latest donations of one campaign with the given status, masked for staff.
 * SUCCEEDED: the donor list. FAILED: declined attempts (the webhook only sets FAILED after a real
 * decline, so payments that never reached Stripe are not in this list).
 */
export async function staffDonations(
  user: CurrentUser,
  campaignId: string,
  status: "SUCCEEDED" | "FAILED",
): Promise<{ rows: StaffDonation[]; total: number }> {
  const where = { campaignId, campaign: campaignScopeFor(user), status };
  const [rows, total] = await Promise.all([
    db.donation.findMany({
      where,
      select: staffDonationSelect,
      orderBy: status === "SUCCEEDED" ? [{ paidAt: "desc" }, { id: "asc" }] : [{ createdAt: "desc" }, { id: "asc" }],
      take: DONATION_LIST_LIMIT,
    }),
    db.donation.count({ where }),
  ]);
  return { rows: rows.map(toStaffDonation), total };
}

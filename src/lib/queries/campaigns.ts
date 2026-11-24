import "server-only";
import { db } from "@/lib/db";
import { pickFeatured, todayIso } from "@/lib/campaigns";

/** Gross raised (SUCCEEDED donations only) and donation count per campaign. */
export async function raisedByCampaign(campaignIds: string[]) {
  const rows = await db.donation.groupBy({
    by: ["campaignId"],
    where: { campaignId: { in: campaignIds }, status: "SUCCEEDED" },
    _sum: { amountCents: true },
    _count: { _all: true },
  });
  const map = new Map<string, { raisedCents: number; donationCount: number }>();
  for (const r of rows) {
    map.set(r.campaignId, { raisedCents: r._sum.amountCents ?? 0, donationCount: r._count._all });
  }
  return (id: string) => map.get(id) ?? { raisedCents: 0, donationCount: 0 };
}

/** Campaigns the public can see: everything except drafts. Active first. */
export async function getPublicCampaigns() {
  const campaigns = await db.campaign.findMany({
    where: { status: { in: ["ACTIVE", "CLOSED"] } },
    omit: { story: true }, // the long article is only needed on the campaign's own page
    orderBy: [{ status: "asc" }, { endDate: "asc" }],
  });
  const totals = await raisedByCampaign(campaigns.map((c) => c.id));
  return campaigns.map((c) => ({ ...c, ...totals(c.id) }));
}

/**
 * The landing page's featured campaigns (see pickFeatured): open ones only, ending soonest first,
 * at most three, with their totals (SUCCEEDED donations only). Public data only: no donor details,
 * and only the fields a preview card shows.
 */
export async function getFeaturedCampaigns(now: Date) {
  // Campaign dates are DATE columns (midnight UTC), so "open today" (Johannesburg date, as in
  // isAcceptingDonations) is: ACTIVE, startDate <= today and endDate >= today. The database only
  // returns the open campaigns; pickFeatured then orders them and keeps three.
  const today = new Date(`${todayIso(now)}T00:00:00Z`);
  const open = await db.campaign.findMany({
    where: { status: "ACTIVE", startDate: { lte: today }, endDate: { gte: today } },
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      imagePath: true,
      status: true,
      startDate: true,
      endDate: true,
      targetCents: true,
      impactAmountCents: true,
      impactLabel: true,
    },
  });
  const featured = pickFeatured(open, now);
  const totals = await raisedByCampaign(featured.map((c) => c.id));
  return featured.map((c) => ({ ...c, ...totals(c.id) }));
}

/** A public (non-draft) campaign with its totals, without the long article (e.g. the donate page). */
export async function getPublicCampaignBySlug(slug: string) {
  const campaign = await db.campaign.findUnique({ where: { slug }, omit: { story: true } });
  if (!campaign || campaign.status === "DRAFT") return null;
  const totals = await raisedByCampaign([campaign.id]);
  return { ...campaign, ...totals(campaign.id) };
}

/** The same, plus the campaign's article: only for its own "Learn more" page. */
export async function getPublicCampaignPageBySlug(slug: string) {
  const campaign = await db.campaign.findUnique({ where: { slug } });
  if (!campaign || campaign.status === "DRAFT") return null;
  const totals = await raisedByCampaign([campaign.id]);
  return { ...campaign, ...totals(campaign.id) };
}

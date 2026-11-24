import type { CampaignStatus } from "@/generated/prisma/client";
import type { CurrentUser } from "./auth";

const CHARITY_TIME_ZONE = "Africa/Johannesburg";

/** Today's date (YYYY-MM-DD) in the charity's time zone. */
export function todayIso(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: CHARITY_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

const dayFmt = new Intl.DateTimeFormat("en-ZA", { day: "numeric", month: "long", timeZone: CHARITY_TIME_ZONE });

/** A campaign date for donors, e.g. "20 December" (shared by the campaign cards). */
export function formatCampaignDay(date: Date): string {
  return dayFmt.format(date);
}

/** Campaign dates are stored as Postgres DATE (midnight UTC); compare as YYYY-MM-DD. */
export function dateIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

type DonatableCampaign = { status: CampaignStatus; startDate: Date; endDate: Date };

/** Donations are only accepted while a campaign is ACTIVE and today is within its dates. */
export function isAcceptingDonations(campaign: DonatableCampaign, now: Date = new Date()): boolean {
  const today = todayIso(now);
  return (
    campaign.status === "ACTIVE" &&
    dateIso(campaign.startDate) <= today &&
    today <= dateIso(campaign.endDate)
  );
}

/** Why a campaign is not accepting donations, for the donor-facing message. */
export function notAcceptingReason(campaign: DonatableCampaign, now: Date = new Date()): string | null {
  if (isAcceptingDonations(campaign, now)) return null;
  const today = todayIso(now);
  if (campaign.status === "DRAFT") return "This campaign has not launched yet.";
  if (campaign.status === "CLOSED" || today > dateIso(campaign.endDate)) return "This campaign has closed.";
  return "This campaign has not started yet.";
}

export type CampaignAvailability = "open" | "upcoming" | "closed" | "draft";

/**
 * Where a campaign stands for donors, so pages never call an upcoming campaign "closed".
 * open: accepting donations now. upcoming: ACTIVE but its start date is still ahead.
 * closed: CLOSED, or its end date has passed. draft: not launched (never shown publicly).
 */
export function campaignAvailability(campaign: DonatableCampaign, now: Date = new Date()): CampaignAvailability {
  if (isAcceptingDonations(campaign, now)) return "open";
  if (campaign.status === "DRAFT") return "draft";
  if (campaign.status === "CLOSED" || todayIso(now) > dateIso(campaign.endDate)) return "closed";
  return "upcoming";
}

/**
 * Database filter for campaigns open for donations today: the same rule as isAcceptingDonations,
 * written for DATE columns (stored as midnight UTC), with "today" as the Johannesburg date.
 */
export function openCampaignsWhere(now: Date = new Date()) {
  const today = new Date(`${todayIso(now)}T00:00:00Z`);
  return { status: "ACTIVE" as const, startDate: { lte: today }, endDate: { gte: today } };
}

/** How many campaigns the landing page previews. */
export const FEATURED_COUNT = 3;

/**
 * The campaigns featured on the landing page: only ones open for donations right now, the ones
 * ending soonest first (they need help most urgently), at most FEATURED_COUNT. There is no
 * "featured" setting: the choice is automatic, so it never needs a schema change.
 */
export function pickFeatured<T extends DonatableCampaign & { name: string }>(campaigns: T[], now: Date = new Date()): T[] {
  return campaigns
    .filter((c) => isAcceptingDonations(c, now))
    .sort((a, b) => a.endDate.getTime() - b.endDate.getTime() || a.name.localeCompare(b.name, "en"))
    .slice(0, FEATURED_COUNT);
}

/**
 * Prisma `where` filter limiting which campaigns a staff user may see.
 * Super admin: all. Campaign manager: only their own. Anyone else: nothing.
 */
export function campaignScopeFor(user: CurrentUser) {
  if (user.role === "SUPER_ADMIN") return {};
  if (user.role === "CAMPAIGN_MANAGER") return { managerId: user.id };
  return { id: "__none__" };
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // drop accents split off by NFKD ("è" -> "e")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

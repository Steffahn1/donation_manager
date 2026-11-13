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
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

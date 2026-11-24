import { describe, expect, it } from "vitest";
import type { CurrentUser } from "./auth";
import {
  FEATURED_COUNT,
  campaignAvailability,
  campaignScopeFor,
  isAcceptingDonations,
  notAcceptingReason,
  pickFeatured,
  slugify,
  todayIso,
} from "./campaigns";

// Campaign dates are stored as Postgres DATE (midnight UTC).
const day = (iso: string) => new Date(`${iso}T00:00:00Z`);
const campaign = { status: "ACTIVE" as const, startDate: day("2026-11-10"), endDate: day("2026-11-20") };

describe("todayIso", () => {
  it("uses Johannesburg time (UTC+2), not UTC", () => {
    expect(todayIso(new Date("2026-11-09T21:59:00Z"))).toBe("2026-11-09"); // 23:59 SAST
    expect(todayIso(new Date("2026-11-09T22:01:00Z"))).toBe("2026-11-10"); // 00:01 SAST
  });
});

describe("isAcceptingDonations", () => {
  it("opens at 00:00 Johannesburg time on the start date", () => {
    expect(isAcceptingDonations(campaign, new Date("2026-11-09T21:59:00Z"))).toBe(false);
    expect(isAcceptingDonations(campaign, new Date("2026-11-09T22:01:00Z"))).toBe(true);
  });

  it("stays open for the whole end date and closes after it", () => {
    expect(isAcceptingDonations(campaign, new Date("2026-11-20T21:59:00Z"))).toBe(true); // 23:59 SAST
    expect(isAcceptingDonations(campaign, new Date("2026-11-20T22:01:00Z"))).toBe(false); // 00:01 next day
  });

  it("never accepts donations for draft or closed campaigns, even within the dates", () => {
    const mid = new Date("2026-11-15T10:00:00Z");
    expect(isAcceptingDonations({ ...campaign, status: "DRAFT" }, mid)).toBe(false);
    expect(isAcceptingDonations({ ...campaign, status: "CLOSED" }, mid)).toBe(false);
  });
});

describe("notAcceptingReason", () => {
  it("explains why", () => {
    const mid = new Date("2026-11-15T10:00:00Z");
    expect(notAcceptingReason(campaign, mid)).toBeNull();
    expect(notAcceptingReason({ ...campaign, status: "DRAFT" }, mid)).toMatch(/not launched/);
    expect(notAcceptingReason(campaign, new Date("2026-11-25T10:00:00Z"))).toMatch(/closed/);
    expect(notAcceptingReason(campaign, new Date("2026-11-01T10:00:00Z"))).toMatch(/not started/);
  });
});

describe("campaignScopeFor", () => {
  const user = (role: CurrentUser["role"]): CurrentUser => ({
    id: "user_1",
    email: "user@example.test",
    name: "User",
    role,
    emailVerified: true,
  });

  it("lets the super admin see every campaign", () => {
    expect(campaignScopeFor(user("SUPER_ADMIN"))).toEqual({});
  });

  it("limits a campaign manager to their own campaigns", () => {
    expect(campaignScopeFor(user("CAMPAIGN_MANAGER"))).toEqual({ managerId: "user_1" });
  });

  it("gives a donor no staff access to any campaign (a filter that matches no row)", () => {
    expect(campaignScopeFor(user("DONOR"))).toEqual({ id: "__none__" });
  });
});

describe("slugify", () => {
  it("makes URL-safe slugs", () => {
    expect(slugify("KZN Flood Relief 2026!")).toBe("kzn-flood-relief-2026");
    expect(slugify("Café & Crèche")).toBe("cafe-creche");
    expect(slugify("!!!")).toBe("");
  });
});

describe("campaignAvailability", () => {
  // 12:00 Johannesburg on 15 June 2026.
  const now = new Date("2026-06-15T10:00:00Z");
  const campaign = (status: "DRAFT" | "ACTIVE" | "CLOSED", start: string, end: string) => ({
    status,
    startDate: new Date(`${start}T00:00:00Z`),
    endDate: new Date(`${end}T00:00:00Z`),
  });

  it("is open while ACTIVE and today is within the dates (both days included)", () => {
    expect(campaignAvailability(campaign("ACTIVE", "2026-06-01", "2026-06-30"), now)).toBe("open");
    expect(campaignAvailability(campaign("ACTIVE", "2026-06-15", "2026-06-15"), now)).toBe("open");
  });

  it("is upcoming, not closed, when an ACTIVE campaign starts in the future", () => {
    expect(campaignAvailability(campaign("ACTIVE", "2026-06-16", "2026-07-31"), now)).toBe("upcoming");
  });

  it("is closed when CLOSED or past its end date", () => {
    expect(campaignAvailability(campaign("CLOSED", "2026-06-01", "2026-06-30"), now)).toBe("closed");
    expect(campaignAvailability(campaign("ACTIVE", "2026-05-01", "2026-06-14"), now)).toBe("closed");
  });

  it("is draft for a DRAFT campaign, even within its dates", () => {
    expect(campaignAvailability(campaign("DRAFT", "2026-06-01", "2026-06-30"), now)).toBe("draft");
  });
});

describe("pickFeatured", () => {
  const now = new Date("2026-11-15T10:00:00Z");
  const make = (name: string, status: "DRAFT" | "ACTIVE" | "CLOSED", start: string, end: string) => ({
    name,
    status,
    startDate: day(start),
    endDate: day(end),
  });

  it("only features campaigns open for donations now", () => {
    const picked = pickFeatured(
      [
        make("Open", "ACTIVE", "2026-11-01", "2026-12-01"),
        make("Draft", "DRAFT", "2026-11-01", "2026-12-01"),
        make("Closed", "CLOSED", "2026-11-01", "2026-12-01"),
        make("Ended", "ACTIVE", "2026-10-01", "2026-11-10"),
        make("Upcoming", "ACTIVE", "2026-12-01", "2026-12-31"),
      ],
      now,
    );
    expect(picked.map((c) => c.name)).toEqual(["Open"]);
  });

  it("puts the campaigns ending soonest first and shows at most three", () => {
    const picked = pickFeatured(
      [
        make("Late", "ACTIVE", "2026-11-01", "2027-01-31"),
        make("Soon", "ACTIVE", "2026-11-01", "2026-11-20"),
        make("Middle B", "ACTIVE", "2026-11-01", "2026-12-15"),
        make("Middle A", "ACTIVE", "2026-11-01", "2026-12-15"),
      ],
      now,
    );
    expect(picked).toHaveLength(FEATURED_COUNT);
    // Same end date: alphabetical, so the order is stable.
    expect(picked.map((c) => c.name)).toEqual(["Soon", "Middle A", "Middle B"]);
  });

  it("returns nothing when no campaign is open", () => {
    expect(pickFeatured([make("Closed", "CLOSED", "2026-11-01", "2026-12-01")], now)).toEqual([]);
  });

  it("doesn't reorder the caller's array", () => {
    const input = [
      make("Late", "ACTIVE", "2026-11-01", "2027-01-31"),
      make("Middle", "ACTIVE", "2026-11-01", "2026-12-15"),
      make("Soon", "ACTIVE", "2026-11-01", "2026-11-20"),
    ];
    expect(pickFeatured(input, now).map((c) => c.name)).toEqual(["Soon", "Middle", "Late"]);
    expect(input.map((c) => c.name)).toEqual(["Late", "Middle", "Soon"]);
  });
});

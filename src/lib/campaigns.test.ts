import { describe, expect, it } from "vitest";
import type { CurrentUser } from "./auth";
import { campaignScopeFor, isAcceptingDonations, notAcceptingReason, slugify, todayIso } from "./campaigns";

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

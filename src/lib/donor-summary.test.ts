import { describe, expect, it } from "vitest";
import {
  REVEAL_DATA,
  donorStatusLabel,
  revealWhere,
  summarizeGiving,
  visibleDonations,
  type DonorDonationRow,
} from "./donor-summary";

const food = { id: "c1", name: "Winter Food Parcels", slug: "food", targetCents: 1_000_000, impactAmountCents: 50_000, impactLabel: "family fed" };
const shoes = { id: "c2", name: "School Shoes", slug: "shoes", targetCents: 500_000, impactAmountCents: 35_000, impactLabel: "child given shoes" };

let seq = 0;
const row = (over: Partial<DonorDonationRow>): DonorDonationRow => ({
  id: `d${++seq}`,
  amountCents: 10_000,
  status: "SUCCEEDED",
  isAnonymous: false,
  donorName: "Test Donor",
  createdAt: new Date("2026-11-01T08:00:00Z"),
  paidAt: new Date("2026-11-01T08:01:00Z"),
  hasCheckout: true,
  campaign: food,
  ...over,
});

describe("visibleDonations", () => {
  it("hides attempts that never reached Stripe, and shows everything else", () => {
    const rows = [
      row({ status: "SUCCEEDED" }),
      row({ status: "PENDING", hasCheckout: true }), // processing: shown
      row({ status: "PENDING", hasCheckout: false }), // never reached Stripe: hidden
      row({ status: "FAILED" }),
      row({ status: "EXPIRED" }),
    ];
    expect(visibleDonations(rows).map((r) => r.status)).toEqual(["SUCCEEDED", "PENDING", "FAILED", "EXPIRED"]);
  });
});

describe("summarizeGiving", () => {
  it("counts only paid gifts in totals and impact", () => {
    const s = summarizeGiving([
      row({ amountCents: 50_000 }),
      row({ amountCents: 99_999, status: "FAILED" }),
      row({ amountCents: 99_999, status: "PENDING" }),
      row({ amountCents: 99_999, status: "EXPIRED" }),
    ]);
    expect(s.totalGivenCents).toBe(50_000);
    expect(s.paidGifts).toBe(1);
    expect(s.campaigns).toHaveLength(1);
  });

  it("works out impact per campaign from the campaign total (R300 + R200 = 1 family at R500)", () => {
    const s = summarizeGiving([
      row({ amountCents: 30_000 }),
      row({ amountCents: 20_000 }),
      row({ amountCents: 70_000, campaign: shoes }),
    ]);
    expect(s.totalGivenCents).toBe(120_000);
    const byId = Object.fromEntries(s.campaigns.map((c) => [c.campaignId, c]));
    expect(byId.c1).toMatchObject({ givenCents: 50_000, impactUnits: 1, impactLabel: "family fed" });
    expect(byId.c2).toMatchObject({ givenCents: 70_000, impactUnits: 2, impactLabel: "child given shoes" });
    // Biggest support first.
    expect(s.campaigns.map((c) => c.campaignId)).toEqual(["c2", "c1"]);
  });

  it("includes the donor's anonymous gifts: they see their own gifts under their real identity", () => {
    const s = summarizeGiving([row({ amountCents: 10_000 }), row({ amountCents: 20_000, isAnonymous: true })]);
    expect(s.totalGivenCents).toBe(30_000);
  });

  it("returns zeros for a donor with no paid gifts", () => {
    expect(summarizeGiving([])).toEqual({ totalGivenCents: 0, paidGifts: 0, campaigns: [] });
  });
});

describe("donorStatusLabel", () => {
  it("tells the donor plainly whether they were charged", () => {
    expect(donorStatusLabel({ status: "SUCCEEDED" })).toBe("Paid");
    expect(donorStatusLabel({ status: "PENDING" })).toBe("Processing");
    expect(donorStatusLabel({ status: "FAILED" })).toContain("not charged");
    expect(donorStatusLabel({ status: "EXPIRED" })).toContain("not charged");
  });
});

describe("revealing a name is one-way and only on your own anonymous gifts", () => {
  it("matches only a PAID gift that is still anonymous AND belongs to this donor's account", () => {
    expect(revealWhere("don_1", "user_1")).toEqual({
      id: "don_1",
      status: "SUCCEEDED",
      isAnonymous: true,
      donor: { userId: "user_1" },
    });
  });

  it("can only ever set the gift to named, never to anonymous", () => {
    expect(REVEAL_DATA).toEqual({ isAnonymous: false });
  });
});

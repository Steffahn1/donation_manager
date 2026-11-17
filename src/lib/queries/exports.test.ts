import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/lib/auth";
import type { DateRange } from "@/lib/csv";

/**
 * The CSV export queries, with the database mocked: the staff export must leave only masked rows,
 * scoped to the user's campaigns; the donor export must only ever read the logged-in donor's own gifts.
 */
const db = vi.hoisted(() => ({
  donation: { findMany: vi.fn() },
  donor: { findUnique: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ db }));

const { staffExportDonations } = await import("./staff");
const { donorExportDonations } = await import("./donor");

const range: DateRange = {
  from: "2026-01-01",
  to: "2026-01-31",
  start: new Date("2025-12-31T22:00:00Z"),
  end: new Date("2026-01-31T22:00:00Z"),
};

const user = (over: Partial<CurrentUser>): CurrentUser => ({
  id: "u1",
  email: "someone@example.test",
  name: "Someone",
  role: "DONOR",
  emailVerified: true,
  ...over,
});

const row = (over: Record<string, unknown>) => ({
  id: "d1",
  amountCents: 50000,
  status: "SUCCEEDED",
  isAnonymous: false,
  failureReason: null,
  createdAt: new Date("2026-01-10T08:00:00Z"),
  paidAt: new Date("2026-01-10T08:01:00Z"),
  donorName: "Jane Example",
  campaign: { id: "c1", name: "Winter Food Parcels" },
  donor: { id: "donor1", email: "jane@example.test" },
  ...over,
});

beforeEach(() => {
  db.donation.findMany.mockReset();
  db.donor.findUnique.mockReset();
});

describe("staffExportDonations", () => {
  it("masks anonymous donors before the rows leave the query", async () => {
    db.donation.findMany.mockResolvedValue([row({}), row({ id: "d2", isAnonymous: true })]);
    const rows = await staffExportDonations(user({ role: "SUPER_ADMIN" }), range);

    expect(rows[0]).toMatchObject({ donorName: "Jane Example", donorEmail: "jane@example.test" });
    expect(rows[1]).toMatchObject({ donorName: "Anonymous", donorEmail: null, isAnonymous: true });
    expect(JSON.stringify(rows[1])).not.toContain("jane@example.test");
  });

  it("asks only for paid donations in the range, scoped to a manager's own campaigns", async () => {
    db.donation.findMany.mockResolvedValue([]);
    await staffExportDonations(user({ id: "cm1", role: "CAMPAIGN_MANAGER" }), range, "c9");

    const where = db.donation.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({
      status: "SUCCEEDED",
      paidAt: { gte: range.start, lt: range.end },
      campaign: { managerId: "cm1" },
      campaignId: "c9",
    });
  });
});

describe("donorExportDonations", () => {
  it("returns nothing for staff or an unconfirmed account, without touching the database", async () => {
    expect(await donorExportDonations(user({ role: "CAMPAIGN_MANAGER" }), range)).toEqual([]);
    expect(await donorExportDonations(user({ emailVerified: false }), range)).toEqual([]);
    expect(db.donor.findUnique).not.toHaveBeenCalled();
    expect(db.donation.findMany).not.toHaveBeenCalled();
  });

  it("returns nothing when the account has no donor record", async () => {
    db.donor.findUnique.mockResolvedValue(null);
    expect(await donorExportDonations(user({}), range)).toEqual([]);
    expect(db.donation.findMany).not.toHaveBeenCalled();
  });

  it("reads only the logged-in user's own donor record, paid donations in the range", async () => {
    db.donor.findUnique.mockResolvedValue({ id: "donor1" });
    db.donation.findMany.mockResolvedValue([]);
    await donorExportDonations(user({ id: "u7" }), range);

    expect(db.donor.findUnique.mock.calls[0][0].where).toEqual({ userId: "u7" });
    expect(db.donation.findMany.mock.calls[0][0].where).toEqual({
      status: "SUCCEEDED",
      paidAt: { gte: range.start, lt: range.end },
      donorId: "donor1",
    });
  });
});

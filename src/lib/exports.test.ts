import { describe, expect, it } from "vitest";
import type { CurrentUser } from "./auth";
import type { DateRange } from "./csv";
import { parseDateRange, toCsv } from "./csv";
import { STAFF_HEADER, campaignParam, donorExportWhere, donorRows, staffExportWhere, staffRows } from "./exports";
import { toStaffDonation, type StaffDonationRow } from "./privacy";

const NOW = new Date("2026-11-15T10:00:00Z");
const range = parseDateRange("2026-11-01", "2026-11-14", NOW) as DateRange;

type Row = StaffDonationRow & { campaignManagerId: string; donorId: string };
let seq = 0;
const row = (over: Partial<Row> & { campaignId?: string }): Row => {
  const campaignId = over.campaignId ?? "c_thandi";
  return {
    id: `don${++seq}`,
    amountCents: 10000,
    status: "SUCCEEDED",
    isAnonymous: false,
    failureReason: null,
    createdAt: new Date("2026-11-05T08:00:00Z"),
    paidAt: new Date("2026-11-05T08:01:00Z"),
    donorName: "Named Donor",
    campaign: { id: campaignId, name: campaignId === "c_thandi" ? "Winter Food" : "Water Tanks" },
    donor: { id: "donor_1", email: "named@example.test" },
    campaignManagerId: campaignId === "c_thandi" ? "u_thandi" : "u_johan",
    donorId: "donor_1",
    ...over,
  };
};

/**
 * Applies a Prisma-style export filter to rows, the way the database would. STRICT: any key or shape
 * it doesn't understand throws, so if the real filter changes shape these tests fail instead of
 * silently ignoring the new condition.
 */
function query(rows: Row[], where: Record<string, unknown>) {
  const known = new Set(["status", "paidAt", "donorId", "campaignId", "campaign"]);
  for (const key of Object.keys(where)) if (!known.has(key)) throw new Error(`query(): unknown filter key ${key}`);
  const paidAt = where.paidAt as Record<string, unknown>;
  if (Object.keys(paidAt).sort().join() !== "gte,lt") throw new Error("query(): paidAt must be exactly { gte, lt }");
  const scope = where.campaign as Record<string, unknown> | undefined;
  if (scope) {
    for (const key of Object.keys(scope)) {
      if (key !== "managerId" && key !== "id") throw new Error(`query(): unknown campaign filter ${key}`);
      if (typeof scope[key] !== "string") throw new Error(`query(): campaign.${key} must be a string`);
    }
  }
  return rows.filter((r) => {
    if (r.status !== where.status || !r.paidAt) return false;
    if (r.paidAt < (paidAt.gte as Date) || r.paidAt >= (paidAt.lt as Date)) return false;
    if ("donorId" in where && r.donorId !== where.donorId) return false;
    if ("campaignId" in where && r.campaign.id !== where.campaignId) return false;
    if (scope?.managerId !== undefined && r.campaignManagerId !== scope.managerId) return false;
    if (scope?.id !== undefined && r.campaign.id !== scope.id) return false;
    return true;
  });
}

describe("query() test helper", () => {
  it("refuses filter shapes it doesn't understand", () => {
    expect(() => query(data, { status: "SUCCEEDED", paidAt: { gte: range.start, lt: range.end }, extra: 1 })).toThrow();
    expect(() =>
      query(data, { status: "SUCCEEDED", paidAt: { gte: range.start, lt: range.end }, campaign: { is: { managerId: "x" } } }),
    ).toThrow();
  });
});

const user = (id: string, role: CurrentUser["role"]): CurrentUser => ({ id, role, email: `${id}@x.test`, name: id, emailVerified: true });
const admin = user("u_admin", "SUPER_ADMIN");
const thandi = user("u_thandi", "CAMPAIGN_MANAGER");
const donorUser = user("u_donor", "DONOR");

const data: Row[] = [
  row({ campaignId: "c_thandi" }),
  row({ campaignId: "c_johan" }),
  row({ campaignId: "c_thandi", status: "FAILED", paidAt: null }),
  row({ campaignId: "c_thandi", status: "PENDING", paidAt: null }),
  row({ campaignId: "c_thandi", paidAt: new Date("2026-10-31T21:59:00Z") }), // 31 Oct 23:59 SAST: before range
  row({ campaignId: "c_thandi", paidAt: new Date("2026-10-31T22:00:00Z") }), // 1 Nov 00:00 SAST: first moment
  row({ campaignId: "c_thandi", paidAt: new Date("2026-11-14T21:59:00Z") }), // 14 Nov 23:59 SAST: last moment
  row({ campaignId: "c_thandi", paidAt: new Date("2026-11-14T22:00:00Z") }), // 15 Nov 00:00 SAST: after range
  row({ campaignId: "c_thandi", isAnonymous: true, donorName: "Secret Person", donor: { id: "donor_2", email: "secret@example.test" }, donorId: "donor_2" }),
];

describe("staff exports: which rows each role gets", () => {
  it("contains paid donations only, within the Johannesburg date range (both days included)", () => {
    const got = query(data, staffExportWhere(admin, range));
    expect(got.every((r) => r.status === "SUCCEEDED")).toBe(true);
    expect(got.map((r) => r.paidAt!.toISOString())).toContain("2026-10-31T22:00:00.000Z");
    expect(got.map((r) => r.paidAt!.toISOString())).toContain("2026-11-14T21:59:00.000Z");
    expect(got.map((r) => r.paidAt!.toISOString())).not.toContain("2026-10-31T21:59:00.000Z");
    expect(got.map((r) => r.paidAt!.toISOString())).not.toContain("2026-11-14T22:00:00.000Z");
  });

  it("gives the super admin every campaign", () => {
    expect(new Set(query(data, staffExportWhere(admin, range)).map((r) => r.campaign.id))).toEqual(new Set(["c_thandi", "c_johan"]));
  });

  it("gives a campaign manager only their own campaigns", () => {
    expect(new Set(query(data, staffExportWhere(thandi, range)).map((r) => r.campaign.id))).toEqual(new Set(["c_thandi"]));
  });

  it("gives a campaign manager an EMPTY file for another manager's campaign (doesn't reveal it exists)", () => {
    expect(query(data, staffExportWhere(thandi, range, "c_johan"))).toEqual([]);
  });

  it("gives a donor nothing through the staff filter, even if a route forgot its role check", () => {
    expect(query(data, staffExportWhere(donorUser, range))).toEqual([]);
  });
});

describe("staff export rows", () => {
  it("mask anonymous donors: no name or email anywhere in the CSV", () => {
    const csv = toCsv(STAFF_HEADER, staffRows(query(data, staffExportWhere(admin, range)).map(toStaffDonation)));
    expect(csv).not.toContain("Secret Person");
    expect(csv).not.toContain("secret@example.test");
    expect(csv).toContain("Anonymous,,yes");
    expect(csv).toContain("Named Donor,named@example.test,no");
  });

  it("show the paid time in Johannesburg and the amount in rand", () => {
    const [r] = staffRows([toStaffDonation(row({}))]);
    expect(r.slice(0, 3)).toEqual(["2026-11-05 10:01", "Winter Food", "100.00"]);
  });
});

describe("donor exports", () => {
  it("contain only this donor's paid donations in the range", () => {
    const got = query(data, donorExportWhere("donor_2", range));
    expect(got.map((r) => r.donorId)).toEqual(["donor_2"]);
  });

  it("show how each gift appears to the charity", () => {
    const rows = donorRows([
      { paidAt: new Date("2026-11-05T08:01:00Z"), createdAt: new Date(), amountCents: 5000, isAnonymous: true, donorName: "Me", campaign: { name: "Winter Food" } },
      { paidAt: new Date("2026-11-06T08:01:00Z"), createdAt: new Date(), amountCents: 7000, isAnonymous: false, donorName: "Me", campaign: { name: "Winter Food" } },
    ]);
    expect(rows.map((r) => r[3])).toEqual(["Anonymous", "Me"]);
  });
});

describe("campaignParam", () => {
  it("accepts a campaign id or nothing, and rejects anything else", () => {
    expect(campaignParam(null)).toBeUndefined();
    expect(campaignParam("")).toBeUndefined();
    expect(campaignParam("cmwfql6tx00033nsb5v470nre")).toBe("cmwfql6tx00033nsb5v470nre");
    expect(campaignParam("x' OR 1=1")).toBeNull();
  });
});

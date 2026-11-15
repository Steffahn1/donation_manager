import { describe, expect, it } from "vitest";
import { todayIso } from "./campaigns";
import { computeMetrics, groupByCampaign, longTermSeries, sastDate, sastWeekStart, weeklySeries, type MetricDonation } from "./metrics";

// Thursday 12 Nov 2026, 10:00 Johannesburg (08:00 UTC). This week starts Mon 9 Nov 00:00 SAST.
const NOW = new Date("2026-11-12T08:00:00Z");
const at = (iso: string) => new Date(iso);

let seq = 0;
const gift = (over: Partial<MetricDonation> & { paidAt: Date | null }): MetricDonation => ({
  id: `don_${++seq}`,
  donorId: "d1",
  isAnonymous: false,
  campaignId: "c1",
  amountCents: 10000,
  status: "SUCCEEDED",
  ...over,
});

describe("Johannesburg dates", () => {
  it("matches todayIso and rolls over at midnight SAST, not UTC", () => {
    for (const iso of ["2026-11-09T21:59:00Z", "2026-11-09T22:01:00Z", "2026-11-12T08:00:00Z"]) {
      expect(sastDate(at(iso))).toBe(todayIso(at(iso)));
    }
  });

  it("starts the week on Monday 00:00 SAST", () => {
    expect(sastWeekStart(NOW).toISOString()).toBe("2026-11-08T22:00:00.000Z");
    // Sunday 23:30 SAST still belongs to the previous week; Monday 00:30 to the new one.
    expect(sastWeekStart(at("2026-11-08T21:30:00Z")).toISOString()).toBe("2026-11-01T22:00:00.000Z");
    expect(sastWeekStart(at("2026-11-08T22:30:00Z")).toISOString()).toBe("2026-11-08T22:00:00.000Z");
  });
});

describe("computeMetrics: what counts", () => {
  it("counts only SUCCEEDED donations; FAILED, PENDING and EXPIRED never add to any number", () => {
    const m = computeMetrics(
      [
        gift({ paidAt: at("2026-11-11T08:00:00Z"), amountCents: 50000 }),
        gift({ donorId: "d2", status: "FAILED", paidAt: null, amountCents: 99999 }),
        gift({ donorId: "d3", status: "PENDING", paidAt: null, amountCents: 99999 }),
        gift({ donorId: "d4", status: "EXPIRED", paidAt: null, amountCents: 99999 }),
        // Defensive: even a non-succeeded row that somehow has paidAt is ignored.
        gift({ donorId: "d5", status: "FAILED", paidAt: at("2026-11-11T08:00:00Z"), amountCents: 99999 }),
      ],
      NOW,
    );
    expect(m.raisedCents).toBe(50000);
    expect(m.donationCount).toBe(1);
    expect(m.uniqueDonors).toBe(1);
    expect(m.thisWeek).toMatchObject({ raisedCents: 50000, donationCount: 1, newDonors: 1, returningDonors: 0 });
    expect(m.daily.reduce((s, d) => s + d.raisedCents, 0)).toBe(50000);
  });

  it("counts a donor once however many times they gave", () => {
    const m = computeMetrics(
      [gift({ paidAt: at("2026-10-01T08:00:00Z") }), gift({ paidAt: at("2026-11-11T08:00:00Z") })],
      NOW,
    );
    expect(m.donationCount).toBe(2);
    expect(m.uniqueDonors).toBe(1);
    expect(m.repeatDonors).toBe(1);
  });

  it("returns zeros, not NaN, for a campaign with no donations", () => {
    const m = computeMetrics([], NOW);
    expect(m).toMatchObject({ raisedCents: 0, donationCount: 0, uniqueDonors: 0, repeatDonors: 0 });
    expect(m.daily).toHaveLength(28);
    expect(m.daily.every((d) => d.raisedCents === 0 && d.cumulativeCents === 0)).toBe(true);
  });
});

describe("computeMetrics: anonymous gifts can't be linked to a donor through the numbers", () => {
  it("counts each anonymous gift as its own donor, never merged with the same donor's named gifts", () => {
    // Staff see "Jane R100" and "Anonymous R500". With real-id counting they'd read
    // "1 unique donor, 1 gave more than once" and know Jane gave the R500.
    const m = computeMetrics(
      [
        gift({ donorId: "jane", paidAt: at("2026-10-01T08:00:00Z"), amountCents: 10000 }),
        gift({ donorId: "jane", isAnonymous: true, paidAt: at("2026-10-02T08:00:00Z"), amountCents: 50000 }),
      ],
      NOW,
    );
    expect(m.uniqueDonors).toBe(2);
    expect(m.repeatDonors).toBe(0);
    expect(m.raisedCents).toBe(60000); // money is unaffected
  });

  it("never makes a named gift 'returning' because of an earlier anonymous gift", () => {
    const m = computeMetrics(
      [
        gift({ donorId: "jane", isAnonymous: true, paidAt: at("2026-10-01T08:00:00Z") }),
        gift({ donorId: "jane", paidAt: at("2026-11-11T08:00:00Z") }),
      ],
      NOW,
    );
    expect(m.thisWeek).toMatchObject({ newDonors: 1, returningDonors: 0 });
  });

  it("counts two anonymous gifts as two donors, even from the same person", () => {
    const m = computeMetrics(
      [
        gift({ donorId: "jane", isAnonymous: true, paidAt: at("2026-11-10T08:00:00Z") }),
        gift({ donorId: "jane", isAnonymous: true, paidAt: at("2026-11-11T08:00:00Z") }),
      ],
      NOW,
    );
    expect(m.uniqueDonors).toBe(2);
    expect(m.repeatDonors).toBe(0);
    expect(m.thisWeek).toMatchObject({ newDonors: 2, returningDonors: 0 });
  });
});

describe("computeMetrics: this week vs last week, new vs returning", () => {
  it("splits weeks at Monday 00:00 Johannesburg time", () => {
    const m = computeMetrics(
      [
        gift({ paidAt: at("2026-11-08T21:59:00Z"), amountCents: 100 }), // Sun 8 Nov 23:59 SAST: last week
        gift({ paidAt: at("2026-11-08T22:00:00Z"), amountCents: 200 }), // Mon 9 Nov 00:00 SAST: this week
        gift({ paidAt: at("2026-11-01T21:59:00Z"), amountCents: 400 }), // Sun 1 Nov: two weeks ago
      ],
      NOW,
    );
    expect(m.thisWeek.raisedCents).toBe(200);
    expect(m.lastWeek.raisedCents).toBe(100);
    expect(m.raisedCents).toBe(700);
  });

  it("calls a donor returning only if they gave to THIS campaign before this week", () => {
    const rows = [
      // d1: gave to c1 last month and again this week -> returning
      gift({ donorId: "d1", paidAt: at("2026-10-01T08:00:00Z") }),
      gift({ donorId: "d1", paidAt: at("2026-11-11T08:00:00Z") }),
      // d2: gave to c2 before, first gift to c1 this week -> new for c1
      gift({ donorId: "d2", campaignId: "c2", paidAt: at("2026-10-01T08:00:00Z") }),
      gift({ donorId: "d2", paidAt: at("2026-11-11T08:00:00Z") }),
      // d3: two gifts this week, first ever -> new (counted once)
      gift({ donorId: "d3", paidAt: at("2026-11-10T08:00:00Z") }),
      gift({ donorId: "d3", paidAt: at("2026-11-11T08:00:00Z") }),
    ];
    const c1 = computeMetrics(groupByCampaign(rows).get("c1")!, NOW);
    expect(c1.thisWeek).toMatchObject({ newDonors: 2, returningDonors: 1, donationCount: 4 });
  });

  it("uses the same per-campaign rule across all campaigns, counting each donor once", () => {
    const rows = [
      gift({ donorId: "d2", campaignId: "c2", paidAt: at("2026-10-01T08:00:00Z") }),
      gift({ donorId: "d2", campaignId: "c1", paidAt: at("2026-11-11T08:00:00Z") }), // new for c1
      gift({ donorId: "d2", campaignId: "c2", paidAt: at("2026-11-11T09:00:00Z") }), // returning for c2
    ];
    const all = computeMetrics(rows, NOW);
    expect(all.thisWeek).toMatchObject({ newDonors: 0, returningDonors: 1 });
    expect(all.uniqueDonors).toBe(1);
  });

  it("only counts a repeat donor for gifts to the SAME campaign", () => {
    const m = computeMetrics(
      [
        gift({ donorId: "d1", campaignId: "c1", paidAt: at("2026-10-01T08:00:00Z") }),
        gift({ donorId: "d1", campaignId: "c2", paidAt: at("2026-10-02T08:00:00Z") }),
      ],
      NOW,
    );
    expect(m.uniqueDonors).toBe(1);
    expect(m.repeatDonors).toBe(0);
  });

  it("ignores gifts dated after `now`", () => {
    const m = computeMetrics([gift({ paidAt: at("2026-11-13T08:00:00Z") })], NOW);
    expect(m.raisedCents).toBe(0);
  });
});

describe("computeMetrics: daily series", () => {
  it("has one entry per Johannesburg day, oldest first, with a running total that includes earlier gifts", () => {
    const m = computeMetrics(
      [
        gift({ paidAt: at("2026-09-01T08:00:00Z"), amountCents: 1000 }), // before the window
        gift({ paidAt: at("2026-11-10T21:59:00Z"), amountCents: 200 }), // 23:59 SAST -> 2026-11-10
        gift({ paidAt: at("2026-11-10T22:01:00Z"), amountCents: 300 }), // 00:01 SAST -> 2026-11-11
      ],
      NOW,
      { days: 3 },
    );
    expect(m.daily).toEqual([
      { date: "2026-11-10", raisedCents: 200, cumulativeCents: 1200 },
      { date: "2026-11-11", raisedCents: 300, cumulativeCents: 1500 },
      { date: "2026-11-12", raisedCents: 0, cumulativeCents: 1500 },
    ]);
  });
});

describe("groupByCampaign", () => {
  it("keeps every row, in order, under its campaign", () => {
    const rows = [
      { campaignId: "c1", n: 1 },
      { campaignId: "c2", n: 2 },
      { campaignId: "c1", n: 3 },
    ];
    const g = groupByCampaign(rows);
    expect(g.get("c1")).toEqual([rows[0], rows[2]]);
    expect(g.get("c2")).toEqual([rows[1]]);
  });

  it("handles many rows in linear time", () => {
    const rows = Array.from({ length: 50_000 }, (_, i) => ({ campaignId: "c1", n: i }));
    const started = performance.now();
    expect(groupByCampaign(rows).get("c1")).toHaveLength(50_000);
    expect(performance.now() - started).toBeLessThan(1000); // the old copy-per-row version took far longer
  });
});

describe("longTermSeries", () => {
  it("covers every day from the campaign start to today, with a running total", () => {
    const s = longTermSeries(
      [gift({ paidAt: at("2026-11-10T08:00:00Z"), amountCents: 300 }), gift({ paidAt: at("2026-11-12T07:00:00Z"), amountCents: 200 })],
      at("2026-11-08T22:00:00Z"), // campaign starts Mon 9 Nov (SAST)
      NOW,
    );
    expect(s.map((d) => d.date)).toEqual(["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12"]);
    expect(s.map((d) => d.raisedCents)).toEqual([0, 300, 0, 200]);
    expect(s.at(-1)!.cumulativeCents).toBe(500);
  });

  it("starts at the first gift if that is before the campaign start, and counts only paid gifts", () => {
    const s = longTermSeries(
      [
        gift({ paidAt: at("2026-11-07T08:00:00Z"), amountCents: 100 }),
        gift({ donorId: "d9", status: "FAILED", paidAt: null, amountCents: 999 }),
      ],
      at("2026-11-09T22:00:00Z"),
      NOW,
    );
    expect(s[0].date).toBe("2026-11-07");
    expect(s.at(-1)!.cumulativeCents).toBe(100);
  });

  it("ends at the campaign's last day once it has passed (no tail of empty days after closing)", () => {
    const s = longTermSeries(
      [gift({ paidAt: at("2026-11-02T08:00:00Z"), amountCents: 300 })],
      at("2026-10-31T22:00:00Z"), // starts 1 Nov SAST
      NOW, // 12 Nov
      "2026-11-03", // ended 3 Nov
    );
    expect(s.map((d) => d.date)).toEqual(["2026-11-01", "2026-11-02", "2026-11-03"]);
    expect(s.at(-1)!.cumulativeCents).toBe(300);
  });

  it("counts a payment completed after the last day on the last day, so the total matches 'Raised'", () => {
    // Confirmed at 23:50 on the last day (3 Nov), paid by Stripe at 00:10 SAST on 4 Nov.
    const rows = [
      gift({ paidAt: at("2026-11-02T08:00:00Z"), amountCents: 300 }),
      gift({ paidAt: at("2026-11-03T22:10:00Z"), amountCents: 200 }),
    ];
    const s = longTermSeries(rows, at("2026-10-31T22:00:00Z"), NOW, "2026-11-03");
    expect(s.at(-1)).toEqual({ date: "2026-11-03", raisedCents: 200, cumulativeCents: 500 });
    expect(s.at(-1)!.cumulativeCents).toBe(computeMetrics(rows, NOW).raisedCents);
  });

  it("puts the end of the last day at 23:59:59.999 Johannesburg time", () => {
    const rows = [
      gift({ paidAt: at("2026-11-02T21:59:00Z"), amountCents: 1 }), // 2 Nov 23:59 SAST: day before
      gift({ paidAt: at("2026-11-02T22:00:00Z"), amountCents: 10 }), // 3 Nov 00:00 SAST: last day
      gift({ paidAt: at("2026-11-03T21:59:59.999Z"), amountCents: 100 }), // 3 Nov 23:59:59.999: last day
      gift({ paidAt: at("2026-11-03T22:00:00Z"), amountCents: 1000 }), // 4 Nov 00:00: late, counted on last day
    ];
    const s = longTermSeries(rows, at("2026-10-31T22:00:00Z"), NOW, "2026-11-03");
    expect(s.map((d) => d.date)).toEqual(["2026-11-01", "2026-11-02", "2026-11-03"]);
    expect(s.map((d) => d.raisedCents)).toEqual([0, 1, 1110]);
    expect(s.at(-1)!.cumulativeCents).toBe(computeMetrics(rows, NOW).raisedCents);
  });

  it("still runs to today while the campaign's last day is in the future", () => {
    const s = longTermSeries([], at("2026-11-09T22:00:00Z"), NOW, "2026-12-31");
    expect(s.at(-1)!.date).toBe("2026-11-12");
  });

  it("is a single day for a campaign with no gifts that starts today", () => {
    expect(longTermSeries([], NOW, NOW)).toEqual([{ date: "2026-11-12", raisedCents: 0, cumulativeCents: 0 }]);
  });
});

describe("weeklySeries", () => {
  it("totals Monday–Sunday Johannesburg weeks, oldest first, marking this week as in progress", () => {
    const w = weeklySeries(
      [
        gift({ paidAt: at("2026-11-08T21:59:00Z"), amountCents: 100 }), // Sun 8 Nov 23:59: previous week
        gift({ paidAt: at("2026-11-08T22:00:00Z"), amountCents: 200 }), // Mon 9 Nov 00:00: this week
        gift({ paidAt: at("2026-11-11T08:00:00Z"), amountCents: 300 }),
        gift({ donorId: "d9", status: "PENDING", paidAt: null, amountCents: 999 }),
      ],
      NOW,
      3,
    );
    expect(w).toEqual([
      { weekStart: "2026-10-26", raisedCents: 0, donationCount: 0, current: false },
      { weekStart: "2026-11-02", raisedCents: 100, donationCount: 1, current: false },
      { weekStart: "2026-11-09", raisedCents: 500, donationCount: 2, current: true },
    ]);
  });

  it("defaults to 8 weeks", () => {
    expect(weeklySeries([], NOW)).toHaveLength(8);
  });
});

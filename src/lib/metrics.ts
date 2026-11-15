import type { DonationStatus } from "@/generated/prisma/client";

/**
 * Dashboard metrics, computed from donation rows. Pure functions (no database), so the rules are
 * unit tested in metrics.test.ts and the same numbers feed the CM dashboard, the super admin
 * dashboard and (Day 5) the CSV exports and pacing chart.
 *
 * Rules:
 * - Only SUCCEEDED donations with a paidAt count. Anything else passed in is ignored, so a caller
 *   that forgets to filter can never inflate a total.
 * - Donors are counted by donor id, EXCEPT that each anonymous gift counts as its own one-off donor.
 *   Anonymity is per gift, so counting anonymous gifts under the real donor would let staff link them
 *   to that donor's named gifts (e.g. "1 unique donor" next to "Jane R100" and "Anonymous R500").
 *   Trade-off: unique donors can be slightly high and repeat/returning slightly low.
 * - "Returning" means the donor gave to the SAME campaign before (CLAUDE.md / docs/PLAN.md).
 * - Days and weeks are in Johannesburg time (UTC+2, no daylight saving); weeks start on Monday.
 *
 * Scale note: the rows are loaded into memory. Fine for a small charity (thousands of donations);
 * move the aggregation into SQL if volumes grow far beyond that.
 */

export type MetricDonation = {
  /** The donation id: the donor key for an anonymous gift. */
  id: string;
  donorId: string;
  isAnonymous: boolean;
  campaignId: string;
  amountCents: number;
  status: DonationStatus;
  paidAt: Date | null;
};

export type PeriodTotals = { raisedCents: number; donationCount: number };

export type Metrics = {
  /** Gross, before payment-provider fees. */
  raisedCents: number;
  donationCount: number;
  uniqueDonors: number;
  /** Donors who gave to the same campaign more than once (anonymous gifts never count). */
  repeatDonors: number;
  thisWeek: PeriodTotals & {
    /** First ever gift to that campaign was this week. */
    newDonors: number;
    /** Gave this week and had given to that campaign before this week. */
    returningDonors: number;
  };
  lastWeek: PeriodTotals;
  /** One entry per day for the last `days` days (oldest first), for the Day 5 pacing chart. */
  daily: { date: string; raisedCents: number; cumulativeCents: number }[];
};

const SAST_OFFSET_MS = 2 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** YYYY-MM-DD of an instant in Johannesburg. */
export function sastDate(d: Date): string {
  return new Date(d.getTime() + SAST_OFFSET_MS).toISOString().slice(0, 10);
}

/** The instant Monday 00:00 Johannesburg time starts, for the week containing `now`. */
export function sastWeekStart(now: Date): Date {
  const local = new Date(now.getTime() + SAST_OFFSET_MS);
  const daysSinceMonday = (local.getUTCDay() + 6) % 7;
  const mondayLocalMidnight = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - daysSinceMonday);
  return new Date(mondayLocalMidnight - SAST_OFFSET_MS);
}

type Paid = MetricDonation & { paidAt: Date };

function paidOnly(rows: MetricDonation[]): Paid[] {
  return rows.filter((r): r is Paid => r.status === "SUCCEEDED" && r.paidAt !== null);
}

/** Who a gift counts towards: the donor, or for an anonymous gift only that gift itself. */
function donorKey(r: MetricDonation): string {
  return r.isAnonymous ? `anon:${r.id}` : `donor:${r.donorId}`;
}

function totals(rows: Paid[]): PeriodTotals {
  return { raisedCents: rows.reduce((sum, r) => sum + r.amountCents, 0), donationCount: rows.length };
}

export function computeMetrics(rows: MetricDonation[], now: Date, opts: { days?: number } = {}): Metrics {
  const paid = paidOnly(rows).filter((r) => r.paidAt <= now);
  const weekStart = sastWeekStart(now);
  const lastWeekStart = new Date(weekStart.getTime() - 7 * DAY_MS);
  const thisWeek = paid.filter((r) => r.paidAt >= weekStart);
  const lastWeek = paid.filter((r) => r.paidAt >= lastWeekStart && r.paidAt < weekStart);

  // First gift per donor+campaign decides new vs returning.
  const pairKey = (r: Paid) => `${r.campaignId}\u0000${donorKey(r)}`;
  const firstGift = new Map<string, Date>();
  const giftsPerPair = new Map<string, number>();
  for (const r of paid) {
    const k = pairKey(r);
    const prev = firstGift.get(k);
    if (!prev || r.paidAt < prev) firstGift.set(k, r.paidAt);
    giftsPerPair.set(k, (giftsPerPair.get(k) ?? 0) + 1);
  }

  // A donor who gave this week is "returning" if any of this week's gifts went to a campaign they
  // had supported before this week; otherwise "new". Each donor is counted once.
  const thisWeekDonors = new Map<string, boolean>(); // donor key -> returning?
  for (const r of thisWeek) {
    const returning = firstGift.get(pairKey(r))! < weekStart;
    const key = donorKey(r);
    thisWeekDonors.set(key, (thisWeekDonors.get(key) ?? false) || returning);
  }
  const returningDonors = [...thisWeekDonors.values()].filter(Boolean).length;

  const repeatDonors = new Set(paid.filter((r) => (giftsPerPair.get(pairKey(r)) ?? 0) > 1).map(donorKey)).size;

  return {
    ...totals(paid),
    uniqueDonors: new Set(paid.map(donorKey)).size,
    repeatDonors,
    thisWeek: { ...totals(thisWeek), newDonors: thisWeekDonors.size - returningDonors, returningDonors },
    lastWeek: totals(lastWeek),
    daily: dailySeries(paid, now, opts.days ?? 28),
  };
}

function dailySeries(paid: Paid[], now: Date, days: number): Metrics["daily"] {
  const today = sastDate(now);
  const dates: string[] = [];
  for (let i = days - 1; i >= 0; i--) dates.push(sastDate(new Date(now.getTime() - i * DAY_MS)));
  const first = dates[0];

  const perDay = new Map<string, number>();
  let cumulative = 0; // everything raised before the window, so the line starts at the real total
  for (const r of paid) {
    const d = sastDate(r.paidAt);
    if (d < first) cumulative += r.amountCents;
    else if (d <= today) perDay.set(d, (perDay.get(d) ?? 0) + r.amountCents);
  }
  return dates.map((date) => {
    const raisedCents = perDay.get(date) ?? 0;
    cumulative += raisedCents;
    return { date, raisedCents, cumulativeCents: cumulative };
  });
}

/** Rows grouped by campaign, so each campaign's metrics come from the same function. */
export function groupByCampaign<T extends { campaignId: string }>(rows: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const r of rows) {
    const list = map.get(r.campaignId);
    if (list) list.push(r);
    else map.set(r.campaignId, [r]);
  }
  return map;
}

/**
 * Daily raised + running total for the long-term chart, from `since` (or the first gift, if earlier)
 * up to today, or up to the campaign's last day (`untilDay`, YYYY-MM-DD) once that has passed, so a
 * closed campaign's chart doesn't grow a tail of empty days. Paid gifts only.
 *
 * Every paid gift is included, so the final running total always equals computeMetrics().raisedCents
 * (the "Raised" figure on the same page). A gift confirmed just before the end but paid after midnight
 * (the Stripe payment page stays open for a while) is counted on the campaign's last day.
 */
export function longTermSeries(
  rows: MetricDonation[],
  since: Date | null,
  now: Date,
  untilDay?: string,
): { date: string; raisedCents: number; cumulativeCents: number }[] {
  // Last moment of untilDay in Johannesburg: next day 00:00 SAST minus 1 ms.
  const untilEnd = untilDay ? new Date(Date.parse(`${untilDay}T00:00:00Z`) + DAY_MS - SAST_OFFSET_MS - 1) : null;
  const end = untilEnd && untilEnd < now ? untilEnd : now;
  // Late payments (after the last day) are moved onto the last moment of the last day, not dropped.
  const paid = paidOnly(rows)
    .filter((r) => r.paidAt <= now)
    .map((r) => (r.paidAt > end ? { ...r, paidAt: end } : r));
  const firstPaid = paid.reduce<Date | null>((min, r) => (!min || r.paidAt < min ? r.paidAt : min), null);
  // Start at the campaign start, or the first gift if that is earlier (e.g. seeded or back-dated data).
  const startAt = since && firstPaid ? (since < firstPaid ? since : firstPaid) : (since ?? firstPaid ?? end);
  const days = Math.max(1, Math.round((Date.parse(sastDate(end)) - Date.parse(sastDate(startAt))) / DAY_MS) + 1);
  return dailySeries(paid, end, days);
}

export type WeekTotal = {
  /** Monday of the week, YYYY-MM-DD (Johannesburg). */
  weekStart: string;
  raisedCents: number;
  donationCount: number;
  /** The week containing `now`, still in progress. */
  current: boolean;
};

/** Totals per Monday–Sunday week (Johannesburg), oldest first, for the week-by-week chart. Paid gifts only. */
export function weeklySeries(rows: MetricDonation[], now: Date, weeks = 8): WeekTotal[] {
  const paid = paidOnly(rows).filter((r) => r.paidAt <= now);
  const thisWeek = sastWeekStart(now).getTime();
  const result: WeekTotal[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const start = thisWeek - i * 7 * DAY_MS;
    const end = start + 7 * DAY_MS;
    const inWeek = paid.filter((r) => r.paidAt.getTime() >= start && r.paidAt.getTime() < end);
    result.push({
      weekStart: sastDate(new Date(start)),
      ...totals(inWeek),
      current: i === 0,
    });
  }
  return result;
}
